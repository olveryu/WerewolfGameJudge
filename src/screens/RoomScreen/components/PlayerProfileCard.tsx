/**
 * PlayerProfileCard — 玩家资料卡弹窗
 *
 * 点击其他玩家座位时弹出，展示公开资料（头像、等级、局数、装扮数量）。
 * Host 额外显示"移出座位"按钮。纯展示 + 数据获取，不含游戏逻辑。
 */
import { getLevelProgress, LEVEL_THRESHOLDS } from '@werewolf/game-engine/growth/level';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BaseCenterModal } from '@/components/BaseCenterModal';
import { PressableScale } from '@/components/PressableScale';
import { fetchUserProfile, type UserPublicProfile } from '@/services/feature/StatsService';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

interface PlayerProfileCardProps {
  visible: boolean;
  onClose: () => void;
  /** Target player UID */
  targetUid: string;
  /** Target seat number (0-based) */
  targetSeat: number;
  /** Whether current user is host (shows kick button) */
  isHost: boolean;
  /** Callback when host taps kick button */
  onKick?: (seat: number) => void;
}

const AVATAR_SIZE = componentSizes.avatar.xl; // 80pt

const PlayerProfileCardComponent: React.FC<PlayerProfileCardProps> = ({
  visible,
  onClose,
  targetUid,
  targetSeat,
  isHost,
  onKick,
}) => {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible || !targetUid) {
      setProfile(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    void fetchUserProfile(targetUid)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          handleError(err, {
            label: '查看资料',
            logger: roomScreenLog,
            alertTitle: false,
          });
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, targetUid]);

  const handleKick = useCallback(() => {
    onClose();
    onKick?.(targetSeat);
  }, [onClose, onKick, targetSeat]);

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      testID="player-profile-card"
    >
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {error && !loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>加载失败</Text>
          </View>
        )}

        {profile && !loading && (
          <>
            {/* Header: avatar + name + level */}
            <View style={styles.header}>
              <View style={styles.avatarWrapper}>
                <Avatar
                  value={targetUid}
                  size={AVATAR_SIZE}
                  avatarUrl={profile.avatarUrl}
                  borderRadius={AVATAR_SIZE / 2}
                />
                {/* Level badge */}
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Lv.{profile.level}</Text>
                </View>
              </View>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.displayName || `${targetSeat + 1}号玩家`}
              </Text>
            </View>

            {/* XP progress bar */}
            <View style={styles.section}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>经验值</Text>
                <Text style={styles.xpValue}>
                  {profile.xp} /{' '}
                  {LEVEL_THRESHOLDS[Math.min(profile.level + 1, LEVEL_THRESHOLDS.length - 1)]}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(getLevelProgress(profile.xp) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.gamesPlayed}</Text>
                <Text style={styles.statLabel}>总局数</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.unlockedItemCount}</Text>
                <Text style={styles.statLabel}>已解锁装扮</Text>
              </View>
            </View>

            {/* Host-only kick button */}
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

const styles = StyleSheet.create({
  container: {
    width: 280,
    minHeight: 200,
    alignItems: 'center',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  avatarWrapper: {
    marginBottom: spacing.small,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
    minWidth: componentSizes.badge.md,
    alignItems: 'center',
  },
  levelBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  displayName: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    maxWidth: 240,
  },
  section: {
    width: '100%',
    marginBottom: spacing.medium,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.tight,
  },
  xpLabel: {
    fontSize: typography.secondary,
    color: colors.textSecondary,
  },
  xpValue: {
    fontSize: typography.secondary,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.medium,
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
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },
  kickButton: {
    width: '100%',
    height: componentSizes.button.md,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.error, 0.08),
    justifyContent: 'center',
    alignItems: 'center',
  },
  kickButtonText: {
    fontSize: typography.body,
    fontWeight: typography.weights.medium,
    color: colors.error,
  },
});
