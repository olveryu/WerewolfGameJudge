import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { RoleId } from '../../models/roles';
import {
  PRESET_TEMPLATES,
  createCustomTemplate,
  validateTemplateRoles,
  findMatchingPresetName,
} from '../../models/Template';
import { useGameFacade } from '../../contexts';
import { showAlert } from '../../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, spacing, borderRadius, typography, shadows, ThemeColors } from '../../theme';
import { TESTIDS } from '../../testids';
import { configLog } from '../../utils/logger';
import { LoadingScreen } from '../../components/LoadingScreen';
import { generateRoomCode } from '../../utils/roomCode';
import SettingsService from '../../services/infra/SettingsService';

// ============================================
// Styles factory
// ============================================
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: spacing.xlarge + spacing.small, // 40
      height: spacing.xlarge + spacing.small, // 40
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBtnText: {
      fontSize: typography.title,
      color: colors.text,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginTop: spacing.tight / 2,
    },
    createBtn: {
      backgroundColor: colors.primary,
      width: spacing.xlarge + spacing.large + spacing.tight, // 60
    },
    createBtnText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
    // Settings row (template + animation selectors)
    settingsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.medium,
    },
    settingsItem: {
      flex: 1,
    },
    settingsLabel: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    settingsSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsSelectorText: {
      fontSize: typography.secondary,
      color: colors.text,
      flex: 1,
    },
    settingsSelectorArrow: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginLeft: spacing.tight,
    },
    scrollView: {
      flex: 1,
      padding: spacing.medium,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.small,
      marginBottom: spacing.small,
      ...shadows.sm,
    },
    cardTitle: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.small,
    },
    presetContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    presetBtn: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetText: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: spacing.small,
    },
    sectionTitle: {
      fontSize: typography.caption,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
    },
    chip: {
      minWidth: spacing.xxlarge + spacing.large, // ~72
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
    chipTextSelected: {
      color: colors.textInverse,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing.medium,
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingBottom: spacing.xlarge,
      maxHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
    },
    modalCloseBtn: {
      padding: spacing.small,
    },
    modalCloseBtnText: {
      fontSize: typography.title,
      color: colors.textSecondary,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalOptionSelected: {
      backgroundColor: colors.primaryLight + '20',
    },
    modalOptionText: {
      fontSize: typography.body,
      color: colors.text,
    },
    modalOptionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    modalOptionCheck: {
      fontSize: typography.body,
      color: colors.primary,
    },
  });

// ============================================
// Sub-components
// ============================================

interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
  colors: ThemeColors;
}

