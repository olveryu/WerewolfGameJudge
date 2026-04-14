/**
 * PlayerProfileCard — 玩家资料卡弹窗（游戏卡牌风格）
 *
 * 点击其他玩家座位时弹出，展示公开资料（头像+头像框、等级称号、局数）。
 * Host 额外显示"移出座位"按钮。Bot 显示简化卡（无 API）。
 * 纯展示 + 数据获取，不含游戏逻辑。
 */
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getLevelProgress,
  getLevelTitle,
  LEVEL_THRESHOLDS,
} from '@werewolf/game-engine/growth/level';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Avatar } from '@/components/Avatar';
import { type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { BaseCenterModal } from '@/components/BaseCenterModal';
import { PressableScale } from '@/components/PressableScale';
import { getFlairById } from '@/components/seatFlairs';
import { useUserProfileQuery } from '@/hooks/queries/useUserProfileQuery';
import { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

interface PlayerProfileCardProps {
  visible: boolean;
  onClose: () => void;
  /** Target player UID */
  targetUid: string;
  /** Target seat number (0-based) */
  targetSeat: number;
  /** Whether current user is host (shows kick button) */
  isHost: boolean;
  /** Display name from roster (used for bots or fallback) */
  rosterName?: string;
  /** Callback when host taps kick button */
  onKick?: (seat: number) => void;
}

const AVATAR_SIZE = componentSizes.avatar.xl; // 80pt
const CARD_WIDTH = 300;

/** 等级称号对应的主题色 */
function getTitleColor(level: number): string {
  if (level >= 41) return colors.warning;
  if (level >= 31) return colors.god; // 元老 — 紫色
  if (level >= 21) return colors.info; // 老手 — 蓝色
  if (level >= 11) return colors.success; // 常客 — 绿色
  if (level >= 6) return colors.textSecondary; // 入门
  return colors.textMuted; // 新手
}

// ---------------------------------------------------------------------------
// Animated XP progress bar
// ---------------------------------------------------------------------------
const XpProgressBar: React.FC<{ progress: number }> = memo(({ progress }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = 0;
    width.value = withDelay(300, withSpring(progress, { damping: 18, stiffness: 90 }));
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.round(width.value * 100)}%`,
  }));

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressFill, animatedStyle]} />
    </View>
  );
});
XpProgressBar.displayName = 'XpProgressBar';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const PlayerProfileCardComponent: React.FC<PlayerProfileCardProps> = ({
  visible,
  onClose,
  targetUid,
  targetSeat,
  isHost,
  rosterName,
  onKick,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isBot = targetUid.startsWith('bot-');

  // Fetch user public profile (shared cache via TanStack Query)
  const {
    data: profile,
    isLoading: loading,
    isError: error,
  } = useUserProfileQuery(targetUid, {
    enabled: visible && !!targetUid && !isBot,
  });

  const handleKick = useCallback(() => {
    onClose();
    onKick?.(targetSeat);
  }, [onClose, onKick, targetSeat]);

  const handleViewUnlocks = useCallback(() => {
    onClose();
    navigation.navigate('Unlocks', {
      userId: targetUid,
      displayName: profile?.displayName,
    });
  }, [onClose, navigation, targetUid, profile?.displayName]);

  const xpProgress = useMemo(() => (profile ? getLevelProgress(profile.xp) : 0), [profile]);

  const nextThreshold = useMemo(
    () =>
      profile ? LEVEL_THRESHOLDS[Math.min(profile.level + 1, LEVEL_THRESHOLDS.length - 1)] : 0,
    [profile],
  );

  const titleColor = useMemo(
    () => (profile ? getTitleColor(profile.level) : colors.textMuted),
    [profile],
  );

  // Resolve seat flair animation component
  const flairConfig = useMemo(
    () => (profile?.seatFlair ? getFlairById(profile.seatFlair) : undefined),
    [profile],
  );
  const FlairComponent = flairConfig?.Component;

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      testID="player-profile-card"
      contentStyle={styles.modalContent}
    >
      <View style={styles.card}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>加载中</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>加载失败</Text>
            <Text style={styles.errorHint}>请稍后重试</Text>
          </View>
        )}

        {/* Bot: simplified card — no API, roster name + kick only */}
        {isBot && !loading && (
          <>
            <View style={styles.headerBand}>
              <View
                style={[styles.headerAccent, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
              />
            </View>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Avatar value={targetUid} size={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
              </View>
            </View>
            <Text style={styles.displayName} numberOfLines={1}>
              {rosterName || `机器人${targetSeat + 1}`}
            </Text>
            <View style={styles.titleChip}>
              <Text style={[styles.titleText, { color: colors.textMuted }]}>机器人</Text>
            </View>
            {isHost && onKick && (
              <PressableScale onPress={handleKick} style={styles.kickButton}>
                <Text style={styles.kickButtonText}>移出座位</Text>
              </PressableScale>
            )}
          </>
        )}

        {profile && !loading && (
          <>
            {/* ── Card header band ── */}
            <View style={styles.headerBand}>
              <View
                style={[styles.headerAccent, { backgroundColor: withAlpha(titleColor, 0.15) }]}
              />
            </View>

            {/* ── Avatar + frame ── */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <AvatarWithFrame
                  value={targetUid}
                  size={AVATAR_SIZE}
                  avatarUrl={profile.avatarUrl}
                  frameId={profile.avatarFrame as FrameId}
                  borderRadius={AVATAR_SIZE / 2}
                />
                {FlairComponent && (
                  <View style={styles.flairOverlay} pointerEvents="none">
                    <FlairComponent size={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
                  </View>
                )}
                {/* Level badge */}
                <View style={[styles.levelBadge, { backgroundColor: titleColor }]}>
                  <Text style={styles.levelBadgeText}>Lv.{profile.level}</Text>
                </View>
              </View>
            </View>

            {/* ── Name + title ── */}
            <Text style={styles.displayName} numberOfLines={1}>
              {profile.displayName || `${targetSeat + 1}号玩家`}
            </Text>
            <View style={[styles.titleChip, { borderColor: withAlpha(titleColor, 0.3) }]}>
              <Text style={[styles.titleText, { color: titleColor }]}>
                {profile.title ?? getLevelTitle(profile.level)}
              </Text>
            </View>

            {/* ── XP section ── */}
            <View style={styles.xpSection}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>经验值</Text>
                <Text style={styles.xpValue}>
                  {profile.xp} / {nextThreshold}
                </Text>
              </View>
              <XpProgressBar progress={xpProgress} />
            </View>

            {/* ── Stats row ── */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.gamesPlayed}</Text>
                <Text style={styles.statLabel}>总局数</Text>
              </View>
              <View style={styles.statDivider} />
              <PressableScale onPress={handleViewUnlocks} style={styles.statItem}>
                <Text style={styles.statValue}>{profile.unlockedItemCount}</Text>
                <Text style={[styles.statLabel, styles.statLabelTappable]}>已解锁 ›</Text>
              </PressableScale>
            </View>

            {/* ── Host kick button ── */}
            {isHost && onKick && (
              <PressableScale onPress={handleKick} style={styles.kickButton}>
                <Text style={styles.kickButtonText}>移出座位</Text>
              </PressableScale>
            )}
          </>
        )}
      </View>
    </BaseCenterModal>
  );
};

export const PlayerProfileCard = memo(PlayerProfileCardComponent);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  modalContent: {
    padding: 0,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 240,
    alignItems: 'center',
    overflow: 'visible',
  },
  loadingContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.small,
  },
  loadingText: {
    fontSize: typography.secondary,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: typography.body,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  errorHint: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },

  // Header band — decorative color accent at card top
  headerBand: {
    width: '100%',
    height: 48,
    overflow: 'hidden',
  },
  headerAccent: {
    width: '100%',
    height: '100%',
  },

  // Avatar
  avatarSection: {
    marginTop: -(AVATAR_SIZE / 2 + spacing.tight),
    alignItems: 'center',
    zIndex: 1,
  },
  avatarContainer: {
    padding: spacing.tight,
    borderRadius: (AVATAR_SIZE + spacing.tight * 2) / 2,
    backgroundColor: colors.surface,
    overflow: 'visible',
  },
  flairOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.tight + 2,
    paddingVertical: spacing.micro,
    minWidth: componentSizes.badge.md + 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  levelBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },

  // Name + title
  displayName: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
    maxWidth: CARD_WIDTH - 40,
    marginTop: spacing.small,
    textAlign: 'center',
  },
  titleChip: {
    marginTop: spacing.tight,
    paddingHorizontal: spacing.small + 2,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  titleText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.wide,
  },

  // XP
  xpSection: {
    width: '100%',
    paddingHorizontal: spacing.large,
    marginTop: spacing.medium,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.tight,
  },
  xpLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  xpValue: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: withAlpha(colors.primary, 0.12),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.large,
    marginTop: spacing.medium,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: spacing.micro,
  },
  statLabelTappable: {
    color: colors.primary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },

  // Kick
  kickButton: {
    width: CARD_WIDTH - spacing.large * 2,
    height: componentSizes.button.md,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.error, 0.06),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.medium,
    marginBottom: spacing.large,
  },
  kickButtonText: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
});
