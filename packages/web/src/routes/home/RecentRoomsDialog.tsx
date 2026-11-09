import { useQueries } from '@tanstack/react-query';

import { CenterDialog } from '@/components/CenterDialog';
import { useServices } from '@/contexts/ServiceContext';
import type { RoomDirectory } from '@/features/room/model/RoomDirectory';
import { type RecentRoomIdentity, removeRecentRoom } from '@/features/room/services/recentRooms';
import { TESTIDS } from '@/testids';
import IconAlertCircle from '~icons/ion/alert-circle';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconCloudOfflineOutline from '~icons/ion/cloud-offline-outline';
import IconGameController from '~icons/ion/game-controller';
import IconHomeOutline from '~icons/ion/home-outline';

/** A stored room whose live instance reports a different game: local data is corrupt. */
class RecentRoomIntegrityError extends Error {}

type RoomStatus = { status: 'online'; createdAt: Date } | { status: 'offline' };

/** Looks a recent room up; rooms that closed (or were replaced) leave the history. */
async function checkRecentRoom(
  directory: RoomDirectory,
  ownerUserId: string,
  identity: RecentRoomIdentity,
): Promise<RoomStatus> {
  const room = await directory.getRoom(identity.roomCode);
  if (room === null || room.roomId !== identity.roomId) {
    removeRecentRoom(ownerUserId, identity.roomId);
    return { status: 'offline' };
  }
  if (room.gameType !== identity.gameType) {
    throw new RecentRoomIntegrityError(
      `Recent room ${identity.roomId} changed game type from ${identity.gameType} to ${room.gameType}`,
    );
  }
  return { status: 'online', createdAt: room.createdAt };
}

function formatRoomCode(code: string): string {
  return code.split('').join(' ');
}

/** "今天 14:32" / "昨天 20:15" / "05/07 09:30". */
function formatRelativeTime(date: Date): string {
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `今天 ${hhmm}`;
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`;
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${hhmm}`;
}

function RecentRoomList({
  ownerUserId,
  rooms,
  onJoin,
}: {
  ownerUserId: string;
  rooms: readonly RecentRoomIdentity[];
  onJoin: (roomCode: string) => void;
}) {
  const { roomDirectory } = useServices();
  const results = useQueries({
    queries: rooms.map((identity) => ({
      queryKey: ['recentRoom', identity.roomId],
      queryFn: () => checkRecentRoom(roomDirectory, ownerUserId, identity),
      staleTime: 0,
      gcTime: 0,
      throwOnError: (error: Error) => error instanceof RecentRoomIntegrityError,
    })),
  });

  const entries = rooms.map((identity, index) => ({ identity, result: results[index] }));
  const visible = entries.filter(({ result }) => result?.data?.status !== 'offline');
  const allSettled = results.every((result) => !result.isPending);
  const anyOnline = results.some((result) => result.data?.status === 'online');
  const allFailed =
    allSettled && visible.length > 0 && visible.every(({ result }) => result?.isError);

  return (
    <ul className="recent-rooms">
      {visible.map(({ identity, result }) => {
        const online = result?.data?.status === 'online' ? result.data : null;
        const state = online ? 'online' : result?.isError ? 'error' : 'checking';
        return (
          <li key={identity.roomId}>
            <button
              type="button"
              className="recent-room"
              data-state={state}
              disabled={online === null}
              data-testid={TESTIDS.recentRoomJoin(identity.roomCode)}
              onClick={() => onJoin(identity.roomCode)}
            >
              <span className="recent-room-icon" aria-hidden>
                {state === 'online' && <IconGameController />}
                {state === 'error' && <IconAlertCircle />}
                {state === 'checking' && <span className="spinner" />}
              </span>
              <span className="recent-room-body">
                <span className="recent-room-code">{formatRoomCode(identity.roomCode)}</span>
                <span className="recent-room-status">
                  {state === 'online' ? '房间在线' : state === 'error' ? '网络异常' : '检查中...'}
                </span>
              </span>
              {online && (
                <span className="recent-room-time">
                  {formatRelativeTime(online.createdAt)}
                  <IconChevronForward aria-hidden />
                </span>
              )}
            </button>
          </li>
        );
      })}
      {allSettled && !anyOnline && !allFailed && (
        <li className="recent-rooms-empty">
          <IconHomeOutline aria-hidden />
          <span>暂无可用房间</span>
          <span className="recent-rooms-empty-hint">之前的房间已关闭</span>
        </li>
      )}
      {allFailed && (
        <li className="recent-rooms-empty">
          <IconCloudOfflineOutline aria-hidden />
          <span>网络异常，请稍后重试</span>
        </li>
      )}
    </ul>
  );
}

interface RecentRoomsDialogProps {
  open: boolean;
  ownerUserId: string;
  rooms: readonly RecentRoomIdentity[];
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

/** Recent rooms, newest first, each checked live; only online rooms can be entered. */
export function RecentRoomsDialog({
  open,
  ownerUserId,
  rooms,
  onClose,
  onJoin,
}: RecentRoomsDialogProps) {
  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      title="最近房间"
      subtitle="按最近进入顺序排列，点击即可进入"
      testId={TESTIDS.recentRoomsModal}
    >
      <RecentRoomList ownerUserId={ownerUserId} rooms={rooms} onJoin={onJoin} />
    </CenterDialog>
  );
}
