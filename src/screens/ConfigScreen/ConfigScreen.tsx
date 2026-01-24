import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
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
} from '../../models/Template';
import { useGameFacade } from '../../contexts';
import { showAlert } from '../../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors, spacing, borderRadius, typography, shadows, ThemeColors } from '../../theme';
import { TESTIDS } from '../../testids';
import { configLog } from '../../utils/logger';

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
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBtnText: {
      fontSize: 20,
      color: colors.text,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      fontSize: typography.lg,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    createBtn: {
      backgroundColor: colors.primary,
      width: 60,
    },
    createBtnText: {
      color: colors.textInverse,
      fontSize: typography.sm,
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
      padding: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    cardTitle: {
      fontSize: typography.base,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.md,
    },
    presetContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    presetBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sm,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: typography.sm,
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
      marginTop: spacing.md,
      fontSize: typography.base,
      color: colors.textSecondary,
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

  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);

  const facade = useGameFacade();
  const selectedCount = Object.values(selection).filter(Boolean).length;

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
        }
      } catch (error) {
        configLog.error(' Failed to load room:', error);
      } finally {
        configLog.debug(' Setting isLoading=false');
        setIsLoading(false);
      }
    };

    loadCurrentRoles();
  }, [isEditMode, existingRoomNumber, facade]);

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
  }, []);

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
    if (preset) setSelection(applyPreset(preset.roles));
  }, []);

  const handleCreateRoom = useCallback(async () => {
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

      if (isEditMode && existingRoomNumber) {
        const result = await facade.updateTemplate(template);
        if (!result.success) {
          showAlert('错误', result.reason ?? '更新房间失败');
          return;
        }
        navigation.goBack();
      } else {
        const roomNumber = Math.floor(1000 + Math.random() * 9000).toString();
        await AsyncStorage.setItem('lastRoomNumber', roomNumber);
        navigation.navigate('Room', { roomNumber, isHost: true, template });
      }
    } catch {
      showAlert('错误', isEditMode ? '更新房间失败' : '创建房间失败');
    } finally {
      setIsCreating(false);
    }
  }, [selection, navigation, isEditMode, existingRoomNumber, facade]);

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
          style={[styles.headerBtn, styles.createBtn]}
          onPress={handleCreateRoom}
          disabled={isCreating || isLoading}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.createBtnText}>{isEditMode ? '保存' : '创建'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Presets */}
          <View style={styles.card} testID={TESTIDS.configPresetSection}>
            <Text style={styles.cardTitle}>快速模板</Text>
            <View style={styles.presetContainer}>
              {PRESET_TEMPLATES.map((preset) => (
                <TouchableOpacity
                  key={preset.name}
                  style={styles.presetBtn}
                  onPress={() => handlePresetSelect(preset.name)}
                >
                  <Text style={styles.presetText}>{preset.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Roles */}
          <View style={styles.card}>
            <Section title="🐺 狼人" colors={colors}>
              <RoleChip
                id="wolf"
                label="普狼"
                selected={selection.wolf}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf1"
                label="普狼"
                selected={selection.wolf1}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf2"
                label="普狼"
                selected={selection.wolf2}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf3"
                label="普狼"
                selected={selection.wolf3}
                onToggle={toggleRole}
                colors={colors}
              />
              <RoleChip
                id="wolf4"
                label="普狼"
                selected={selection.wolf4}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>

            <Section title="🎭 技能狼" colors={colors}>
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

            <Section title="👤 村民" colors={colors}>
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

            <Section title="✨ 神职" colors={colors}>
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

            <Section title="🎲 特殊" colors={colors}>
              <RoleChip
                id="slacker"
                label="混子"
                selected={selection.slacker}
                onToggle={toggleRole}
                colors={colors}
              />
            </Section>
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default ConfigScreen;
