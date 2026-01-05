import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { RoleName } from '../../constants/roles';
import { PRESET_TEMPLATES, createCustomTemplate } from '../../models/Template';
import { showAlert } from '../../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing } from '../../constants/theme';
import { styles } from './ConfigScreen.styles';

type RoleSelectionKey = string;

const getInitialSelection = (): Record<RoleSelectionKey, boolean> => ({
  wolf: true, wolf1: true, wolf2: true, wolf3: true, wolf4: false,
  wolfQueen: false, wolfKing: false, darkWolfKing: false, gargoyle: false, nightmare: false,
  bloodMoon: false, wolfRobot: false,
  villager: true, villager1: true, villager2: true, villager3: true, villager4: false,
  seer: true, witch: true, hunter: true, guard: false, idiot: true,
  graveyardKeeper: false, slacker: false, knight: false,
  celebrity: false, magician: false,
  tree: false, witcher: false, psychic: false,
});

const selectionToRoles = (selection: Record<string, boolean>): RoleName[] => {
  const roles: RoleName[] = [];
  Object.entries(selection).forEach(([key, selected]) => {
    if (selected) {
      const roleName = key.replace(/\d+$/, '') as RoleName;
      roles.push(roleName);
    }
  });
  return roles;
};

const applyPreset = (presetRoles: RoleName[]): Record<string, boolean> => {
  const selection = getInitialSelection();
  Object.keys(selection).forEach((key) => { selection[key] = false; });
  const roleCounts: Record<string, number> = {};
  presetRoles.forEach((role) => { roleCounts[role] = (roleCounts[role] || 0) + 1; });
  Object.entries(roleCounts).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      const key = i === 0 ? role : `${role}${i}`;
      if (key in selection) selection[key] = true;
    }
  });
  return selection;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);

  const selectedCount = Object.values(selection).filter(Boolean).length;

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
    setIsCreating(true);
    try {
      const template = createCustomTemplate(roles);
      const roomNumber = Math.floor(1000 + Math.random() * 9000).toString();
      // Save as last room for "返回上局" feature
      await AsyncStorage.setItem('lastRoomNumber', roomNumber);
      navigation.navigate('Room', { roomNumber, isHost: true, template });
    } catch {
      showAlert('错误', '创建房间失败');
    } finally {
      setIsCreating(false);
    }
  }, [selection, navigation]);

  const RoleChip = ({ id, label, selected }: { id: string; label: string; selected: boolean }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => toggleRole(id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipContainer}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>创建房间</Text>
          <Text style={styles.subtitle}>{selectedCount} 名玩家</Text>
        </View>
        <TouchableOpacity 
          style={[styles.headerBtn, styles.createBtn]} 
          onPress={handleCreateRoom} 
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.createBtnText}>创建</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Presets */}
        <View style={styles.card}>
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
          <Section title="�� 狼人">
            <RoleChip id="wolf" label="普狼" selected={selection.wolf} />
            <RoleChip id="wolf1" label="普狼" selected={selection.wolf1} />
            <RoleChip id="wolf2" label="普狼" selected={selection.wolf2} />
            <RoleChip id="wolf3" label="普狼" selected={selection.wolf3} />
            <RoleChip id="wolf4" label="普狼" selected={selection.wolf4} />
          </Section>

          <Section title="🎭 技能狼">
            <RoleChip id="wolfQueen" label="狼美人" selected={selection.wolfQueen} />
            <RoleChip id="wolfKing" label="白狼王" selected={selection.wolfKing} />
            <RoleChip id="darkWolfKing" label="黑狼王" selected={selection.darkWolfKing} />
            <RoleChip id="gargoyle" label="石像鬼" selected={selection.gargoyle} />
            <RoleChip id="nightmare" label="梦魇" selected={selection.nightmare} />
            <RoleChip id="bloodMoon" label="血月使徒" selected={selection.bloodMoon} />
            <RoleChip id="wolfRobot" label="机械狼" selected={selection.wolfRobot} />
          </Section>

          <Section title="👤 村民">
            <RoleChip id="villager" label="村民" selected={selection.villager} />
            <RoleChip id="villager1" label="村民" selected={selection.villager1} />
            <RoleChip id="villager2" label="村民" selected={selection.villager2} />
            <RoleChip id="villager3" label="村民" selected={selection.villager3} />
            <RoleChip id="villager4" label="村民" selected={selection.villager4} />
          </Section>

          <Section title="✨ 神职">
            <RoleChip id="seer" label="预言家" selected={selection.seer} />
            <RoleChip id="witch" label="女巫" selected={selection.witch} />
            <RoleChip id="hunter" label="猎人" selected={selection.hunter} />
            <RoleChip id="guard" label="守卫" selected={selection.guard} />
            <RoleChip id="idiot" label="白痴" selected={selection.idiot} />
            <RoleChip id="graveyardKeeper" label="守墓人" selected={selection.graveyardKeeper} />
            <RoleChip id="knight" label="骑士" selected={selection.knight} />
            <RoleChip id="celebrity" label="摄梦人" selected={selection.celebrity} />
            <RoleChip id="magician" label="魔术师" selected={selection.magician} />
            <RoleChip id="witcher" label="猎魔人" selected={selection.witcher} />
            <RoleChip id="psychic" label="通灵师" selected={selection.psychic} />
          </Section>

          <Section title="🎲 特殊">
            <RoleChip id="slacker" label="混子" selected={selection.slacker} />
          </Section>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ConfigScreen;
