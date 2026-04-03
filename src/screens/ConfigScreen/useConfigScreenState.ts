/**
 * useConfigScreenState — ConfigScreen state & callbacks extraction
 *
 * Owns all useState, useEffect, useCallback, useMemo for ConfigScreen.
 * Returns a flat bag of values consumed by ConfigScreen JSX (same pattern
 * as useRoomScreenState for RoomScreen).
 *
 * Does not render JSX, does not import RN components, does not own styles.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { Faction } from '@werewolf/game-engine/models/roles';
import {
  createCustomTemplate,
  PRESET_TEMPLATES,
  validateTemplateRoles,
} from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import type { RootStackParamList } from '@/navigation/types';
import type { SettingsService } from '@/services/feature/SettingsService';
import type { IAuthService } from '@/services/types/IAuthService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { IRoomService } from '@/services/types/IRoomService';
import type { ThemeColors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import type { FactionTabItem } from './components';
import { FACTION_GROUPS } from './configData';
import {
  computeTotalCount,
  getEmptySelection,
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
  presetName: string | undefined;
  navigation: ConfigNavigationProp;
  facade: IGameFacade;
  settingsService: SettingsService;
  authService: IAuthService;
  roomService: IRoomService;
  colors: ThemeColors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useConfigScreenState({
  existingRoomNumber,
  presetName,
  navigation,
  facade,
  settingsService,
  authService,
  roomService,
  colors,
}: UseConfigScreenStateParams) {
  const isEditMode = !!existingRoomNumber;

  // ── Core state ────────────────────────────────────────────────────────────

  // Compute initial selection from presetName (if navigating from BoardPicker)
  const presetInitial = useMemo(() => {
    if (!presetName) return undefined;
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (!preset) return undefined;
    return restoreFromTemplateRoles(preset.roles);
  }, [presetName]);

  const [selection, setSelection] = useState(
    () => presetInitial?.selection ?? (isEditMode ? getInitialSelection() : getEmptySelection()),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [roleRevealAnimation, setRoleRevealAnimation] = useState<RoleRevealAnimation>('random');
  const [selectedTemplate, setSelectedTemplate] = useState(
    presetInitial?.matchedPreset ?? (isEditMode ? (PRESET_TEMPLATES[0]?.name ?? '') : '__custom__'),
  );
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [variantOverrides, setVariantOverrides] = useState<Record<string, string>>(
    () => presetInitial?.variantOverrides ?? {},
  );

  const totalCount = useMemo(
    () => computeTotalCount(selection, variantOverrides),
    [selection, variantOverrides],
  );

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
        handleError(error, { label: '加载房间', logger: configLog, alertTitle: false });
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

  const handleTemplatePillPress = useCallback(() => {
    navigation.navigate('BoardPicker');
  }, [navigation]);

  const toggleRole = useCallback((key: string) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    setSelectedTemplate('__custom__');
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
      showErrorAlert('配置有误', '请至少选择一个角色');
      creatingRef.current = false;
      return;
    }

    const validationError = validateTemplateRoles(roles);
    if (validationError) {
      showErrorAlert('配置有误', validationError);
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
          showErrorAlert('更新失败', result.reason ?? '更新房间设置失败，请重试');
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
          navigation.navigate('Home');
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
      handleError(e, {
        label: isEditMode ? '更新房间' : '创建房间',
        logger: configLog,
        alertMessage: isEditMode ? '更新房间失败，请重试' : '创建房间失败，请重试',
      });
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

  // ── Template label ───────────────────────────────────────────────────────

  const handleAnimationChange = useCallback((v: string) => {
    setRoleRevealAnimation(v as RoleRevealAnimation);
  }, []);

  const handleBgmChange = useCallback((v: string) => {
    setBgmEnabled(v === 'on');
  }, []);

  // ── Role info card (long-press any chip → RoleCardSimple with variant bar) ──

  const [roleInfoBaseId, setRoleInfoBaseId] = useState<string | null>(null);

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

  // The displayed roleId resolves the active variant override
  const roleInfoId = roleInfoBaseId ? (variantOverrides[roleInfoBaseId] ?? roleInfoBaseId) : null;

  // Variant pill bar data (only for slots that have variants)
  const roleInfoSlot = roleInfoBaseId ? findSlotForKey(roleInfoBaseId) : null;
  const roleInfoVariantIds = roleInfoSlot ? [roleInfoSlot.roleId, ...roleInfoSlot.variants!] : [];
  const roleInfoActiveVariant = roleInfoBaseId
    ? (variantOverrides[roleInfoBaseId] ?? roleInfoBaseId)
    : '';

  const handleChipInfoPress = useCallback((key: string) => {
    const baseRoleId = key.replace(/\d+$/, '');
    setRoleInfoBaseId(baseRoleId);
  }, []);

  const handleCloseRoleInfo = useCallback(() => {
    setRoleInfoBaseId(null);
  }, []);

  /** Switch variant from within the RoleCardSimple pill bar. */
  const handleRoleInfoVariantSelect = useCallback(
    (variantId: string) => {
      if (!roleInfoBaseId) return;
      setVariantOverrides((prev) => {
        if (variantId === roleInfoBaseId) {
          const next = { ...prev };
          delete next[roleInfoBaseId];
          return next;
        }
        return { ...prev, [roleInfoBaseId]: variantId };
      });
      setSelection((prev) => {
        if (prev[roleInfoBaseId]) return prev;
        return { ...prev, [roleInfoBaseId]: true };
      });
      setSelectedTemplate('__custom__');
    },
    [roleInfoBaseId],
  );

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

  // ── Template label ───────────────────────────────────────────────────────

  const selectedTemplateLabel = useMemo(() => {
    if (selectedTemplate === '__custom__') return '自定义';
    const preset = PRESET_TEMPLATES.find((p) => p.name === selectedTemplate);
    return preset ? preset.name : selectedTemplate;
  }, [selectedTemplate]);

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
    handleTemplatePillPress,
    handleCreateRoom,

    // Role toggling
    toggleRole,
    handleClearSelection,

    // Template
    selectedTemplateLabel,

    // Settings
    roleRevealAnimation,
    bgmEnabled,
    settingsSheetVisible,
    handleOpenSettings,
    handleCloseSettings,
    handleAnimationChange,
    handleBgmChange,

    // Role info (with variant switching)
    roleInfoId,
    roleInfoVariantIds,
    roleInfoActiveVariant,
    handleChipInfoPress,
    handleCloseRoleInfo,
    handleRoleInfoVariantSelect,

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
