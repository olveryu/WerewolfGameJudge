/**
 * RoomsTab — Admin room list
 *
 * Paginated room cards; tap to expand the participant list. Uses the shared Pagination + AdminEmptyState components.
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, shadows, spacing, typography } from '@/theme';

import { type AdminRoom, type AdminRoomPlayer, fetchRoomPlayers, fetchRooms } from '../adminApi';
import { AdminEmptyState, Pagination } from '../components';

export const RoomsTab: React.FC = () => {
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<AdminRoomPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

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

  const renderRoom = useCallback(
    ({ item }: { item: AdminRoom }) => {
      const isExpanded = expandedRoom === item.code;
      return (
        <View>
          <PressableScale style={styles.card} onPress={() => void handleRoomPress(item.code)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardCode}>#{item.code}</Text>
              <Text style={styles.cardCount}>{item.participantCount}人</Text>
            </View>
            <Text style={styles.cardDetail}>
              房主: {item.hostName ?? '未知'} · {item.hostCountry ?? '?'}
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
            <Text style={styles.cardMeta}>{item.createdAt.replace('T', ' ').slice(0, 16)} UTC</Text>
          </PressableScale>

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
    [expandedRoom, players, playersLoading, handleRoomPress],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.summary}>总房间: {total}</Text>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.medium },
  summary: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
    marginTop: spacing.small,
  },
  list: { paddingBottom: spacing.medium },
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
