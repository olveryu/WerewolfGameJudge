import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { RoleName } from '../../constants/roles';
import { PRESET_TEMPLATES, createCustomTemplate } from '../../models/Template';
import { RoomService } from '../../services/RoomService';
import { AuthService } from '../../services/AuthService';
import { SeatService } from '../../services/SeatService';
import { showAlert } from '../../utils/alert';
import { PromptModal } from '../../components/PromptModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, colors } from '../../constants/theme';
import { styles } from './ConfigScreen.styles';

// Bot mode password
const BOT_MODE_PASSWORD = '469022042';

// ============================================
// Sub-components (extracted to avoid nested component definitions)
// ============================================

interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

const RoleChip: React.FC<RoleChipProps> = ({ id, label, selected, onToggle }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={() => onToggle(id)}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.chipContainer}>{children}</View>
  </View>
);

// ============================================
// Helper functions
// ============================================

const getInitialSelection = (): Record<string, boolean> => ({
  wolf: true, wolf1: true, wolf2: true, wolf3: true, wolf4: false,
  wolfQueen: false, wolfKing: false, darkWolfKing: false, gargoyle: false, nightmare: false,
  bloodMoon: false, wolfRobot: false, spiritKnight: false,
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

// ============================================
// Main Component
// ============================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;
type ConfigRouteProp = RouteProp<RootStackParamList, 'Config'>;

export const ConfigScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ConfigRouteProp>();
  const existingRoomNumber = route.params?.existingRoomNumber;
  const isEditMode = !!existingRoomNumber;
  
  const [selection, setSelection] = useState(getInitialSelection);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isFillingBots, setIsFillingBots] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const roomService = RoomService.getInstance();
  const authService = AuthService.getInstance();
  const seatService = SeatService.getInstance();
  const selectedCount = Object.values(selection).filter(Boolean).length;

  // Load current room's roles when in edit mode
  useEffect(() => {
    console.log('[ConfigScreen] useEffect triggered, isEditMode:', isEditMode, 'existingRoomNumber:', existingRoomNumber);
    if (!isEditMode || !existingRoomNumber) {
      console.log('[ConfigScreen] Skipping load - not in edit mode or no room number');
      return;
    }
    
    const loadCurrentRoles = async () => {
      console.log('[ConfigScreen] Loading room:', existingRoomNumber);
      try {
        const room = await roomService.getRoom(existingRoomNumber);
        console.log('[ConfigScreen] Room loaded:', room ? 'success' : 'not found');
        if (room) {
          setSelection(applyPreset(room.template.roles));
        }
      } catch (error) {
        console.error('[ConfigScreen] Failed to load room:', error);
      } finally {
        console.log('[ConfigScreen] Setting isLoading=false');
        setIsLoading(false);
      }
    };
    
    loadCurrentRoles();
  }, [isEditMode, existingRoomNumber, roomService]);

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
      
      if (isEditMode && existingRoomNumber) {
        // Update existing room with new template using V2 RPC
        const currentUserId = authService.getCurrentUserId();
        if (currentUserId) {
          const result = await roomService.updateRolesArray(
            existingRoomNumber,
            template.roles,
            currentUserId
          );
          if (!result.success) {
            console.error('[ConfigScreen] updateRolesArray failed:', result.error);
            showAlert('错误', result.error ?? '更新房间失败');
            return;
          }
        }
        navigation.goBack();
      } else {
        // Create new room
        const roomNumber = Math.floor(1000 + Math.random() * 9000).toString();
        // Save as last room for "返回上局" feature
        await AsyncStorage.setItem('lastRoomNumber', roomNumber);
        navigation.navigate('Room', { roomNumber, isHost: true, template });
      }
    } catch {
      showAlert('错误', isEditMode ? '更新房间失败' : '创建房间失败');
    } finally {
      setIsCreating(false);
    }
  }, [selection, navigation, isEditMode, existingRoomNumber, roomService, authService]);

  const handleFillBots = useCallback(() => {
    if (!existingRoomNumber) return;
    setShowPasswordModal(true);
  }, [existingRoomNumber]);

  const handlePasswordConfirm = useCallback(async (password: string) => {
    setShowPasswordModal(false);
    if (!existingRoomNumber) return;
    
    if (password !== BOT_MODE_PASSWORD) {
      showAlert('错误', '密码错误');
      return;
    }
    
    setIsFillingBots(true);
    try {
      await seatService.fillWithBots(existingRoomNumber);
      showAlert('成功', '已填充机器人');
      navigation.goBack();
    } catch {
      showAlert('错误', '填充机器人失败');
    } finally {
      setIsFillingBots(false);
    }
  }, [existingRoomNumber, seatService, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{isEditMode ? '修改配置' : '创建房间'}</Text>
          <Text style={styles.subtitle}>{selectedCount} 名玩家</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isEditMode && (
            <TouchableOpacity 
              style={[styles.headerBtn, { backgroundColor: colors.warning }]} 
              onPress={handleFillBots} 
              disabled={isFillingBots}
            >
              {isFillingBots ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createBtnText}>🤖</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerBtn, styles.createBtn]} 
            onPress={handleCreateRoom} 
            disabled={isCreating || isLoading}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createBtnText}>{isEditMode ? '保存' : '创建'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : (
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
          <Section title="🐺 狼人">
            <RoleChip id="wolf" label="普狼" selected={selection.wolf} onToggle={toggleRole} />
            <RoleChip id="wolf1" label="普狼" selected={selection.wolf1} onToggle={toggleRole} />
            <RoleChip id="wolf2" label="普狼" selected={selection.wolf2} onToggle={toggleRole} />
            <RoleChip id="wolf3" label="普狼" selected={selection.wolf3} onToggle={toggleRole} />
            <RoleChip id="wolf4" label="普狼" selected={selection.wolf4} onToggle={toggleRole} />
          </Section>

          <Section title="🎭 技能狼">
            <RoleChip id="wolfQueen" label="狼美人" selected={selection.wolfQueen} onToggle={toggleRole} />
            <RoleChip id="wolfKing" label="白狼王" selected={selection.wolfKing} onToggle={toggleRole} />
            <RoleChip id="darkWolfKing" label="黑狼王" selected={selection.darkWolfKing} onToggle={toggleRole} />
            <RoleChip id="gargoyle" label="石像鬼" selected={selection.gargoyle} onToggle={toggleRole} />
            <RoleChip id="nightmare" label="梦魇" selected={selection.nightmare} onToggle={toggleRole} />
            <RoleChip id="bloodMoon" label="血月使徒" selected={selection.bloodMoon} onToggle={toggleRole} />
            <RoleChip id="wolfRobot" label="机械狼" selected={selection.wolfRobot} onToggle={toggleRole} />
            <RoleChip id="spiritKnight" label="恶灵骑士" selected={selection.spiritKnight} onToggle={toggleRole} />
          </Section>

          <Section title="👤 村民">
            <RoleChip id="villager" label="村民" selected={selection.villager} onToggle={toggleRole} />
            <RoleChip id="villager1" label="村民" selected={selection.villager1} onToggle={toggleRole} />
            <RoleChip id="villager2" label="村民" selected={selection.villager2} onToggle={toggleRole} />
            <RoleChip id="villager3" label="村民" selected={selection.villager3} onToggle={toggleRole} />
            <RoleChip id="villager4" label="村民" selected={selection.villager4} onToggle={toggleRole} />
          </Section>

          <Section title="✨ 神职">
            <RoleChip id="seer" label="预言家" selected={selection.seer} onToggle={toggleRole} />
            <RoleChip id="witch" label="女巫" selected={selection.witch} onToggle={toggleRole} />
            <RoleChip id="hunter" label="猎人" selected={selection.hunter} onToggle={toggleRole} />
            <RoleChip id="guard" label="守卫" selected={selection.guard} onToggle={toggleRole} />
            <RoleChip id="idiot" label="白痴" selected={selection.idiot} onToggle={toggleRole} />
            <RoleChip id="graveyardKeeper" label="守墓人" selected={selection.graveyardKeeper} onToggle={toggleRole} />
            <RoleChip id="knight" label="骑士" selected={selection.knight} onToggle={toggleRole} />
            <RoleChip id="celebrity" label="摄梦人" selected={selection.celebrity} onToggle={toggleRole} />
            <RoleChip id="magician" label="魔术师" selected={selection.magician} onToggle={toggleRole} />
            <RoleChip id="witcher" label="猎魔人" selected={selection.witcher} onToggle={toggleRole} />
            <RoleChip id="psychic" label="通灵师" selected={selection.psychic} onToggle={toggleRole} />
          </Section>

          <Section title="🎲 特殊">
            <RoleChip id="slacker" label="混子" selected={selection.slacker} onToggle={toggleRole} />
          </Section>
        </View>

        <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* Password Modal for Bot Fill */}
      <PromptModal
        visible={showPasswordModal}
        title="需要密码"
        message="请输入密码以填充机器人"
        placeholder="密码"
        secureTextEntry={true}
        onCancel={() => setShowPasswordModal(false)}
        onConfirm={handlePasswordConfirm}
      />
    </SafeAreaView>
  );
};

export default ConfigScreen;
