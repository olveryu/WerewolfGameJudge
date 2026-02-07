/**
 * RoleRouletteModal - 轮盘抽奖动画角色卡片模态框
 *
 * 点击"查看身份"后显示轮盘滚动动画，停在角色上后显示角色信息。
 *
 * ✅ 允许：渲染轮盘动画 + 显示角色卡片
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import { shuffleArray } from '../utils/shuffle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);
const CARD_HEIGHT = CARD_WIDTH * 1.4;
const ROULETTE_ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 3;
const ROULETTE_DURATION_MS = 2500;

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

export interface RoleRouletteModalProps {
  visible: boolean;
  roleId: RoleId | null;
  allRoles: RoleId[];
  onClose: () => void;
}

export const RoleRouletteModal: React.FC<RoleRouletteModalProps> = ({
  visible,
  roleId,
  allRoles,
  onClose,
}) => {
  if (!visible) return null;

  return <RoleRouletteModalContent roleId={roleId} allRoles={allRoles} onClose={onClose} />;
};

// Inner component that mounts fresh each time modal opens
const RoleRouletteModalContent: React.FC<{
  roleId: RoleId | null;
  allRoles: RoleId[];
  onClose: () => void;
}> = ({ roleId, allRoles, onClose }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [revealed, setRevealed] = useState(false);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const isWeb = Platform.OS === 'web';
  const nativeDriver = !isWeb;

  // 打乱角色顺序（每次打开重新打乱），确保目标角色在列表中
  const shuffledRoles = useMemo(() => {
    // 去重
    const uniqueRoles = [...new Set(allRoles)];
    // 如果目标角色不在列表中，添加进去
    if (roleId && !uniqueRoles.includes(roleId)) {
      uniqueRoles.push(roleId);
    }
    return shuffleArray(uniqueRoles);
  }, [allRoles, roleId]);

  // 计算目标位置
  const targetIndex = useMemo(() => {
    const idx = shuffledRoles.indexOf(roleId as RoleId);
    return Math.max(idx, 0);
  }, [shuffledRoles, roleId]);

  // 创建重复的角色列表用于无缝滚动 (must be before early return)
  const repeatedRoles = useMemo(() => {
    // 重复足够多次以覆盖动画
    const repeats = 5;
    const result: RoleId[] = [];
    for (let i = 0; i < repeats; i++) {
      result.push(...shuffledRoles);
    }
    return result;
  }, [shuffledRoles]);

  const spinRoulette = useCallback(() => {
    const totalSpins = 3; // 转 3 圈
    const targetPosition = totalSpins * shuffledRoles.length + targetIndex;

    Animated.timing(scrollAnim, {
      toValue: targetPosition,
      duration: ROULETTE_DURATION_MS,
      easing: (t) => {
        // Custom easing: ease out cubic for "slot machine" feel
        return 1 - Math.pow(1 - t, 3);
      },
      useNativeDriver: nativeDriver,
    }).start(() => {
      setRevealed(true);
    });
  }, [scrollAnim, shuffledRoles.length, targetIndex, nativeDriver]);

  // 入场动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: nativeDriver,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: nativeDriver,
      }),
    ]).start(() => {
      // 入场完成后开始轮盘
      setTimeout(() => {
        spinRoulette();
      }, 200);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    onClose();
  };

  // Early return after all hooks
  if (!roleId) return null;

  const spec = getRoleSpec(roleId);
  const roleName = spec?.displayName || roleId;
  const description = spec?.description || '无技能描述';
  const icon = ROLE_ICONS[roleId] || '❓';
  const factionColor = getFactionColor(roleId);
  const factionName = getFactionName(roleId);

  // 计算轮盘滚动位置
  const translateY = scrollAnim.interpolate({
    inputRange: [0, shuffledRoles.length],
    outputRange: [0, -ROULETTE_ITEM_HEIGHT * shuffledRoles.length],
  });

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={revealed ? handleClose : undefined}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {revealed ? (
            // 揭晓阶段 - 显示角色详情卡片
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
                onPress={handleClose}
              >
                <Text style={styles.confirmButtonText}>我知道了</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 轮盘滚动阶段
            <View style={styles.rouletteContainer}>
              <Text style={styles.rouletteTitle}>🎰 命运轮盘</Text>

              {/* 轮盘窗口 */}
              <View style={styles.rouletteWindow}>
                {/* 选中指示器 */}
                <View style={styles.selector} />

                {/* 滚动的角色列表 */}
                <Animated.View
                  style={[
                    styles.rouletteList,
                    {
                      transform: [{ translateY }],
                    },
                  ]}
                >
                  {repeatedRoles.map((role, index) => {
                    const roleSpec = getRoleSpec(role);
                    const roleIcon = ROLE_ICONS[role] || '❓';
                    const roleFactionColor = getFactionColor(role);
                    return (
                      <View key={`${role}-${index}`} style={styles.rouletteItem}>
                        <Text style={styles.rouletteItemIcon}>{roleIcon}</Text>
                        <Text style={[styles.rouletteItemName, { color: roleFactionColor }]}>
                          {roleSpec?.displayName || role}
                        </Text>
                      </View>
                    );
                  })}
                </Animated.View>
              </View>

              <Text style={styles.rouletteHint}>命运正在揭晓...</Text>
            </View>
          )}
        </Animated.View>
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
    container: {
      alignItems: 'center',
    },
    // 轮盘相关样式
    rouletteContainer: {
      alignItems: 'center',
      padding: spacing.xlarge,
    },
    rouletteTitle: {
      fontSize: typography.heading,
      fontWeight: '700',
      color: '#FFD700',
      marginBottom: spacing.xlarge,
      textShadowColor: 'rgba(255, 215, 0, 0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    rouletteWindow: {
      width: CARD_WIDTH,
      height: ROULETTE_ITEM_HEIGHT * VISIBLE_ITEMS,
      overflow: 'hidden',
      borderRadius: borderRadius.large,
      backgroundColor: colors.surface,
      borderWidth: 3,
      borderColor: '#FFD700',
      position: 'relative',
    },
    selector: {
      position: 'absolute',
      top: ROULETTE_ITEM_HEIGHT,
      left: 0,
      right: 0,
      height: ROULETTE_ITEM_HEIGHT,
      borderTopWidth: 3,
      borderBottomWidth: 3,
      borderColor: '#FFD700',
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
      zIndex: 10,
    },
    rouletteList: {
      paddingTop: ROULETTE_ITEM_HEIGHT, // 初始偏移使第一个元素在中间
    },
    rouletteItem: {
      height: ROULETTE_ITEM_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.medium,
    },
    rouletteItemIcon: {
      fontSize: 32,
    },
    rouletteItemName: {
      fontSize: typography.subtitle,
      fontWeight: '600',
    },
    rouletteHint: {
      marginTop: spacing.xlarge,
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    // 角色卡片样式（复用 RoleCardModal 的样式）
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      borderWidth: 3,
      padding: spacing.large,
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
      paddingVertical: spacing.tight,
      borderTopLeftRadius: borderRadius.xlarge - 3,
      borderTopRightRadius: borderRadius.xlarge - 3,
      alignItems: 'center',
    },
    factionText: {
      color: '#fff',
      fontSize: typography.secondary,
      fontWeight: '600',
    },
    roleIcon: {
      fontSize: 64,
      marginTop: spacing.xlarge + spacing.medium,
      marginBottom: spacing.medium,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: '700',
    },
    divider: {
      width: '80%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    skillTitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    description: {
      fontSize: typography.secondary,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.secondary * 1.5,
      paddingHorizontal: spacing.small,
      flex: 1,
    },
    confirmButton: {
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginTop: spacing.medium,
    },
    confirmButtonText: {
      color: '#fff',
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}

export default RoleRouletteModal;