const RoleChip: React.FC<RoleChipProps> = ({ id, label, selected, onToggle, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      testID={`config-role-chip-${id}`}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => onToggle(id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}

const Section: React.FC<SectionProps> = ({ title, children, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipContainer}>{children}</View>
    </View>
  );
};

// Dropdown selector with Modal
interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  colors: ThemeColors;
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onSelect, colors }) => {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <View style={styles.settingsItem}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.settingsSelector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.settingsSelectorText} numberOfLines={1}>
          {selectedOption?.label ?? value}
        </Text>
        <Text style={styles.settingsSelectorArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVisible(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.modalOption, option.value === value && styles.modalOptionSelected]}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      option.value === value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.value === value && <Text style={styles.modalOptionCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ============================================
// Helper functions
// ============================================

const getInitialSelection = (): Record<string, boolean> => ({
  wolf: true,
  wolf1: true,
  wolf2: true,
  wolf3: true,
  wolf4: false,
  wolfQueen: false,
  wolfKing: false,
  darkWolfKing: false,
  gargoyle: false,
  nightmare: false,
  bloodMoon: false,
  wolfRobot: false,
  spiritKnight: false,
  villager: true,
  villager1: true,
  villager2: true,
  villager3: true,
  villager4: false,
  seer: true,
  witch: true,
  hunter: true,
  guard: false,
  idiot: true,
  graveyardKeeper: false,
  slacker: false,
  knight: false,
  dreamcatcher: false,
  magician: false,
  tree: false,
  witcher: false,
  psychic: false,
});

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

// ============================================
// Main Component
// ============================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomNumber = route.params?.existingRoomNumber;
  const isEditMode = !!existingRoomNumber;

  const settingsService = useRef(SettingsService.getInstance()).current;

  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [roleRevealAnimation, setRoleRevealAnimation] = useState<'roulette' | 'flip' | 'none'>(
    'roulette',
  );
  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]?.name ?? '');
  const [bgmEnabled, setBgmEnabled] = useState(true);

  const facade = useGameFacade();
  const selectedCount = Object.values(selection).filter(Boolean).length;

  // Load settings (animation + BGM) for new rooms
  useEffect(() => {
    if (!existingRoomNumber) {
      const lastChoice = settingsService.getRoleRevealAnimation();
      setRoleRevealAnimation(lastChoice);
      // Load BGM setting from SettingsService
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
          // Sync selected template dropdown with current roles
          const matchedPreset = findMatchingPresetName(state.templateRoles);
          setSelectedTemplate(matchedPreset ?? '__custom__');
        }
        // Load role reveal animation setting
        if (state?.roleRevealAnimation) {
          setRoleRevealAnimation(state.roleRevealAnimation);
        }
        // Load BGM setting from SettingsService (global setting)
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

  const toggleRole = useCallback((key: string) => {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
    // When user manually changes roles, switch to "自定义"
    setSelectedTemplate('__custom__');
  }, []);

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (preset) setSelection(applyPreset(preset.roles));
  }, []);

  const handleCreateRoom = useCallback(async () => {
    // Guard: prevent action when loading/creating
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

      // Save BGM setting (global setting via SettingsService)
      await settingsService.setBgmEnabled(bgmEnabled);

      if (isEditMode && existingRoomNumber) {
        const result = await facade.updateTemplate(template);
        if (!result.success) {
          showAlert('错误', result.reason ?? '更新房间失败');
          return;
        }
        // Update role reveal animation
        await facade.setRoleRevealAnimation(roleRevealAnimation);
        navigation.goBack();
      } else {
        // Save as default for next time (only for new rooms)
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

  // Dropdown options
  const templateOptions: DropdownOption[] = useMemo(
    () => [
      ...PRESET_TEMPLATES.map((p) => ({ value: p.name, label: p.name })),
      { value: '__custom__', label: '自定义' },
    ],
    [],
  );

  const animationOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'roulette', label: '🎰 轮盘' },
      { value: 'flip', label: '🃏 翻牌' },
      { value: 'none', label: '⚡ 无' },
    ],
    [],
  );

  const handleTemplateChange = useCallback(
    (templateName: string) => {
      setSelectedTemplate(templateName);
      // Only apply preset if not selecting "自定义"
      if (templateName !== '__custom__') {
        handlePresetSelect(templateName);
      }
    },
    [handlePresetSelect],
  );

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{isEditMode ? '修改配置' : '创建房间'}</Text>
          <Text style={styles.subtitle}>{selectedCount} 名玩家</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.headerBtn,
            styles.createBtn,
            (isCreating || isLoading) && { opacity: 0.5 },
          ]}
          onPress={handleCreateRoom}
          activeOpacity={isCreating || isLoading ? 1 : 0.7}
          accessibilityState={{ disabled: isCreating || isLoading }}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.createBtnText}>{isEditMode ? '保存' : '创建'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Settings Row (Template + Animation + BGM) */}
      <View style={styles.settingsRow}>
        <Dropdown
          label="模板"
          value={selectedTemplate}
          options={templateOptions}
          onSelect={handleTemplateChange}
          colors={colors}
        />
        <Dropdown
          label="动画"
          value={roleRevealAnimation}
          options={animationOptions}
          onSelect={(v) => setRoleRevealAnimation(v as 'roulette' | 'flip' | 'none')}
          colors={colors}
        />
        <Dropdown
          label="🎵 BGM"
          value={bgmEnabled ? 'on' : 'off'}
          options={[
            { value: 'on', label: '开' },
            { value: 'off', label: '关' },
          ]}
          onSelect={(v) => setBgmEnabled(v === 'on')}
          colors={colors}
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="加载中..." fullScreen={false} />
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* 🐺 狼人阵营 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🐺 狼人阵营</Text>

            <Section title="普通狼人" colors={colors}>
              <RoleChip
                id="wolf"
                label="狼人"
                selected={selection.wolf}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf1"
                label="狼人"
                selected={selection.wolf1}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf2"
                label="狼人"
                selected={selection.wolf2}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf3"
                label="狼人"
                selected={selection.wolf3}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf4"
                label="狼人"
                selected={selection.wolf4}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>

            <Section title="技能狼" colors={colors}>
              <RoleChip
                id="wolfQueen"
                label="狼美人"
                selected={selection.wolfQueen}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolfKing"
                label="白狼王"
                selected={selection.wolfKing}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="darkWolfKing"
                label="黑狼王"
                selected={selection.darkWolfKing}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="gargoyle"
                label="石像鬼"
                selected={selection.gargoyle}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="nightmare"
                label="梦魇"
                selected={selection.nightmare}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="bloodMoon"
                label="血月使徒"
                selected={selection.bloodMoon}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolfRobot"
                label="机械狼"
                selected={selection.wolfRobot}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="spiritKnight"
                label="恶灵骑士"
                selected={selection.spiritKnight}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>
          </View>

          {/* 👥 好人阵营 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 好人阵营</Text>

            <Section title="普通村民" colors={colors}>
              <RoleChip
                id="villager"
                label="村民"
                selected={selection.villager}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="villager1"
                label="村民"
                selected={selection.villager1}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="villager2"
                label="村民"
                selected={selection.villager2}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="villager3"
                label="村民"
                selected={selection.villager3}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="villager4"
                label="村民"
                selected={selection.villager4}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>

            <Section title="神职" colors={colors}>
              <RoleChip
                id="seer"
                label="预言家"
                selected={selection.seer}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="witch"
                label="女巫"
                selected={selection.witch}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="hunter"
                label="猎人"
                selected={selection.hunter}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="guard"
                label="守卫"
                selected={selection.guard}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="idiot"
                label="白痴"
                selected={selection.idiot}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="graveyardKeeper"
                label="守墓人"
                selected={selection.graveyardKeeper}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="knight"
                label="骑士"
                selected={selection.knight}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="dreamcatcher"
                label="摄梦人"
                selected={selection.dreamcatcher}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="magician"
                label="魔术师"
                selected={selection.magician}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="witcher"
                label="猎魔人"
                selected={selection.witcher}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="psychic"
                label="通灵师"
                selected={selection.psychic}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>
          </View>

          {/* ⚖️ 中立阵营 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚖️ 中立阵营</Text>
            <View style={styles.chipContainer}>
              <RoleChip
                id="slacker"
                label="混子"
                selected={selection.slacker}
                onToggle={toggleRole}
                colors={colors}
              />
            </View>
          </View>

          <View style={{ height: spacing.xxlarge }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ConfigScreen;
