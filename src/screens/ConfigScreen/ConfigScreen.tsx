/**
 * ConfigScreen - Game configuration and room creation
 *
 * Performance optimizations:
 * - Styles created once in parent and passed to all sub-components
 * - All sub-components memoized with custom arePropsEqual
 * - Handlers use useCallback to maintain stable references
 * - Role list is data-driven from FACTION_GROUPS + ROLE_SPECS (no hand-written chips)
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { RoleId, ROLE_SPECS, Faction } from '../../models/roles';
import {
  PRESET_TEMPLATES,
  createCustomTemplate,
  validateTemplateRoles,
  findMatchingPresetName,
} from '../../models/Template';
import { useGameFacade } from '../../contexts';
import { showAlert } from '../../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, spacing } from '../../theme';
import { TESTIDS } from '../../testids';
import { configLog } from '../../utils/logger';
import { LoadingScreen } from '../../components/LoadingScreen';
import { generateRoomCode } from '../../utils/roomCode';
import SettingsService from '../../services/infra/SettingsService';
import type { RoleRevealAnimation } from '../../services/types/RoleRevealAnimation';
import {
  RoleChip,
  RoleStepper,
  Section,
  Dropdown,
  FactionPanel,
  createConfigScreenStyles,
  type DropdownOption,
  type FactionColorKey,
} from './components';
import { FACTION_GROUPS, buildInitialSelection } from './configData';

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
const expandSlotToChipEntries = (
  slot: { roleId: string; count?: number },
): { key: string; label: string }[] => {
  const count = slot.count ?? 1;
  const spec = ROLE_SPECS[slot.roleId as keyof typeof ROLE_SPECS];
  const label = spec?.displayName ?? slot.roleId;

  return Array.from({ length: count }, (_, i) => ({
    key: i === 0 ? slot.roleId : `${slot.roleId}${i}`,
    label,
  }));
};

/** Check if a faction group has any selected roles in the given selection */
const factionHasSelected = (
  group: (typeof FACTION_GROUPS)[number],
  sel: Record<string, boolean>,
): boolean => {
  for (const section of group.sections) {
    for (const slot of section.roles) {
      const count = slot.count ?? 1;
      for (let i = 0; i < count; i++) {
        const key = i === 0 ? slot.roleId : `${slot.roleId}${i}`;
        if (sel[key]) return true;
      }
    }
  }
  return false;
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
    const addListener = (
      navigation as unknown as { addListener?: (event: string, cb: () => void) => () => void }
    ).addListener;

    if (!addListener) {
      return;
    }

    const unsubscribe = addListener('focus', () => {
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
        const roomNumber = generateRoomCode();
        await AsyncStorage.setItem('lastRoomNumber', roomNumber);
        navigation.navigate('Room', {
          roomNumber,
          isHost: true,
          template,
          roleRevealAnimation,
        });
      }
    } catch {
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
  ]);

  // Template dropdown options
  const templateOptions: DropdownOption[] = useMemo(
    () => [
      ...PRESET_TEMPLATES.map((p) => ({ value: p.name, label: p.name })),
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
  // Collapsible panels state
  // ============================================

  const [expandedFactions, setExpandedFactions] = useState<Record<string, boolean>>(() => {
    const initialSel = getInitialSelection();
    const initial: Record<string, boolean> = {};
    FACTION_GROUPS.forEach((g) => {
      initial[g.faction] = factionHasSelected(g, initialSel);
    });
    return initial;
  });

  const handleToggleExpand = useCallback((factionKey: string) => {
    setExpandedFactions((prev) => ({ ...prev, [factionKey]: !prev[factionKey] }));
  }, []);

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

  const handleBulkCountChange = useCallback(
    (roleId: string, newCount: number) => {
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
    },
    [],
  );

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

  const isDisabled = isCreating || isLoading;

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header — back + title + create */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{isEditMode ? '修改配置' : '创建房间'}</Text>
          <Text style={styles.subtitle}>{totalCount} 名玩家</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerCreateBtn, isDisabled && styles.headerCreateBtnDisabled]}
          onPress={handleCreateRoom}
          activeOpacity={isDisabled ? 1 : 0.7}
          accessibilityState={{ disabled: isDisabled }}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.headerCreateBtnText}>
              {isEditMode ? '保存' : '创建'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Settings Row (Template + Animation + BGM) */}
      <View style={styles.settingsRow}>
        <Dropdown
          label="板子"
          value={selectedTemplate}
          options={templateOptions}
          onSelect={handleTemplateChange}
          styles={styles}
        />
        <Dropdown
          label="发牌动画"
          value={roleRevealAnimation}
          options={animationOptions}
          onSelect={handleAnimationChange}
          styles={styles}
        />
        <Dropdown
          label="BGM"
          value={bgmEnabled ? 'on' : 'off'}
          options={bgmOptions}
          onSelect={handleBgmChange}
          styles={styles}
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="加载中..." fullScreen={false} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.large }}
        >
          {/* Data-driven collapsible faction panels */}
          {FACTION_GROUPS.map((group) => {
            const factionColorKey = FACTION_COLOR_MAP[group.faction] ?? 'good';
            const accentColor = getFactionAccentColor(group.faction);
            const selectedCount = getFactionSelectedCount(group);

            return (
              <FactionPanel
                key={group.faction}
                factionKey={group.faction}
                emoji={group.emoji}
                title={group.title}
                count={selectedCount}
                accentColor={accentColor}
                expanded={!!expandedFactions[group.faction]}
                onToggleExpand={handleToggleExpand}
                styles={styles}
              >
                {group.sections.map((section) => {
                  // Bulk slot → RoleStepper
                  const bulkSlot = section.roles.find((s) => s.isBulk);
                  if (bulkSlot) {
                    const maxCount = bulkSlot.count ?? 1;
                    const currentCount = getBulkCount(bulkSlot.roleId, maxCount);
                    const spec = ROLE_SPECS[bulkSlot.roleId as keyof typeof ROLE_SPECS];
                    return (
                      <RoleStepper
                        key={section.title}
                        roleId={bulkSlot.roleId}
                        label={spec?.displayName ?? bulkSlot.roleId}
                        count={currentCount}
                        maxCount={maxCount}
                        onCountChange={handleBulkCountChange}
                        styles={styles}
                        accentColor={accentColor}
                      />
                    );
                  }

                  // Skill slots → Section + RoleChips
                  return (
                    <Section key={section.title} title={section.title} styles={styles}>
                      {section.roles.flatMap(expandSlotToChipEntries).map((entry) => (
                        <RoleChip
                          key={entry.key}
                          id={entry.key}
                          label={entry.label}
                          selected={!!selection[entry.key]}
                          onToggle={toggleRole}
                          styles={styles}
                          factionColor={factionColorKey}
                        />
                      ))}
                    </Section>
                  );
                })}
              </FactionPanel>
            );
          })}
        </ScrollView>
      )}

    </SafeAreaView>
  );
};

export default ConfigScreen;
