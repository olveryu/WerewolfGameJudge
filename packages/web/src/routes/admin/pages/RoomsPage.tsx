/** Compact room directory; participants are requested only after an explicit expansion. */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';

import type { AdminRoom } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchRoomPlayers, fetchRooms } from '@/features/admin/services/adminApi';
import { enterRoomFromAdmin } from '@/features/room/navigation/roomFlowNavigation';
import { gameDisplayName } from '@/games/catalog';
import { DISMISS_BUTTON, showAlert } from '@/utils/alert';

import {
  AsyncBoundary,
  CursorPager,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatusBadge,
  type TableColumn,
} from '../components/Primitives';

const STATUS = {
  active: { label: '活跃', tone: 'success' },
  creating: { label: '创建中', tone: 'warning' },
  deleting: { label: '删除中', tone: 'warning' },
  failed: { label: '恢复失败', tone: 'danger' },
} as const;

/** Room status priority applies only within the returned page. */
export function RoomsPage() {
  const navigate = useNavigate();
  const [parameters, setParameters] = useSearchParams();
  const page = Number(parameters.get('page') ?? '1');
  const expanded = parameters.get('room');
  const validPage = Number.isSafeInteger(page) && page >= 1;
  const query = useQuery({
    ...adminQueryOptions('rooms', page, (signal) => fetchRooms({ page }, signal)),
    enabled: validPage,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'page') next.delete('room');
    setParameters(next);
  }
  const columns: TableColumn<AdminRoom>[] = [
    {
      key: 'code',
      label: '房间',
      render: (room) => (
        <button
          type="button"
          className="admin-mono admin-text-button"
          aria-expanded={expanded === room.code}
          onClick={() => change('room', expanded === room.code ? '' : room.code)}
        >
          #{room.code}
        </button>
      ),
    },
    { key: 'game', label: '游戏', render: (room) => gameDisplayName(room.gameType) },
    {
      key: 'status',
      label: '状态',
      render: (room) => (
        <StatusBadge tone={STATUS[room.status].tone}>{STATUS[room.status].label}</StatusBadge>
      ),
    },
    { key: 'count', label: '人数', numeric: true, render: (room) => room.participantCount },
    {
      key: 'host',
      label: '房主',
      render: (room) => {
        const identity = room.hostName ?? room.hostUserId;
        return (
          <button
            type="button"
            className="admin-text-button admin-room-host"
            aria-label={`房主：${identity}，查看完整名字`}
            title={identity}
            onClick={() => showAlert('房主', identity, [DISMISS_BUTTON])}
          >
            {identity}
          </button>
        );
      },
    },
    {
      key: 'started',
      label: '开局次数',
      numeric: true,
      secondary: true,
      render: (room) => room.gamesStarted,
    },
    {
      key: 'last',
      label: '最近开局',
      secondary: true,
      render: (room) => <DateLabel value={room.lastStartedAt} />,
    },
    {
      key: 'created',
      label: '创建时间',
      secondary: true,
      render: (room) => <DateLabel value={room.createdAt} />,
    },
    {
      key: 'enter',
      label: '操作',
      render: (room) => (
        <button
          type="button"
          className="admin-text-button"
          aria-label={`进入房间 ${room.code}`}
          onClick={() => enterRoomFromAdmin(navigate, room.code)}
        >
          进入 ↗
        </button>
      ),
    },
  ];
  const selected = query.data?.rooms.find((room) => room.code === expanded);
  return (
    <>
      <PageHeading
        title="房间"
        description="查看运行状态与开局记录，点击房间号查看参与者及其累计局数。"
        query={query}
      />
      <div className="admin-content">
        {!validPage ? (
          <p role="alert" className="admin-error">
            无效页码
          </p>
        ) : (
          <Panel flush>
            <AsyncBoundary query={query}>
              {(data) => (
                <>
                  <DataTable
                    caption="房间目录"
                    columns={columns}
                    rows={[...data.rooms].sort(
                      (a, b) => Number(b.status === 'failed') - Number(a.status === 'failed'),
                    )}
                    rowKey={(room) => room.id}
                  />
                  <CursorPager
                    page={page}
                    hasNext={page * data.limit < data.total}
                    disabled={query.isFetching}
                    hint={`共 ${data.total} 个房间 · 恢复失败仅在当前页内置顶`}
                    onPrevious={() => change('page', String(page - 1))}
                    onNext={() => change('page', String(page + 1))}
                  />
                </>
              )}
            </AsyncBoundary>
          </Panel>
        )}
        {selected !== undefined && (
          <Panel title={`#${selected.code} · 参与者`} className="admin-room-detail">
            {selected.status === 'failed' && (
              <p className="admin-error">
                已重试 {selected.reconciliationAttemptCount} 次 ·{' '}
                {selected.lastError ?? '无错误详情'}
              </p>
            )}
            <RoomPlayers roomCode={selected.code} />
          </Panel>
        )}
      </div>
    </>
  );
}

function RoomPlayers({ roomCode }: { roomCode: string }) {
  const query = useQuery(
    adminQueryOptions('room-players', roomCode, (signal) => fetchRoomPlayers(roomCode, signal)),
  );
  return (
    <AsyncBoundary query={query}>
      {(data) => (
        <DataTable
          caption={`${roomCode} 的参与者`}
          rows={data.players}
          rowKey={(player) => player.userId}
          columns={[
            { key: 'name', label: '用户', render: (player) => player.displayName ?? '匿名用户' },
            { key: 'level', label: '等级', numeric: true, render: (player) => player.level },
            { key: 'xp', label: 'XP', numeric: true, render: (player) => player.xp },
            { key: 'games', label: '局数', numeric: true, render: (player) => player.gamesPlayed },
            {
              key: 'place',
              label: '地区 · 节点',
              secondary: true,
              render: (player) => `${player.lastCountry ?? '未知'} · ${player.lastColo ?? '未知'}`,
            },
            {
              key: 'joined',
              label: '加入时间',
              render: (player) => <DateLabel value={player.joinedAt} />,
            },
          ]}
        />
      )}
    </AsyncBoundary>
  );
}
