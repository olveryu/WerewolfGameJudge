/**
 * RoleCardModal.tsx - 3D 翻牌动画角色卡片模态框
 *
 * 点击"查看身份"后显示翻牌动画，正面显示角色信息
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
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

export interface RoleCardModalProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
}

export const RoleCardModal: React.FC<RoleCardModalProps> = ({ visible, roleId, onClose }) => {
  // Use a key-based remount strategy to avoid stale animation state on web
  // Each time visible becomes true, we want a fresh component
  if (!visible) return null;

  return <RoleCardModalContent roleId={roleId} onClose={onClose} />;
};

// Inner component that mounts fresh each time modal opens
const RoleCardModalContent: React.FC<{ roleId: RoleId | null; onClose: () => void }> = ({
  roleId,
  onClose,
}) => {
  const colors = useColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // 动画值 - fresh on every mount
  const flipAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Web compatibility: useNativeDriver doesn't work well with some animations on web
  const isWeb = Platform.OS === 'web';
  const nativeDriver = !isWeb;

  // 入场动画 - runs once on mount
  useEffect(() => {
    // 入场动画：缩放 + 淡入
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: nativeDriver,
      }),
    ]).start(() => {
      // 入场完成后自动翻牌
      setTimeout(() => {
        doFlip();
      }, 300);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const doFlip = () => {
    Animated.spring(flipAnim, {
      toValue: 1,
      friction: 8,
      tension: 80,
      useNativeDriver: nativeDriver,
    }).start();
  };

  const handleClose = () => {
    // CRITICAL: Call onClose synchronously FIRST to ensure modal closes immediately.
    // On web, animation callbacks and setTimeout are unreliable and can cause the modal
    // to stay open even after the user clicks the dismiss button.
    onClose();

    // Fire-and-forget exit animation (purely visual, doesn't block closure)
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: nativeDriver,
      }),
    ]).start();
  };

  if (!roleId) return null;

  const spec = getRoleSpec(roleId);
  const roleName = spec?.displayName || roleId;
  const description = spec?.description || '无技能描述';
  const icon = ROLE_ICONS[roleId] || '❓';
  const factionColor = getFactionColor(roleId);
  const factionName = getFactionName(roleId);

  // 翻牌动画插值
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['180deg', '90deg', '0deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const frontAnimatedStyle = {
    transform: [
      { perspective: 1000 },
      { rotateY: frontInterpolate },
      { scale: scaleAnim },
    ],
    opacity: Animated.multiply(frontOpacity, opacityAnim),
  };

  const backAnimatedStyle = {
    transform: [
      { perspective: 1000 },
      { rotateY: backInterpolate },
      { scale: scaleAnim },
    ],
    opacity: Animated.multiply(backOpacity, opacityAnim),
  };

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.cardContainer}>
          {/* 卡片背面（问号面） */}
          <Animated.View style={[styles.card, styles.cardBack, frontAnimatedStyle]}>
            <View style={styles.cardBackInner}>
              <Text style={styles.cardBackPattern}>🐺</Text>
              <Text style={styles.cardBackQuestion}>?</Text>
              <Text style={styles.cardBackHint}>点击翻牌</Text>
            </View>
          </Animated.View>

          {/* 卡片正面（角色信息） */}
          <Animated.View
            style={[styles.card, styles.cardFront, { borderColor: factionColor }, backAnimatedStyle]}
          >
            <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
              <Text style={styles.factionText}>{factionName}</Text>
            </View>

            <Text style={styles.roleIcon}>{icon}</Text>
            <Text style={[styles.roleName, { color: factionColor }]}>{roleName}</Text>

            <View style={styles.divider} />

            <Text style={styles.skillTitle}>技能介绍</Text>
            <Text style={styles.description}>{description}</Text>

            <TouchableOpacity style={[styles.confirmButton, { backgroundColor: factionColor }]} onPress={handleClose}>
              <Text style={styles.confirmButtonText}>我知道了</Text>
            </TouchableOpacity>
          </Animated.View>
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
    cardContainer: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
    card: {
      position: 'absolute',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: borderRadius.xl,
      backfaceVisibility: 'hidden',
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
    cardBack: {
      backgroundColor: '#1F2937',
      borderWidth: 3,
      borderColor: '#4B5563',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardBackInner: {
      alignItems: 'center',
    },
    cardBackPattern: {
      fontSize: 48,
      opacity: 0.3,
      position: 'absolute',
      top: -80,
    },
    cardBackQuestion: {
      fontSize: 72,
      fontWeight: 'bold',
      color: '#6B7280',
    },
    cardBackHint: {
      marginTop: spacing.md,
      fontSize: typography.sm,
      color: '#9CA3AF',
    },
    cardFront: {
      backgroundColor: colors.surface,
      borderWidth: 3,
      padding: spacing.lg,
      alignItems: 'center',
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

export default RoleCardModal;
