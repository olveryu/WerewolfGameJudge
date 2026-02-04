/**
 * ConfigScreen - Game configuration and room creation
 *
 * Performance optimizations:
 * - Styles created once in parent and passed to all sub-components
 * - All sub-components memoized with custom arePropsEqual
 * - Handlers use useCallback to maintain stable references
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { useColors, spacing } from '../../theme';
import { TESTIDS } from '../../testids';
import { configLog } from '../../utils/logger';
import { LoadingScreen } from '../../components/LoadingScreen';
import { generateRoomCode } from '../../utils/roomCode';
import SettingsService from '../../services/infra/SettingsService';
import type { RoleRevealAnimation } from '../../services/types/RoleRevealAnimation';
import {
  RoleChip,
  Section,
  Dropdown,
  createConfigScreenStyles,
  type DropdownOption,
} from './components';

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
  const selectedCount = Object.values(selection).filter(Boolean).length;

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

  // Dropdown options
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
      { value: 'fire', label: '🔥 火焰' },
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

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.configScreenRoot}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleGoBack}>
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
          styles={styles}
        />
        <Dropdown
          label="动画"
          value={roleRevealAnimation}
          options={animationOptions}
          onSelect={handleAnimationChange}
          styles={styles}
        />
        <Dropdown
          label="🎵 BGM"
          value={bgmEnabled ? 'on' : 'off'}
          options={bgmOptions}
          onSelect={handleBgmChange}
          styles={styles}
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="加载中..." fullScreen={false} />
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* 🐺 狼人阵营 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🐺 狼人阵营</Text>

            <Section title="普通狼人" styles={styles}>
              <RoleChip
                id="wolf"
                label="狼人"
                selected={selection.wolf}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolf1"
                label="狼人"
                selected={selection.wolf1}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolf2"
                label="狼人"
                selected={selection.wolf2}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolf3"
                label="狼人"
                selected={selection.wolf3}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolf4"
                label="狼人"
                selected={selection.wolf4}
                onToggle={toggleRole}
                styles={styles}
              />
            </Section>

            <Section title="技能狼" styles={styles}>
              <RoleChip
                id="wolfQueen"
                label="狼美人"
                selected={selection.wolfQueen}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolfKing"
                label="白狼王"
                selected={selection.wolfKing}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="darkWolfKing"
                label="黑狼王"
                selected={selection.darkWolfKing}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="gargoyle"
                label="石像鬼"
                selected={selection.gargoyle}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="nightmare"
                label="梦魇"
                selected={selection.nightmare}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="bloodMoon"
                label="血月使徒"
                selected={selection.bloodMoon}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="wolfRobot"
                label="机械狼"
                selected={selection.wolfRobot}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="spiritKnight"
                label="恶灵骑士"
                selected={selection.spiritKnight}
                onToggle={toggleRole}
                styles={styles}
              />
            </Section>
          </View>

          {/* 👥 好人阵营 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 好人阵营</Text>

            <Section title="普通村民" styles={styles}>
              <RoleChip
                id="villager"
                label="村民"
                selected={selection.villager}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="villager1"
                label="村民"
                selected={selection.villager1}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="villager2"
                label="村民"
                selected={selection.villager2}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="villager3"
                label="村民"
                selected={selection.villager3}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="villager4"
                label="村民"
                selected={selection.villager4}
                onToggle={toggleRole}
                styles={styles}
              />
            </Section>

            <Section title="神职" styles={styles}>
              <RoleChip
                id="seer"
                label="预言家"
                selected={selection.seer}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="witch"
                label="女巫"
                selected={selection.witch}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="hunter"
                label="猎人"
                selected={selection.hunter}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="guard"
                label="守卫"
                selected={selection.guard}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="idiot"
                label="白痴"
                selected={selection.idiot}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="graveyardKeeper"
                label="守墓人"
                selected={selection.graveyardKeeper}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="knight"
                label="骑士"
                selected={selection.knight}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="dreamcatcher"
                label="摄梦人"
                selected={selection.dreamcatcher}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="magician"
                label="魔术师"
                selected={selection.magician}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="witcher"
                label="猎魔人"
                selected={selection.witcher}
                onToggle={toggleRole}
                styles={styles}
              />
              <RoleChip
                id="psychic"
                label="通灵师"
                selected={selection.psychic}
                onToggle={toggleRole}
                styles={styles}
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
                styles={styles}
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
