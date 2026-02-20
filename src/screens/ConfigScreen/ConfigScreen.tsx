/**
 * ConfigScreen - 游戏配置与房间创建
 *
 * 角色列表由 FACTION_GROUPS + ROLE_SPECS 数据驱动。性能优化同 HomeScreen。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { Faction, ROLE_SPECS, RoleId } from '@werewolf/game-engine/models/roles';
import {
  createCustomTemplate,
  findMatchingPresetName,
  PRESET_TEMPLATES,
  validateTemplateRoles,
} from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useGameFacade } from '@/contexts';
import { useServices } from '@/contexts/ServiceContext';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { spacing, useColors } from '@/theme';
import { showAlert } from '@/utils/alert';
import { configLog } from '@/utils/logger';

import {
  createConfigScreenStyles,
  type DropdownOption,
  type FactionColorKey,
  type FactionTabItem,
  FactionTabs,
  RoleChip,
  RoleStepper,
  Section,
  SettingsSheet,
  TemplatePicker,
} from './components';
import { buildInitialSelection, FACTION_GROUPS } from './configData';

// ============================================
// Helper functions
// ============================================

const getInitialSelection = (): Record<string, boolean> => buildInitialSelection();

const selectionToRoles = (selection: Record<string, boolean>): RoleId[] => {
  const roles: RoleId[] = [];
  Object.entries(selection).forEach(([key, selected]) => {
    if (selected) {
      const roleId = key.replace(/\d+$/, '') as RoleId;
      roles.push(roleId);
    }
  });
  return roles;
};

const applyPreset = (presetRoles: RoleId[]): Record<string, boolean> => {
  const selection = getInitialSelection();
  Object.keys(selection).forEach((key) => {
    selection[key] = false;
  });
  const roleCounts: Record<string, number> = {};
  presetRoles.forEach((role) => {
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  Object.entries(roleCounts).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      const key = i === 0 ? role : `${role}${i}`;
      if (key in selection) selection[key] = true;
    }
  });
  return selection;
};

/** Map Faction enum to FactionColorKey for chip coloring */
const FACTION_COLOR_MAP: Record<string, FactionColorKey> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'neutral',
};

/** Compute total selected role count */
const computeTotalCount = (selection: Record<string, boolean>): number => {
  let total = 0;
  Object.values(selection).forEach((selected) => {
    if (selected) total++;
  });
  return total;
};

/** Expand a RoleSlot into an array of {key, label} for rendering chips */
const expandSlotToChipEntries = (slot: {
  roleId: string;
  count?: number;
}): { key: string; label: string }[] => {
  const count = slot.count ?? 1;
  const spec = ROLE_SPECS[slot.roleId as keyof typeof ROLE_SPECS];
  const label = spec?.displayName ?? slot.roleId;

  return Array.from({ length: count }, (_, i) => ({
    key: i === 0 ? slot.roleId : `${slot.roleId}${i}`,
    label,
  }));
};

