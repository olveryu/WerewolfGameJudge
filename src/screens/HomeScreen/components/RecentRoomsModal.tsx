/**
 * RecentRoomsModal — recent rooms list modal
 *
 * On open, checks all recent room codes in parallel to see whether they are online.
 * - online -> green dot + micro-card, tap to enter
 * - offline -> removed from list and storage, not rendered
 * - error (network exception) -> orange exclamation mark, storage not cleared
 * - checking -> spinner, not tappable
 *
 * The entire card uses PressableScale for press feedback.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { PressableScale } from '@/components/PressableScale';
import { useServices } from '@/contexts/ServiceContext';
import { removeRecentRoom } from '@/lib/recentRooms';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

type RoomEntry =
  | { roomCode: string; status: 'checking' }
  | { roomCode: string; status: 'online'; createdAt: Date }
  | { roomCode: string; status: 'offline' }
  | { roomCode: string; status: 'error' };

interface RecentRoomsModalProps {
  visible: boolean;
  roomCodes: string[];
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

/** Format room code with spaced digits for readability: "1234" -> "1 2 3 4" */
function formatRoomCode(code: string): string {
  return code.split('').join(' ');
}

/** Format date as relative time: 今天 14:32 / 昨天 20:15 / 05/07 09:30 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return `今天 ${hhmm}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `昨天 ${hhmm}`;

  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd} ${hhmm}`;
}

export const RecentRoomsModal: React.FC<RecentRoomsModalProps> = ({
  visible,
  roomCodes,
  onClose,
  onJoin,
}) => {
  const { roomService } = useServices();
  const [entries, setEntries] = useState<RoomEntry[]>([]);

  // Check all rooms when modal opens
  useEffect(() => {
    if (!visible) return;

    const initial: RoomEntry[] = roomCodes.map((roomCode) => ({ roomCode, status: 'checking' }));
    setEntries(initial);

    for (const roomCode of roomCodes) {
      roomService.getRoom(roomCode).then(
        (room) => {
          if (!room) {
            removeRecentRoom(roomCode);
          }
          setEntries((prev) =>
            prev.map(
              (e): RoomEntry =>
                e.roomCode === roomCode
                  ? room
                    ? { roomCode, status: 'online', createdAt: room.createdAt }
                    : { roomCode, status: 'offline' }
                  : e,
            ),
          );
        },
        () => {
          // Network error — do NOT remove from storage
          setEntries((prev) =>
            prev.map(
              (e): RoomEntry => (e.roomCode === roomCode ? { roomCode, status: 'error' } : e),
            ),
          );
        },
      );
    }
  }, [visible, roomCodes, roomService]);

  const handleJoin = useCallback(
    (roomCode: string) => {
      onClose();
      onJoin(roomCode);
    },
    [onClose, onJoin],
  );

  const visibleEntries = entries.filter((e) => e.status !== 'offline');
  const allChecked = entries.every((e) => e.status !== 'checking');
  const hasOnline = entries.some((e) => e.status === 'online');
  const allError = allChecked && visibleEntries.every((e) => e.status === 'error');

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      testID={TESTIDS.recentRoomsModal}
    >
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={componentSizes.icon.md} color={colors.primary} />
        <Text style={styles.title}>最近房间</Text>
      </View>
      <Text style={styles.subtitle}>按最近进入顺序排列，点击即可进入</Text>

      <View style={styles.list}>
        {visibleEntries.map((entry) => {
          const isOnline = entry.status === 'online';
          const isError = entry.status === 'error';
          const isChecking = entry.status === 'checking';

          return (
            <PressableScale
              key={entry.roomCode}
              onPress={() => handleJoin(entry.roomCode)}
              disabled={!isOnline}
              style={[
                styles.card,
                isOnline && styles.cardOnline,
                isError && styles.cardError,
                isChecking && styles.cardChecking,
              ]}
              testID={TESTIDS.recentRoomJoin(entry.roomCode)}
              haptic
            >
              <View
                style={[
                  styles.statusIcon,
                  isOnline && styles.statusIconOnline,
                  isError && styles.statusIconError,
                ]}
              >
                {isChecking && <ActivityIndicator size="small" color={colors.textMuted} />}
                {isOnline && (
                  <Ionicons
                    name="game-controller"
                    size={componentSizes.icon.sm}
                    color={colors.success}
                  />
                )}
                {isError && (
                  <Ionicons
                    name="alert-circle"
                    size={componentSizes.icon.sm}
                    color={colors.warning}
                  />
                )}
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.roomCode, !isOnline && styles.roomCodeDisabled]}>
                  {formatRoomCode(entry.roomCode)}
                </Text>
                <Text
                  style={[
                    styles.statusLabel,
                    isOnline && styles.statusLabelOnline,
                    isError && styles.statusLabelError,
                  ]}
                >
                  {isChecking && '检查中...'}
                  {isOnline && '房间在线'}
                  {isError && '网络异常'}
                </Text>
              </View>
              {entry.status === 'online' && (
                <View style={styles.cardRight}>
                  <Text style={styles.createdAt}>{formatRelativeTime(entry.createdAt)}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={componentSizes.icon.md}
                    color={colors.textMuted}
                  />
                </View>
              )}
            </PressableScale>
          );
        })}

        {/* Empty state: all rooms offline */}
        {allChecked && !hasOnline && !allError && (
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>暂无可用房间</Text>
            <Text style={styles.emptySubtext}>之前的房间已关闭</Text>
          </View>
        )}

        {/* Error state: all rooms failed network check */}
        {allError && (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>网络异常，请稍后重试</Text>
          </View>
        )}
      </View>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
  title: {
    ...textStyles.titleBold,
    color: colors.text,
  },
  subtitle: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.tight,
    marginBottom: spacing.large,
  },
  list: {
    gap: spacing.small,
    minHeight: 80,
  },
  // ── Card base ──────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.small,
    ...shadows.sm,
  },
  cardOnline: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  cardError: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  cardChecking: {
    backgroundColor: withAlpha(colors.surface, 0.6),
  },
  // ── Status icon (circle bg) ────────────────────────────────
  statusIcon: {
    width: componentSizes.icon.xl,
    height: componentSizes.icon.xl,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconOnline: {
    backgroundColor: withAlpha(colors.success, 0.1),
  },
  statusIconError: {
    backgroundColor: withAlpha(colors.warning, 0.1),
  },
  // ── Card content (two-row) ─────────────────────────────────
  cardContent: {
    flex: 1,
    gap: spacing.micro,
  },
  roomCode: {
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: typography.letterSpacing.wide,
  },
  roomCodeDisabled: {
    color: colors.textMuted,
  },
  statusLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  statusLabelOnline: {
    color: colors.success,
  },
  statusLabelError: {
    color: colors.warning,
  },
  // ── Card right (time + chevron) ────────────────────────────
  cardRight: {
    alignItems: 'flex-end',
    gap: spacing.micro,
  },
  createdAt: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  // ── Empty / error states ───────────────────────────────────
  emptyState: {
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.xlarge,
  },
  emptyText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
