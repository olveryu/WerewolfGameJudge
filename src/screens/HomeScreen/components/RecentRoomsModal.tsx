/**
 * RecentRoomsModal — 最近房间列表弹窗
 *
 * 打开时并行检查所有 recent room codes 是否在线。
 * - online → 绿色圆点 + micro-card 可点击进入
 * - offline → 从列表和 storage 中移除，不渲染
 * - error（网络异常）→ 橙色感叹号，不清除 storage
 * - checking → spinner，不可点
 *
 * 整张卡片用 PressableScale 实现按压反馈。
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

type RoomStatus = 'checking' | 'online' | 'offline' | 'error';

interface RoomEntry {
  roomCode: string;
  status: RoomStatus;
}

interface RecentRoomsModalProps {
  visible: boolean;
  roomCodes: string[];
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

/** Format room code with spaced digits for readability: "1234" → "1 2 3 4" */
function formatRoomCode(code: string): string {
  return code.split('').join(' ');
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
      roomService.roomExists(roomCode).then(
        (exists) => {
          if (!exists) {
            removeRecentRoom(roomCode);
          }
          setEntries((prev) =>
            prev.map((e) =>
              e.roomCode === roomCode ? { ...e, status: exists ? 'online' : 'offline' } : e,
            ),
          );
        },
        () => {
          // Network error — do NOT remove from storage
          setEntries((prev) =>
            prev.map((e) => (e.roomCode === roomCode ? { ...e, status: 'error' } : e)),
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
      <Text style={styles.title}>最近房间</Text>
      <Text style={styles.subtitle}>点击房间号即可进入</Text>

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
              style={[styles.card, !isOnline && styles.cardDisabled]}
              testID={TESTIDS.recentRoomJoin(entry.roomCode)}
              haptic
            >
              <View style={styles.statusIndicator}>
                {isChecking && <ActivityIndicator size="small" color={colors.textMuted} />}
                {isOnline && <Ionicons name="ellipse" size={12} color={colors.success} />}
                {isError && (
                  <Ionicons
                    name="alert-circle"
                    size={componentSizes.icon.md}
                    color={colors.warning}
                  />
                )}
              </View>
              <Text style={[styles.roomCode, !isOnline && styles.roomCodeDisabled]}>
                {formatRoomCode(entry.roomCode)}
              </Text>
              {isOnline && (
                <Ionicons
                  name="chevron-forward"
                  size={componentSizes.icon.md}
                  color={colors.textMuted}
                />
              )}
            </PressableScale>
          );
        })}

        {/* Empty state: all rooms offline */}
        {allChecked && !hasOnline && !allError && (
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>暂无可用房间</Text>
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
  title: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  cardDisabled: {
    backgroundColor: withAlpha(colors.surface, 0.6),
    borderColor: colors.borderLight,
  },
  statusIndicator: {
    width: componentSizes.icon.lg,
    height: componentSizes.icon.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomCode: {
    flex: 1,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: typography.letterSpacing.wide,
    textAlign: 'center',
  },
  roomCodeDisabled: {
    color: colors.textMuted,
  },
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
});