// ============================================
// Main Component
// ============================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const colors = useColors();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createConfigScreenStyles(colors), [colors]);

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomNumber = route.params?.existingRoomNumber;
  const isEditMode = !!existingRoomNumber;

  const { settingsService, authService, roomService } = useServices();

  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [roleRevealAnimation, setRoleRevealAnimation] = useState<RoleRevealAnimation>('random');
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]?.name ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [overflowVisible, setOverflowVisible] = useState(false);

  const facade = useGameFacade();
  const totalCount = useMemo(() => computeTotalCount(selection), [selection]);

  // Load settings (animation + BGM) for new rooms
  useEffect(() => {
    if (!existingRoomNumber) {
      const lastChoice = settingsService.getRoleRevealAnimation();
      setRoleRevealAnimation(lastChoice);
      setBgmEnabled(settingsService.isBgmEnabled());
    }
  }, [existingRoomNumber, settingsService]);

  // Load current room's roles when in edit mode
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
          setSelection(applyPreset(state.templateRoles));
          const matchedPreset = findMatchingPresetName(state.templateRoles);
          setSelectedTemplate(matchedPreset ?? '__custom__');
        }
        if (state?.roleRevealAnimation) {
          setRoleRevealAnimation(state.roleRevealAnimation);
        }
        setBgmEnabled(settingsService.isBgmEnabled());
      } catch (error) {
        configLog.error(' Failed to load room:', error);
      } finally {
        configLog.debug(' Setting isLoading=false');
        setIsLoading(false);
      }
    };

    loadCurrentRoles();
  }, [isEditMode, existingRoomNumber, facade, settingsService]);

  // Reset transient states when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsCreating(false);
    });
    return unsubscribe;
  }, [navigation]);

  // ============================================
  // Stable callback handlers
  // ============================================

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
    if (preset) setSelection(applyPreset(preset.roles));
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

    const roles = selectionToRoles(selection);
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
          showAlert('提示', '请先登录后再创建房间');
          return;
        }
        const record = await roomService.createRoom(hostUid, undefined, undefined, (roomCode) =>
          buildInitialGameState(roomCode, hostUid, template),
        );
        const roomNumber = record.roomNumber;
        await AsyncStorage.setItem('lastRoomNumber', roomNumber);
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
  ]);

  // Template dropdown options (short display names, strip "12人" suffix)
  const templateOptions: DropdownOption[] = useMemo(
    () =>
      PRESET_TEMPLATES.map((p) => ({
        value: p.name,
        label: p.name.replace(/\d+人$/, ''),
      })),
    [],
  );

  // 5 种动画 + 随机 + 无动画
  const animationOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'random', label: '🎲 随机' },
      { value: 'roulette', label: '🎰 轮盘' },
      { value: 'flip', label: '🃏 翻牌' },
      { value: 'scratch', label: '🎫 刮刮卡' },
      { value: 'tarot', label: '🎴 塔罗牌' },
      { value: 'gachaMachine', label: '🎱 扭蛋机' },
      { value: 'cardPick', label: '🃏 抽牌' },
      { value: 'none', label: '⚡ 无动画' },
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

  // ============================================
  // Active faction tab
  // ============================================

  const [activeTab, setActiveTab] = useState<string>(FACTION_GROUPS[0]?.faction ?? '');

  const handleTabPress = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // ============================================
  // Settings sheet (Animation + BGM)
  // ============================================

  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);

  const handleOpenSettings = useCallback(() => {
    setSettingsSheetVisible(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsSheetVisible(false);
  }, []);

  // ============================================
  // Template dropdown (title-style trigger in header)
  // ============================================

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

  // ============================================
  // Bulk role stepper
  // ============================================

  /** Count how many of a bulk role are currently selected */
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
      // Find maxCount from FACTION_GROUPS
      let maxCount = 1;
      for (const group of FACTION_GROUPS) {
        for (const section of group.sections) {
          for (const slot of section.roles) {
            if (slot.roleId === roleId) maxCount = slot.count ?? 1;
          }
        }
      }
      // Set first `newCount` keys to true, rest to false
      for (let i = 0; i < maxCount; i++) {
        const key = i === 0 ? roleId : `${roleId}${i}`;
        next[key] = i < newCount;
      }
      return next;
    });
    setSelectedTemplate('__custom__');
  }, []);

  /** Map faction to accent color for UI */
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

  /** Count selected roles in a faction group */
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

  /** Build tab items for FactionTabs */
  const tabItems: FactionTabItem[] = useMemo(
    () =>
      FACTION_GROUPS.map((group) => {
        const accentColor = getFactionAccentColor(group.faction);
        return {
          key: group.faction,
          icon: (
            <Ionicons
              name={group.iconName as keyof typeof Ionicons.glyphMap}
              size={14}
              color={accentColor}
            />
          ),
          title: group.title,
          count: getFactionSelectedCount(group),
          accentColor,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, getFactionAccentColor, getFactionSelectedCount],
  );

  /** The currently active faction group */
  const activeGroup = useMemo(
    () => FACTION_GROUPS.find((g) => g.faction === activeTab) ?? FACTION_GROUPS[0],
    [activeTab],
  );

  // activeFactionColorKey removed — section-level faction is used per-section in render

  const isDisabled = isCreating || isLoading;

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header row — ← | 预女猎白▾ 12人 | ⋯ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleGoBack}
          testID={TESTIDS.configBackButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.templatePill}
            onPress={handleOpenTemplateDropdown}
            activeOpacity={0.7}
          >
            <Text style={styles.templatePillText}>{selectedTemplateLabel}</Text>
            <Text style={styles.templatePillArrow}>▾</Text>
          </TouchableOpacity>
          <Text style={styles.playerCount}>{totalCount}人</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setOverflowVisible((v) => !v)}
          activeOpacity={0.7}
          testID={TESTIDS.configMoreButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Overflow popup menu */}
      {overflowVisible && (
        <>
          <TouchableOpacity
            style={styles.overflowMenuOverlay}
            activeOpacity={1}
            onPress={() => setOverflowVisible(false)}
          />
          <View style={styles.overflowMenu}>
            <TouchableOpacity
              style={styles.overflowMenuItem}
              onPress={() => {
                setOverflowVisible(false);
                handleClearSelection();
              }}
              testID={TESTIDS.configOverflowReset}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.text}
                style={styles.overflowMenuItemIcon}
              />
              <Text style={styles.overflowMenuItemText}>重置配置</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.overflowMenuItem}
              onPress={() => {
                setOverflowVisible(false);
                handleOpenSettings();
              }}
              testID={TESTIDS.configOverflowSettings}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color={colors.text}
                style={styles.overflowMenuItemIcon}
              />
              <Text style={styles.overflowMenuItemText}>设置</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Card A — faction tabs */}
      <View style={styles.cardA}>
        {/* Faction Tab Bar */}
        <FactionTabs
          tabs={tabItems}
          activeKey={activeTab}
          onTabPress={handleTabPress}
          styles={styles}
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="加载中..." fullScreen={false} />
      ) : (
        <>
          {/* Active tab content */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.large }}
          >
            {/* Card B — stepper + role sections */}
            <View style={styles.cardB}>
              {activeGroup.sections.map((section, index) => {
                const sectionFaction = section.faction ?? activeGroup.faction;
                const sectionAccentColor = getFactionAccentColor(sectionFaction);

                // Bulk slot → RoleStepper
                const bulkSlot = section.roles.find((s) => s.isBulk);
                if (bulkSlot) {
                  const maxCount = bulkSlot.count ?? 1;
                  const currentCount = getBulkCount(bulkSlot.roleId, maxCount);
                  const spec = ROLE_SPECS[bulkSlot.roleId as keyof typeof ROLE_SPECS];
                  return (
                    <React.Fragment key={section.title}>
                      <RoleStepper
                        roleId={bulkSlot.roleId}
                        label={spec?.displayName ?? bulkSlot.roleId}
                        count={currentCount}
                        maxCount={maxCount}
                        onCountChange={handleBulkCountChange}
                        styles={styles}
                        accentColor={sectionAccentColor}
                      />
                      {index < activeGroup.sections.length - 1 && (
                        <View style={styles.cardBDivider} />
                      )}
                    </React.Fragment>
                  );
                }

                // Skill slots → Section + RoleChips
                const sectionFactionColorKey = FACTION_COLOR_MAP[sectionFaction] ?? 'villager';
                return (
                  <React.Fragment key={section.title}>
                    {index > 0 && <View style={styles.cardBDivider} />}
                    <Section title={section.title} styles={styles}>
                      {section.roles.flatMap(expandSlotToChipEntries).map((entry) => (
                        <RoleChip
                          key={entry.key}
                          id={entry.key}
                          label={entry.label}
                          selected={!!selection[entry.key]}
                          onToggle={toggleRole}
                          styles={styles}
                          factionColor={sectionFactionColorKey}
                          accentColor={sectionAccentColor}
                        />
                      ))}
                    </Section>
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}

      {/* Bottom Create Button */}
      <View style={styles.bottomCreateBar}>
        <TouchableOpacity
          style={[styles.bottomCreateBtn, isDisabled && styles.bottomCreateBtnDisabled]}
          onPress={handleCreateRoom}
          activeOpacity={isDisabled ? 1 : 0.7}
          accessibilityState={{ disabled: isDisabled }}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.bottomCreateBtnText}>{isEditMode ? '保存配置' : '创建房间'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Settings Sheet (Animation + BGM) */}
      <SettingsSheet
        visible={settingsSheetVisible}
        onClose={handleCloseSettings}
        roleRevealAnimation={roleRevealAnimation}
        bgmValue={bgmEnabled ? 'on' : 'off'}
        animationOptions={animationOptions}
        bgmOptions={bgmOptions}
        onAnimationChange={handleAnimationChange}
        onBgmChange={handleBgmChange}
        styles={styles}
      />

      {/* Template Dropdown Modal */}
      <TemplatePicker
        visible={templateDropdownVisible}
        onClose={handleCloseTemplateDropdown}
        options={templateOptions}
        selectedValue={selectedTemplate}
        onSelect={handleSelectTemplate}
        styles={styles}
      />
    </SafeAreaView>
  );
};
