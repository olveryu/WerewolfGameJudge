/**
 * RandomRoleCard — 翻转角色卡（Y轴 3D 翻牌动画）
 *
 * 进入主页时自动播放翻转：背面（"猜猜是谁"）→ 正面（随机角色）。
 * 点击"换一个"翻回背面再翻到正面，展示新角色。
 * 使用 CSS transition + backfaceVisibility 标准双面翻转。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type RoleId } from '@werewolf/game-engine/models/roles';
import { memo, useCallback, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

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
    const [flipped, setFlipped] = useState(false);
    const isFlipping = useRef(false);

    // Auto-flip on mount
    useState(() => {
      setTimeout(() => setFlipped(true), AUTO_FLIP_DELAY);
    });

    const handleRefresh = useCallback(() => {
      if (isFlipping.current) return;
      isFlipping.current = true;

      // Flip to back
      setFlipped(false);

      // Call parent to swap role, then flip to front after half-duration
      setTimeout(() => {
        onRefresh();
        setTimeout(() => {
          setFlipped(true);
          isFlipping.current = false;
        }, 50);
      }, FLIP_DURATION / 2);
    }, [onRefresh]);

    const cardTransition = {
      transitionProperty: 'transform',
      transitionDuration: `${FLIP_DURATION}ms`,
      transitionTimingFunction: 'ease',
    };

    // Front face (role info) — visible when flipped
    const frontStyle = {
      transform: [{ perspective: 800 }, { rotateY: flipped ? '360deg' : '180deg' }],
      backfaceVisibility: 'hidden' as const,
      ...cardTransition,
    } as never;

    // Back face (mystery) — visible when not flipped
    const backStyle = {
      transform: [{ perspective: 800 }, { rotateY: flipped ? '180deg' : '0deg' }],
      backfaceVisibility: 'hidden' as const,
      ...cardTransition,
    } as never;

    return (
      <View style={styles.randomRoleWrapper}>
        {/* Back face */}
        <View style={[styles.randomRoleCard, styles.randomRoleCardAbsolute, backStyle]}>
          <View style={styles.randomRoleBackContent}>
            <Text style={styles.randomRoleBackEmoji}>🐺</Text>
            <Text style={styles.randomRoleBackText}>猜猜今天是谁？</Text>
          </View>
        </View>

        {/* Front face */}
        <View style={[styles.randomRoleCard, frontStyle]}>
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
        </View>
      </View>
    );
  },
);

RandomRoleCard.displayName = 'RandomRoleCard';
