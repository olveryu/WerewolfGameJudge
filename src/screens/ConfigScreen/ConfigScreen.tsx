/**
 * ConfigScreen - 游戏配置与房间创建
 *
 * 角色列表由 FACTION_GROUPS + ROLE_SPECS 数据驱动。性能优化同 HomeScreen。
 *
 * ✅ 允许：编排子组件、调用 service/navigation/showAlert
 * ❌ 禁止：硬编码样式值 / console.*
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { RoleId, ROLE_SPECS, Faction } from '@/models/roles';
import {
  PRESET_TEMPLATES,
  createCustomTemplate,
  validateTemplateRoles,
  findMatchingPresetName,
} from '@/models/Template';
import { useGameFacade } from '@/contexts';
import { showAlert } from '@/utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, spacing, typography } from '@/theme';
import { TESTIDS } from '@/testids';
import { configLog } from '@/utils/logger';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useGameRoom } from '@/hooks/useGameRoom';
import { SettingsService } from '@/services/feature/SettingsService';
import type { RoleRevealAnimation } from '@/types/RoleRevealAnimation';
import {
  RoleChip,
  RoleStepper,
  Section,
  FactionTabs,
  Dropdown,
  createConfigScreenStyles,
  type DropdownOption,
  type FactionColorKey,
  type FactionTabItem,
} from './components';
import { FACTION_GROUPS, buildInitialSelection } from './configData';
import { Ionicons } from '@expo/vector-icons';

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
  [Faction.God]: 'good',
  [Faction.Villager]: 'good',
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

  const settingsService = useRef(SettingsService.getInstance()).current;
  const { createRoomRecord } = useGameRoom();

  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [roleRevealAnimation, setRoleRevealAnimation] = useState<RoleRevealAnimation>('random');
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]?.name ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(true);

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
    navigation.goBack();
  }, [navigation]);

  const toggleRole = useCallback((key: string) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    setSelectedTemplate('__custom__');
  }, []);

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (preset) setSelection(applyPreset(preset.roles));
  }, []);

  const handleCreateRoom = useCallback(async () => {
    if (isCreating || isLoading) return;

    const roles = selectionToRoles(selection);
    if (roles.length === 0) {
      showAlert('错误', '请至少选择一个角色');
      return;
    }

    const validationError = validateTemplateRoles(roles);
    if (validationError) {
      showAlert('配置不合法', validationError);
      return;
    }

    setIsCreating(true);
    try {
      const template = createCustomTemplate(roles);

      await settingsService.setBgmEnabled(bgmEnabled);

      if (isEditMode && existingRoomNumber) {
        const result = await facade.updateTemplate(template);
        if (!result.success) {
          showAlert('错误', result.reason ?? '更新房间失败');
          return;
        }
        await facade.setRoleRevealAnimation(roleRevealAnimation);
        navigation.goBack();
      } else {
        await settingsService.setRoleRevealAnimation(roleRevealAnimation);
        // Create room record in DB first — get confirmed/final roomNumber
        const roomNumber = await createRoomRecord();
        if (!roomNumber) {
          showAlert('错误', '创建房间失败');
          return;
        }
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
      showAlert('错误', isEditMode ? '更新房间失败' : '创建房间失败');
    } finally {
      setIsCreating(false);
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
    isCreating,
    isLoading,
    createRoomRecord,
  ]);

  // Template dropdown options (short display names, strip "12人" suffix)
  const templateOptions: DropdownOption[] = useMemo(
    () => [
      ...PRESET_TEMPLATES.map((p) => ({
        value: p.name,
        label: p.name.replace(/\d+人$/, ''),
      })),
      { value: '__custom__', label: '自定义' },
    ],
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
          return colors.god; // same as god for the "good" side
        case Faction.Special:
          return colors.warning;
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
          icon: <Ionicons name={group.iconName as keyof typeof Ionicons.glyphMap} size={14} color={accentColor} />,
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

  const activeAccentColor = getFactionAccentColor(activeGroup.faction);
  const activeFactionColorKey = FACTION_COLOR_MAP[activeGroup.faction] ?? 'good';

  const isDisabled = isCreating || isLoading;

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header row 1 — ← | 配置 | ⚙️ */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleGoBack}
          testID={TESTIDS.configBackButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>配置</Text>
        </View>
        <TouchableOpacity
          style={styles.headerGearBtn}
          onPress={handleOpenSettings}
          activeOpacity={0.7}
          testID="config-gear-btn"
        >
          <Ionicons name="settings-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Card A — template selector + faction tabs */}
      <View style={styles.cardA}>
        {/* Template pill + player count */}
        <View style={styles.templateRow}>
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

        {/* Divider */}
        <View style={styles.cardADivider} />

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
                        accentColor={activeAccentColor}
                      />
                      {index < activeGroup.sections.length - 1 && (
                        <View style={styles.cardBDivider} />
                      )}
                    </React.Fragment>
                  );
                }

                // Skill slots → Section + RoleChips
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
                          factionColor={activeFactionColorKey}
                          accentColor={activeAccentColor}
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
      <Modal
        visible={settingsSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseSettings}
      >
        <TouchableOpacity
          style={styles.settingsSheetOverlay}
          activeOpacity={1}
          onPress={handleCloseSettings}
          testID="config-settings-overlay"
        >
          <View style={styles.settingsSheetContent}>
            <View style={styles.settingsSheetHandle} />
            <Text style={styles.settingsSheetTitle}>设置</Text>
            <View style={styles.settingsRow}>
              <Dropdown
                label="动画"
                value={roleRevealAnimation}
                options={animationOptions}
                onSelect={handleAnimationChange}
                styles={styles}
                testID="config-animation"
              />
              <Dropdown
                label="BGM"
                value={bgmEnabled ? 'on' : 'off'}
                options={bgmOptions}
                onSelect={handleBgmChange}
                styles={styles}
                testID="config-bgm"
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Template Dropdown Modal */}
      <Modal
        visible={templateDropdownVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseTemplateDropdown}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseTemplateDropdown}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择板子</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleCloseTemplateDropdown}>
                <Ionicons name="close" size={typography.title} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {templateOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    option.value === selectedTemplate && styles.modalOptionSelected,
                  ]}
                  onPress={() => handleSelectTemplate(option.value)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      option.value === selectedTemplate && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === selectedTemplate && (
                    <Ionicons name="checkmark" size={typography.body} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};
