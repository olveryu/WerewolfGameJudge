/** Admin room list: paginated room cards; a card toggles its participant list. */
import './AdminTabs.css';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import type { AdminRoom, AdminRoomPlayer } from '@/features/admin/model/adminContracts';
import { fetchRoomPlayers, fetchRooms } from '@/features/admin/services/adminApi';
import { enterRoomFromAdmin } from '@/features/room/navigation/roomFlowNavigation';
import IconEnterOutline from '~icons/ion/enter-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { Pagination } from '../components/Pagination';
import { loadErrorMessage } from './loadErrorMessage';

const ROOM_STATUS_LABELS: Record<AdminRoom['status'], string> = {
  creating: '创建中',
  active: '活跃',
  deleting: '删除中',
  failed: '恢复失败',
};

function formatUtcMinute(timestamp: string): string {
  return timestamp.replace('T', ' ').slice(0, 16);
}

function RoomPlayers({ loading, players }: { loading: boolean; players: AdminRoomPlayer[] }) {
  if (loading) return <Spinner label="正在读取参与者" />;
  if (players.length === 0) return <p className="admin-card-meta">无参与者记录</p>;
  return (
    <ul className="admin-room-players">
      {players.map((player) => (
        <li key={player.userId} className="admin-room-player">
          <span className="admin-room-player-name">{player.displayName ?? '匿名用户'}</span>
          <span className="admin-card-detail">
            Lv.{player.level} · {player.xp} XP · {player.gamesPlayed} 局
          </span>
          <span className="admin-card-meta">
            {player.lastCountry ?? '?'} · {player.lastColo ?? '?'} · {player.joinedAt.slice(0, 16)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Admin rooms tab. */
export function RoomsTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [players, setPlayers] = useState<AdminRoomPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  // The previous page stays as placeholder so the total holds while the next page loads.
  const roomsQuery = useQuery({
    queryKey: ['adminRooms', page],
    queryFn: () => fetchRooms({ page }),
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const loading = roomsQuery.isPending || roomsQuery.isPlaceholderData;
  const error = roomsQuery.error === null ? null : loadErrorMessage(roomsQuery.error);
  const rooms = roomsQuery.data?.rooms ?? [];
  const total = roomsQuery.data?.total ?? 0;

  const handleRoomPress = async (roomCode: string) => {
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
  };

  return (
    <div className="admin-tab">
      <p className="admin-summary">总房间: {total}</p>
      {loading || error ? (
        <AdminEmptyState loading={loading} error={error} empty={false} />
      ) : rooms.length === 0 ? (
        <AdminEmptyState loading={false} error={null} empty />
      ) : (
        <ul className="admin-list">
          {rooms.map((room) => {
            const isExpanded = expandedRoom === room.code;
            return (
              <li key={room.id} className="admin-card">
                <button
                  type="button"
                  className="admin-card-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => void handleRoomPress(room.code)}
                >
                  <span className="admin-card-header">
                    <span className="admin-room-code">#{room.code}</span>
                    <span className="admin-card-detail">{room.participantCount}人</span>
                  </span>
                  <span className="admin-card-detail">
                    房主: {room.hostName ?? '未知'} · {room.hostCountry ?? '?'}
                  </span>
                  <span className="admin-card-detail">
                    {room.gameType} · {ROOM_STATUS_LABELS[room.status]}
                    {room.reconciliationAttemptCount > 0
                      ? ` · 已重试 ${room.reconciliationAttemptCount} 次`
                      : ''}
                  </span>
                  <span className="admin-card-detail">
                    {room.gamesStarted > 0
                      ? `已开局 ${room.gamesStarted} 次${
                          room.lastStartedAt
                            ? ` · 最近 ${formatUtcMinute(room.lastStartedAt)} UTC`
                            : ''
                        }`
                      : '未开局'}
                  </span>
                  <span className="admin-card-meta">{formatUtcMinute(room.createdAt)} UTC</span>
                </button>
                <div className="admin-card-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`进入房间 ${room.code}`}
                    onClick={() => enterRoomFromAdmin(navigate, room.code)}
                  >
                    <span className="admin-button-content">
                      <IconEnterOutline aria-hidden />
                      进入房间
                    </span>
                  </Button>
                </div>
                {isExpanded && <RoomPlayers loading={playersLoading} players={players} />}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / 50)} onPageChange={setPage} />
    </div>
  );
}
