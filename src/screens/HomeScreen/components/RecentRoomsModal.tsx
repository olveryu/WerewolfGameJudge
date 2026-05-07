/**
 * RecentRoomsModal — 最近房间列表弹窗
 *
 * 打开时并行检查所有 recent room codes 是否在线。
 * 在线的显示绿色圆点 + "进入"按钮；检查中显示 spinner。
 * 全部失效显示空状态。已关闭的房间从列表和 storage 中移除。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { useServices } from '@/contexts/ServiceContext';
import { removeRecentRoom } from '@/lib/recentRooms';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, spacing, textStyles, typography } from '@/theme';

type RoomStatus = 'checking' | 'online' | 'offline';

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
      void roomService.roomExists(roomCode).then((exists) => {
        if (!exists) {
          removeRecentRoom(roomCode);
        }
        setEntries((prev) =>
          prev.map((e) =>
            e.roomCode === roomCode ? { ...e, status: exists ? 'online' : 'offline' } : e,
          ),
        );
      });
    }
  }, [visible, roomCodes, roomService]);

  const handleJoin = useCallback(
    (roomCode: string) => {
      onClose();
      onJoin(roomCode);
    },
    [onClose, onJoin],
  );

  const onlineEntries = entries.filter((e) => e.status === 'online');
  const checkingEntries = entries.filter((e) => e.status === 'checking');
  const allChecked = checkingEntries.length === 0;
  const hasOnline = onlineEntries.length > 0;

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      testID="recent-rooms-modal"
    >
      <Text style={styles.title}>最近房间</Text>

      <View style={styles.list}>
        {entries.map((entry) => {
          if (entry.status === 'offline') return null;
          return (
            <View key={entry.roomCode} style={styles.row}>
              <View style={styles.rowLeft}>
                {entry.status === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Ionicons name="ellipse" size={10} color={colors.success} />
                )}
                <Text style={styles.roomCode}>{entry.roomCode}</Text>
              </View>
              {entry.status === 'online' && (
                <Pressable
                  onPress={() => handleJoin(entry.roomCode)}
                  style={styles.joinButton}
                  testID={TESTIDS.recentRoomJoin(entry.roomCode)}
                >
                  <Text style={styles.joinButtonText}>进入</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {allChecked && !hasOnline && <Text style={styles.emptyText}>暂无可用房间</Text>}
      </View>

      <Button variant="secondary" onPress={onClose} style={styles.closeButton}>
        关闭
      </Button>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  title: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  list: {
    gap: spacing.small,
    minHeight: 80,
    marginBottom: spacing.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  roomCode: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  joinButton: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
  },
  joinButtonText: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  emptyText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.large,
  },
  closeButton: {
    width: '100%',
  },
});
