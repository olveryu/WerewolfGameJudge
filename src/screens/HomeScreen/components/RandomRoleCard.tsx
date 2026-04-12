/**
 * RandomRoleCard — 翻转角色卡（Y轴 3D 翻牌动画）
 *
 * 进入主页时自动播放翻转：背面（"猜猜是谁"）→ 正面（随机角色）。
 * 点击"换一个"翻回背面再翻到正面，展示新角色。
 * 使用 react-native-reanimated withTiming + backfaceVisibility 标准双面翻转。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { type RoleId } from '@werewolf/game-engine/models/roles';
import { memo, useCallback, useEffect, useRef } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { colors, componentSizes, type ThemeColors, withAlpha } from '@/theme';

import { type HomeScreenStyles } from './styles';

const FLIP_DURATION = 600;
const AUTO_FLIP_DELAY = 400;

interface RandomRoleCardProps {
  roleId: RoleId;
  displayName: string;
  description: string;
  factionColor: string;
  factionLabel: string;
  avatarImage: number;
  onRefresh: () => void;
  onDetail: () => void;
  styles: HomeScreenStyles;
  colors: ThemeColors;
}

export const RandomRoleCard = memo<RandomRoleCardProps>(
  ({
    displayName,
    description,
    factionColor,
    factionLabel,
    avatarImage,
    onRefresh,
    onDetail,
    styles,
  }) => {
    const rotation = useSharedValue(0);
    const isFlipping = useRef(false);

    // Auto-flip on mount
    useEffect(() => {
      rotation.value = withDelay(AUTO_FLIP_DELAY, withTiming(180, { duration: FLIP_DURATION }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = useCallback(() => {
      if (isFlipping.current) return;
      isFlipping.current = true;

      // Flip to back
      rotation.value = withTiming(0, { duration: FLIP_DURATION / 2 }, () => {
        // Parent swaps role via onRefresh; after state update, flip to front
      });

      // Call parent to swap role, then flip to front after a short delay
      setTimeout(() => {
        onRefresh();
        setTimeout(() => {
          rotation.value = withTiming(180, { duration: FLIP_DURATION / 2 }, () => {
            isFlipping.current = false;
          });
        }, 50);
      }, FLIP_DURATION / 2);
    }, [onRefresh, rotation]);

    // Front face (role info) — visible when rotation is 180°
    const frontStyle = useAnimatedStyle(() => ({
      transform: [
        { perspective: 800 },
        { rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` },
      ],
      backfaceVisibility: 'hidden',
    }));

    // Back face (mystery) — visible when rotation is 0°
    const backStyle = useAnimatedStyle(() => ({
      transform: [
        { perspective: 800 },
        { rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` },
      ],
      backfaceVisibility: 'hidden',
    }));

    return (
      <View style={styles.randomRoleWrapper}>
        {/* Back face */}
        <Animated.View style={[styles.randomRoleCard, styles.randomRoleCardAbsolute, backStyle]}>
          <View style={styles.randomRoleBackContent}>
            <Text style={styles.randomRoleBackEmoji}>🐺</Text>
            <Text style={styles.randomRoleBackText}>猜猜今天是谁？</Text>
          </View>
        </Animated.View>

        {/* Front face */}
        <Animated.View style={[styles.randomRoleCard, frontStyle]}>
          <View style={styles.randomRoleFrontRow}>
            <Image source={avatarImage} style={styles.randomRoleAvatar} resizeMode="cover" />
            <View style={styles.randomRoleFrontInfo}>
              <View style={styles.randomRoleNameRow}>
                <Text style={styles.randomRoleName}>{displayName}</Text>
                <View
                  style={[
                    styles.randomRoleBadge,
                    { backgroundColor: withAlpha(factionColor, 0.15) },
                  ]}
                >
                  <Text style={[styles.randomRoleBadgeText, { color: factionColor }]}>
                    {factionLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.randomRoleDesc} numberOfLines={2}>
                {description}
              </Text>
            </View>
          </View>
          <View style={styles.randomRoleActions}>
            <PressableScale onPress={handleRefresh} style={styles.randomRoleActionBtn}>
              <Ionicons name="refresh" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={[styles.randomRoleActionText, { color: colors.primary }]}>换一个</Text>
            </PressableScale>
            <PressableScale onPress={onDetail} style={styles.randomRoleActionBtn}>
              <Text style={[styles.randomRoleActionText, { color: colors.textSecondary }]}>
                详情
              </Text>
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.sm}
                color={colors.textSecondary}
              />
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    );
  },
);

RandomRoleCard.displayName = 'RandomRoleCard';
