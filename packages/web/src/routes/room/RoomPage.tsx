/**
 * Canonical room URL (`/room/:roomCode`): session first, then room metadata, then the room's game
 * client. `/room/get` is authenticated (room codes must not be enumerable), so without a user the
 * page asks for a login; the metadata lookup is keyed by the user and never outlives a session.
 */
import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect } from 'react';
import { useLocation, useNavigate, useParams, useRouteError } from 'react-router';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { requestLogin } from '@/features/auth/loginRequests';
import { type RoomRecord, UnsupportedRoomGameTypeError } from '@/features/room/model/RoomDirectory';
import type { RoomEntryReason } from '@/features/room/model/RoomUiModule';
import {
  exitRoomFlow,
  type RoomLocationState,
} from '@/features/room/navigation/roomFlowNavigation';
import { UnportedGameClientError, useClientGameModule } from '@/games/clientModules';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import { isMiniProgram, wxReLaunch } from '@/utils/miniProgram';

const resolverLog = log.extend('RoomResolver');

function isRoomLocationState(value: unknown): value is RoomLocationState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'entryReason' in value &&
    value.entryReason === 'created'
  );
}

/** Opens the login dialog for a direct room link; cancelling leaves for Home. */
function RoomLoginGate() {
  const navigate = useNavigate();
  useEffect(() => {
    void requestLogin({ title: '登录', subtitle: '选择登录方式以加入房间' }).then((outcome) => {
      if (outcome === 'cancelled') exitRoomFlow(navigate);
    });
  }, [navigate]);
  return <LoadingScreen message="请先登录" />;
}

/** Inside the mini program a missing session means the WeChat login failed: re-enter it. */
function MiniProgramAuthFailure() {
  const navigate = useNavigate();
  return (
    <main className="loading-screen">
      <p className="loading-screen-error">微信登录失败</p>
      <p className="loading-screen-message">请重新进入小程序以获取新的登录凭证</p>
      <div className="loading-screen-actions">
        <Button onClick={wxReLaunch}>重新进入</Button>
        <Button variant="ghost" onClick={() => exitRoomFlow(navigate)}>
          返回首页
        </Button>
      </div>
    </main>
  );
}

function GameRoom({ room }: { readonly room: RoomRecord }) {
  const location = useLocation();
  const module = useClientGameModule(room.gameType);
  const entryReason: RoomEntryReason = isRoomLocationState(location.state) ? 'created' : null;
  const RoomScreen = module.roomScreen;
  return <RoomScreen room={room} entryReason={entryReason} />;
}

function RoomMetadataResolver({ roomCode, userId }: { roomCode: string; userId: string }) {
  const navigate = useNavigate();
  const { roomDirectory } = useServices();
  const query = useQuery({
    queryKey: ['roomMetadata', userId, roomCode],
    queryFn: async () => {
      try {
        return await roomDirectory.getRoom(roomCode);
      } catch (error) {
        handleError(error, { label: '加载房间元数据', logger: resolverLog, feedback: false });
        throw error;
      }
    },
    staleTime: 0,
    gcTime: 0,
  });
  const goHome = () => exitRoomFlow(navigate);

  if (query.isPending) return <LoadingScreen message="正在查找房间" />;
  if (query.isError) {
    const message =
      query.error instanceof UnsupportedRoomGameTypeError
        ? '暂不支持该游戏类型'
        : '房间加载失败，请重试';
    return <LoadingScreen error={message} onRetry={() => void query.refetch()} onBack={goHome} />;
  }
  if (query.data === null) return <LoadingScreen error="房间不存在" onBack={goHome} />;
  return (
    <Suspense fallback={<LoadingScreen message="正在进入房间" />}>
      <GameRoom key={query.data.roomId} room={query.data} />
    </Suspense>
  );
}

export function RoomPage() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const { user, loading: isAuthLoading } = useAuthContext();
  if (roomCode === undefined || !isRoomCode(roomCode)) {
    return <LoadingScreen error="房间号格式错误" onBack={() => exitRoomFlow(navigate)} />;
  }
  if (isAuthLoading) return <LoadingScreen message="正在查找房间" />;
  if (user === null) return isMiniProgram() ? <MiniProgramAuthFailure /> : <RoomLoginGate />;
  return <RoomMetadataResolver key={user.id} roomCode={roomCode} userId={user.id} />;
}

/** Route error element: an unported game client or a failed game chunk load lands here. */
export function RoomPageError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const isUnported = error instanceof UnportedGameClientError;
  useEffect(() => {
    if (!isUnported)
      handleError(error, { label: '进入房间', logger: resolverLog, feedback: false });
  }, [error, isUnported]);
  return (
    <LoadingScreen
      error={isUnported ? '暂不支持该游戏类型' : '房间加载失败，请重试'}
      onBack={() => exitRoomFlow(navigate)}
    />
  );
}
