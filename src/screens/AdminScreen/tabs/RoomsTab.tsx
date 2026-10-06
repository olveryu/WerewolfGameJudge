/**
 * RoomsTab — Admin room list
 *
 * Paginated room cards; tap to expand the participant list. Uses the shared Pagination + AdminEmptyState components.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import { PressableScale } from '@/components/PressableScale';
import { type AdminRoom, type AdminRoomPlayer } from '@/features/admin/model/adminContracts';
import {
  fetchRoomPlayers,
  fetchRooms,
  triggerRoomCleanup,
} from '@/features/admin/services/adminApi';
import { enterRoomFromAdmin } from '@/features/room/navigation/roomFlowNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { AdminEmptyState, Pagination } from '../components';

export const RoomsTab: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<AdminRoomPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  // Manual expiry trigger: runs the same pipeline as the daily 03:00 UTC cron.
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRooms({ page });
      setRooms(result.rooms);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRoomPress = useCallback(
    async (roomCode: string) => {
      if (expandedRoom === roomCode) {
        setExpandedRoom(null);
        setPlayers([]);
        return;
      }
      setExpandedRoom(roomCode);
      setPlayersLoading(true);
      try {
        const result = await fetchRoomPlayers(roomCode);
        setPlayers(result.players);
      } catch {
        setPlayers([]);
      } finally {
        setPlayersLoading(false);
      }
    },
    [expandedRoom],
  );

  const totalPages = Math.ceil(total / 50);

  const doCleanup = useCallback(() => {
    setConfirmCleanup(false);
    setCleaning(true);
    setCleanupResult(null);
    void (async () => {
      try {
        const result = await triggerRoomCleanup();
        const errorSuffix = result.errors.length > 0 ? `，${result.errors.length} 个删除失败` : '';
        setCleanupResult(
          `标记过期 ${result.marked} 个，删除 ${result.reconciled} 个${errorSuffix}`,
        );
        await loadData();
      } catch (e) {
        setCleanupResult(`清理失败：${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setCleaning(false);
      }
    })();
  }, [loadData]);

  const renderRoom = useCallback(
    ({ item }: { item: AdminRoom }) => {
      const isExpanded = expandedRoom === item.code;
      return (
        <View>
          <View style={styles.card}>
            <PressableScale onPress={() => void handleRoomPress(item.code)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardCode}>#{item.code}</Text>
                <Text style={styles.cardCount}>{item.participantCount}人</Text>
              </View>
              <Text style={styles.cardDetail}>
                房主: {item.hostName ?? '未知'} · {item.hostCountry ?? '?'}
              </Text>
              <Text style={styles.cardDetail}>
                {item.gameType} ·{' '}
                {
                  { creating: '创建中', active: '活跃', deleting: '删除中', failed: '恢复失败' }[
                    item.status
                  ]
                }
                {item.reconciliationAttemptCount > 0
                  ? ` · 已重试 ${item.reconciliationAttemptCount} 次`
                  : ''}
              </Text>
              <Text style={styles.cardDetail}>
                {item.gamesStarted > 0
                  ? `已开局 ${item.gamesStarted} 次${
                      item.lastStartedAt
                        ? ` · 最近 ${item.lastStartedAt.replace('T', ' ').slice(0, 16)} UTC`
                        : ''
                    }`
                  : '未开局'}
              </Text>
              <Text style={styles.cardMeta}>
                {item.createdAt.replace('T', ' ').slice(0, 16)} UTC
              </Text>
            </PressableScale>

            <PressableScale
              style={styles.enterRoom}
              accessibilityRole="button"
              accessibilityLabel={`进入房间 ${item.code}`}
              onPress={() => enterRoomFromAdmin(navigation, item.code)}
            >
              <Ionicons name="enter-outline" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={styles.enterRoomText}>进入房间</Text>
            </PressableScale>
          </View>

          {isExpanded && (
            <View style={styles.playersContainer}>
              {playersLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : players.length === 0 ? (
                <Text style={styles.empty}>无参与者记录</Text>
              ) : (
                players.map((p) => (
                  <View key={p.userId} style={styles.playerCard}>
                    <Text style={styles.playerName}>{p.displayName ?? '匿名用户'}</Text>
                    <Text style={styles.playerDetail}>
                      Lv.{p.level} · {p.xp} XP · {p.gamesPlayed} 局
                    </Text>
                    <Text style={styles.playerMeta}>
                      {p.lastCountry ?? '?'} · {p.lastColo ?? '?'} · {p.joinedAt.slice(0, 16)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      );
    },
    [expandedRoom, players, playersLoading, handleRoomPress, navigation],
  );

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>总房间: {total}</Text>
        <PressableScale
          style={styles.cleanupButton}
          accessibilityRole="button"
          accessibilityLabel="清理过期房间"
          disabled={cleaning}
          onPress={() => setConfirmCleanup(true)}
        >
          {cleaning ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.cleanupButtonText}>清理过期房间</Text>
          )}
        </PressableScale>
      </View>
      {cleanupResult !== null && <Text style={styles.cleanupResult}>{cleanupResult}</Text>}

      {loading || error ? (
        <AdminEmptyState loading={loading} error={error} empty={false} />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<AdminEmptyState loading={false} error={null} empty />}
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AlertModal
        visible={confirmCleanup}
        title="清理过期房间"
        message="将标记所有超过 24 小时的房间并删除（与每天 3 点定时任务相同），确定吗？"
        buttons={[
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: doCleanup },
        ]}
        onClose={() => setConfirmCleanup(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.medium },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.tight,
    marginTop: spacing.small,
  },
  summary: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  cleanupButton: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cleanupButtonText: {
    fontSize: typography.caption,
    color: colors.primary,
  },
  cleanupResult: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
  },
  list: { paddingBottom: spacing.medium },
  enterRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.tight,
    padding: spacing.small,
    marginTop: spacing.tight,
  },
  enterRoomText: { color: colors.primary, fontSize: typography.caption },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    marginBottom: spacing.tight,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCode: {
    fontSize: typography.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  cardCount: { fontSize: typography.caption, color: colors.textSecondary },
  cardDetail: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.micro,
  },
  cardMeta: { fontSize: typography.caption, color: colors.textMuted, marginTop: spacing.micro },
  playersContainer: {
    marginLeft: spacing.medium,
    marginBottom: spacing.small,
    paddingLeft: spacing.small,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    marginBottom: spacing.tight,
  },
  playerName: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  playerDetail: { fontSize: typography.captionSmall, color: colors.textSecondary, marginTop: 1 },
  playerMeta: { fontSize: typography.captionSmall, color: colors.textMuted, marginTop: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xlarge },
});
