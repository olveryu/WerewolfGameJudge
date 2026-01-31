/**
 * RoleCardSimple.tsx - 无动画直接显示角色卡片模态框
 *
 * 点击"查看身份"后直接显示角色信息，无任何动画
 */
import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../theme';
import type { RoleId } from '../models/roles';
import { getRoleSpec, isWolfRole } from '../models/roles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);
const CARD_HEIGHT = CARD_WIDTH * 1.4;

// 角色对应的 emoji 图标
const ROLE_ICONS: Record<string, string> = {
  // 狼人阵营
  wolf: '🐺',
  wolfKing: '👑🐺',
  darkWolfKing: '🌑👑',
  whiteWolfKing: '⚪👑',
  wolfQueen: '👸🐺',
  nightmare: '😱',
  gargoyle: '🗿',
  wolfRobot: '🤖🐺',
  // 神职阵营
  seer: '🔮',
  witch: '🧙‍♀️',
  hunter: '🏹',
  guard: '🛡️',
  psychic: '👁️',
  dreamcatcher: '🌙',
  magician: '🎩',
  spiritKnight: '⚔️',
  // 平民
  villager: '👤',
  slacker: '😴',
};

// 阵营颜色
const getFactionColor = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '#DC2626'; // 红色 - 狼人
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return '#3B82F6'; // 蓝色 - 神职
  return '#6B7280'; // 灰色 - 平民
};

const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return '神职阵营';
  return '平民阵营';
};

export interface RoleCardSimpleProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({ visible, roleId, onClose }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible || !roleId) return null;

  const spec = getRoleSpec(roleId);
  const roleName = spec?.displayName || roleId;
  const description = spec?.description || '无技能描述';
  const icon = ROLE_ICONS[roleId] || '❓';
  const factionColor = getFactionColor(roleId);
  const factionName = getFactionName(roleId);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.card, { borderColor: factionColor }]}>
          <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
            <Text style={styles.factionText}>{factionName}</Text>
          </View>

          <Text style={styles.roleIcon}>{icon}</Text>
          <Text style={[styles.roleName, { color: factionColor }]}>{roleName}</Text>

          <View style={styles.divider} />

          <Text style={styles.skillTitle}>技能介绍</Text>
          <Text style={styles.description}>{description}</Text>

          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: factionColor }]}
            onPress={onClose}
          >
            <Text style={styles.confirmButtonText}>我知道了</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      borderWidth: 3,
      padding: spacing.lg,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        android: {
          elevation: 20,
        },
        web: {
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        },
      }),
    },
    factionBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingVertical: spacing.xs,
      borderTopLeftRadius: borderRadius.xl - 3,
      borderTopRightRadius: borderRadius.xl - 3,
      alignItems: 'center',
    },
    factionText: {
      color: '#fff',
      fontSize: typography.sm,
      fontWeight: '600',
    },
    roleIcon: {
      fontSize: 64,
      marginTop: spacing.xl + spacing.md,
      marginBottom: spacing.md,
    },
    roleName: {
      fontSize: typography['2xl'],
      fontWeight: '700',
    },
    divider: {
      width: '80%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    skillTitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    description: {
      fontSize: typography.sm,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.sm * 1.5,
      paddingHorizontal: spacing.sm,
      flex: 1,
    },
    confirmButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.full,
      marginTop: spacing.md,
    },
    confirmButtonText: {
      color: '#fff',
      fontSize: typography.base,
      fontWeight: '600',
    },
  });
}

export default RoleCardSimple;
