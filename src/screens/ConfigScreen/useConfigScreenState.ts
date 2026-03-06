/**
 * useConfigScreenState — ConfigScreen state & callbacks extraction
 *
 * Owns all useState, useEffect, useCallback, useMemo for ConfigScreen.
 * Returns a flat bag of values consumed by ConfigScreen JSX (same pattern
 * as useRoomScreenState for RoomScreen).
 *
 * Does not render JSX, does not import RN components, does not own styles.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { Faction } from '@werewolf/game-engine/models/roles';
import {
  createCustomTemplate,
  PRESET_TEMPLATES,
  validateTemplateRoles,
} from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import type { RootStackParamList } from '@/navigation/types';
import type { SettingsService } from '@/services/feature/SettingsService';
import type { AuthService } from '@/services/infra/AuthService';
import type { RoomService } from '@/services/infra/RoomService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { ThemeColors } from '@/theme';
import { showAlert } from '@/utils/alert';
import { configLog } from '@/utils/logger';

import type { DropdownOption, FactionTabItem } from './components';
import { FACTION_GROUPS } from './configData';
import {
  computeTotalCount,
  getInitialSelection,
  restoreFromTemplateRoles,
  selectionToRoles,
} from './configHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConfigNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;

interface UseConfigScreenStateParams {
  existingRoomNumber: string | undefined;
  navigation: ConfigNavigationProp;
  facade: IGameFacade;
  settingsService: SettingsService;
  authService: AuthService;
  roomService: RoomService;
  colors: ThemeColors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useConfigScreenState({
  existingRoomNumber,
  navigation,
  facade,
  settingsService,
  authService,
  roomService,
  colors,
}: UseConfigScreenStateParams) {
  const isEditMode = !!existingRoomNumber;

  // ── Core state ────────────────────────────────────────────────────────────

  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [roleRevealAnimation, setRoleRevealAnimation] = useState<RoleRevealAnimation>('random');
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]?.name ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [variantOverrides, setVariantOverrides] = useState<Record<string, string>>({});

  const totalCount = useMemo(() => computeTotalCount(selection), [selection]);

  // ── Load settings (animation + BGM) for new rooms ────────────────────────

  useEffect(() => {
    if (!existingRoomNumber) {
      const lastChoice = settingsService.getRoleRevealAnimation();
      setRoleRevealAnimation(lastChoice);
      setBgmEnabled(settingsService.isBgmEnabled());
    }
  }, [existingRoomNumber, settingsService]);

  // ── Load current room's roles when in edit mode ──────────────────────────

  useEffect(() => {
    configLog.debug(
      ' useEffect triggered, isEditMode:',
      isEditMode,
      'existingRoomNumber:',
      existingRoomNumber,
    );
    if (!isEditMode || !existingRoomNumber) {
      configLog.debug(' Skipping load - not in edit mode or no room number');
      return;
    }

    const loadCurrentRoles = () => {
      configLog.debug(' Loading room:', existingRoomNumber);
      try {
        const state = facade.getState();
        configLog.debug(' State loaded:', state ? 'success' : 'not found');
        if (state?.templateRoles && state.templateRoles.length > 0) {
          const restored = restoreFromTemplateRoles(state.templateRoles);
          setSelection(restored.selection);
          setVariantOverrides(restored.variantOverrides);
          setSelectedTemplate(restored.matchedPreset ?? '__custom__');
        }
        if (state?.roleRevealAnimation) {
          setRoleRevealAnimation(state.roleRevealAnimation);
        }
        setBgmEnabled(settingsService.isBgmEnabled());
      } catch (error) {
        configLog.error(' Failed to load room:', error);
        Sentry.captureException(error);
      } finally {
        configLog.debug(' Setting isLoading=false');
        setIsLoading(false);
      }
    };

    loadCurrentRoles();
  }, [isEditMode, existingRoomNumber, facade, settingsService]);

  // ── Reset transient states when screen regains focus ─────────────────────

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsCreating(false);
    });
    return unsubscribe;
  }, [navigation]);

  // ── Callback handlers ────────────────────────────────────────────────────

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const toggleRole = useCallback((key: string) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    setSelectedTemplate('__custom__');
  }, []);

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (!preset) return;
    const restored = restoreFromTemplateRoles(preset.roles);
    setSelection(restored.selection);
    setVariantOverrides(restored.variantOverrides);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelection((prev) => {
      const cleared: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => (cleared[k] = false));
      return cleared;
    });
    setSelectedTemplate('__custom__');
  }, []);

  const creatingRef = useRef(false);
  const handleCreateRoom = useCallback(async () => {
    if (creatingRef.current || isLoading) return;
    creatingRef.current = true;

    const roles = selectionToRoles(selection, variantOverrides);
    if (roles.length === 0) {
      showAlert('配置提示', '请至少选择一个角色');
      creatingRef.current = false;
      return;
    }

    const validationError = validateTemplateRoles(roles);
    if (validationError) {
      showAlert('配置不合法', validationError);
      creatingRef.current = false;
      return;
    }

    setIsCreating(true);
    try {
      const template = createCustomTemplate(roles);

      await settingsService.setBgmEnabled(bgmEnabled);

      if (isEditMode && existingRoomNumber) {
        const result = await facade.updateTemplate(template);
        if (!result.success) {
          showAlert('更新失败', result.reason ?? '更新房间设置失败，请重试');
          return;
        }
        await facade.setRoleRevealAnimation(roleRevealAnimation);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Home');
        }
      } else {
        await settingsService.setRoleRevealAnimation(roleRevealAnimation);
        // Create room record in DB first — get confirmed/final roomNumber
        await authService.waitForInit();
        const hostUid = authService.getCurrentUserId();
        if (!hostUid) {
          showAlert('需要登录', '请先登录后再创建房间');
          return;
        }
        const record = await roomService.createRoom(hostUid, undefined, undefined, (roomCode) =>
          buildInitialGameState(roomCode, hostUid, template),
        );
        const roomNumber = record.roomNumber;
        await AsyncStorage.setItem(LAST_ROOM_NUMBER_KEY, roomNumber);
        navigation.navigate('Room', {
          roomNumber,
          isHost: true,
          template,
          roleRevealAnimation,
        });
      }
    } catch (e) {
      configLog.error('Room create/join failed', e);
      Sentry.captureException(e);
      showAlert(
        isEditMode ? '更新失败' : '创建失败',
        isEditMode ? '更新房间失败，请重试' : '创建房间失败，请重试',
      );
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  }, [
    selection,
    navigation,
    isEditMode,
    existingRoomNumber,
    facade,
    roleRevealAnimation,
    settingsService,
    bgmEnabled,
    isLoading,
    authService,
    roomService,
    variantOverrides,
  ]);

  // ── Template dropdown options ────────────────────────────────────────────

  const templateOptions: DropdownOption[] = useMemo(
    () =>
      PRESET_TEMPLATES.map((p) => ({
        value: p.name,
        label: p.name.replace(/\d+人$/, ''),
      })),
    [],
  );

  const animationOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'random', label: '随机' },
      { value: 'roulette', label: '轮盘' },
      { value: 'roleHunt', label: '猎场' },
      { value: 'scratch', label: '刮刮卡' },
      { value: 'tarot', label: '塔罗牌' },
      { value: 'gachaMachine', label: '扭蛋机' },
      { value: 'cardPick', label: '抽牌' },
      { value: 'none', label: '无动画' },
    ],
    [],
  );

  const bgmOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'on', label: '开' },
      { value: 'off', label: '关' },
    ],
    [],
  );

  const handleTemplateChange = useCallback(
    (templateName: string) => {
      setSelectedTemplate(templateName);
      if (templateName !== '__custom__') {
        handlePresetSelect(templateName);
      }
    },
    [handlePresetSelect],
  );

  const handleAnimationChange = useCallback((v: string) => {
    setRoleRevealAnimation(v as RoleRevealAnimation);
  }, []);

  const handleBgmChange = useCallback((v: string) => {
    setBgmEnabled(v === 'on');
  }, []);

  // ── Variant picker ───────────────────────────────────────────────────────

  const [variantPickerSlotId, setVariantPickerSlotId] = useState<string | null>(null);

  const [roleInfoId, setRoleInfoId] = useState<string | null>(null);

  const handleChipInfoPress = useCallback((key: string) => {
    const roleId = key.replace(/\d+$/, '');
    setRoleInfoId(roleId);
  }, []);

  const handleCloseRoleInfo = useCallback(() => {
    setRoleInfoId(null);
  }, []);

  const findSlotForKey = useCallback((key: string) => {
    const baseRoleId = key.replace(/\d+$/, '');
    for (const group of FACTION_GROUPS) {
      for (const section of group.sections) {
        for (const slot of section.roles) {
          if (slot.roleId === baseRoleId && slot.variants && slot.variants.length > 0) {
            return slot;
          }
        }
      }
    }
    return null;
  }, []);

  const handleChipLongPress = useCallback((key: string) => {
    const baseRoleId = key.replace(/\d+$/, '');
    setVariantPickerSlotId(baseRoleId);
  }, []);

  const handleVariantSelect = useCallback(
    (variantId: string) => {
      if (!variantPickerSlotId) return;
      setVariantOverrides((prev) => {
        if (variantId === variantPickerSlotId) {
          const next = { ...prev };
          delete next[variantPickerSlotId];
          return next;
        }
        return { ...prev, [variantPickerSlotId]: variantId };
      });
      setSelection((prev) => {
        if (prev[variantPickerSlotId]) return prev;
        return { ...prev, [variantPickerSlotId]: true };
      });
      setSelectedTemplate('__custom__');
    },
    [variantPickerSlotId],
  );

  const variantPickerVisible = variantPickerSlotId !== null;
  const variantPickerSlot = variantPickerSlotId ? findSlotForKey(variantPickerSlotId) : null;
  const variantPickerIds = variantPickerSlot
    ? [variantPickerSlot.roleId, ...variantPickerSlot.variants!]
    : [];
  const variantPickerActive = variantPickerSlotId
    ? (variantOverrides[variantPickerSlotId] ?? variantPickerSlotId)
    : '';

  const handleCloseVariantPicker = useCallback(() => {
    setVariantPickerSlotId(null);
  }, []);

  // ── Active faction tab ───────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<string>(FACTION_GROUPS[0]?.faction ?? '');

  const handleTabPress = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // ── Settings sheet ───────────────────────────────────────────────────────

  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);

  const handleOpenSettings = useCallback(() => {
    setSettingsSheetVisible(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsSheetVisible(false);
  }, []);

  // ── Template dropdown ────────────────────────────────────────────────────

  const [templateDropdownVisible, setTemplateDropdownVisible] = useState(false);

  const handleOpenTemplateDropdown = useCallback(() => {
    setTemplateDropdownVisible(true);
  }, []);

  const handleCloseTemplateDropdown = useCallback(() => {
    setTemplateDropdownVisible(false);
  }, []);

  const handleSelectTemplate = useCallback(
    (value: string) => {
      handleTemplateChange(value);
      setTemplateDropdownVisible(false);
    },
    [handleTemplateChange],
  );

  const selectedTemplateLabel = useMemo(() => {
    if (selectedTemplate === '__custom__') return '自定义';
    const opt = templateOptions.find((o) => o.value === selectedTemplate);
    return opt?.label ?? selectedTemplate;
  }, [selectedTemplate, templateOptions]);

  // ── Bulk role stepper ────────────────────────────────────────────────────

  const getBulkCount = useCallback(
    (roleId: string, maxCount: number): number => {
      let count = 0;
      for (let i = 0; i < maxCount; i++) {
        const key = i === 0 ? roleId : `${roleId}${i}`;
        if (selection[key]) count++;
      }
      return count;
    },
    [selection],
  );

  const handleBulkCountChange = useCallback((roleId: string, newCount: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      let maxCount = 1;
      for (const group of FACTION_GROUPS) {
        for (const section of group.sections) {
          for (const slot of section.roles) {
            if (slot.roleId === roleId) maxCount = slot.count ?? 1;
          }
        }
      }
      for (let i = 0; i < maxCount; i++) {
        const key = i === 0 ? roleId : `${roleId}${i}`;
        next[key] = i < newCount;
      }
      return next;
    });
    setSelectedTemplate('__custom__');
  }, []);

  const getFactionAccentColor = useCallback(
    (faction: Faction): string => {
      switch (faction) {
        case Faction.Wolf:
          return colors.wolf;
        case Faction.God:
          return colors.god;
        case Faction.Villager:
          return colors.villager;
        case Faction.Special:
          return colors.third;
        default:
          return colors.primary;
      }
    },
    [colors],
  );

  const getFactionSelectedCount = useCallback(
    (group: (typeof FACTION_GROUPS)[number]): number => {
      let count = 0;
      for (const section of group.sections) {
        for (const slot of section.roles) {
          const slotCount = slot.count ?? 1;
          for (let i = 0; i < slotCount; i++) {
            const key = i === 0 ? slot.roleId : `${slot.roleId}${i}`;
            if (selection[key]) count++;
          }
        }
      }
      return count;
    },
    [selection],
  );

  const tabItems: FactionTabItem[] = useMemo(
    () =>
      FACTION_GROUPS.map((group) => {
        const accentColor = getFactionAccentColor(group.faction);
        return {
          key: group.faction,
          icon: React.createElement(Ionicons, {
            name: group.iconName as keyof typeof Ionicons.glyphMap,
            size: 14,
            color: accentColor,
          }),
          title: group.title,
          count: getFactionSelectedCount(group),
          accentColor,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, getFactionAccentColor, getFactionSelectedCount],
  );

  const activeGroup = useMemo(
    () => FACTION_GROUPS.find((g) => g.faction === activeTab) ?? FACTION_GROUPS[0],
    [activeTab],
  );

  const isDisabled = isCreating || isLoading;

  // ── Return bag ───────────────────────────────────────────────────────────

  return {
    // Mode
    isEditMode,
    isDisabled,
    isLoading,
    isCreating,

    // Core state
    selection,
    totalCount,
    variantOverrides,
    overflowVisible,
    setOverflowVisible,

    // Navigation
    handleGoBack,
    handleCreateRoom,

    // Role toggling
    toggleRole,
    handleClearSelection,

    // Template
    selectedTemplate,
    selectedTemplateLabel,
    templateOptions,
    templateDropdownVisible,
    handleOpenTemplateDropdown,
    handleCloseTemplateDropdown,
    handleSelectTemplate,

    // Settings
    roleRevealAnimation,
    bgmEnabled,
    animationOptions,
    bgmOptions,
    settingsSheetVisible,
    handleOpenSettings,
    handleCloseSettings,
    handleAnimationChange,
    handleBgmChange,

    // Variant picker
    variantPickerVisible,
    variantPickerIds,
    variantPickerActive,
    handleChipLongPress,
    handleVariantSelect,
    handleCloseVariantPicker,

    // Role info
    roleInfoId,
    handleChipInfoPress,
    handleCloseRoleInfo,

    // Faction tabs
    tabItems,
    activeTab,
    activeGroup,
    handleTabPress,

    // Bulk stepper
    getBulkCount,
    handleBulkCountChange,
    getFactionAccentColor,
  };
}
