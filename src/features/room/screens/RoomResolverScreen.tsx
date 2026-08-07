/** Canonical room URL resolver: metadata first, then one registered game UI module. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useServices } from '@/contexts/ServiceContext';
import { type RoomRecord, UnsupportedRoomGameTypeError } from '@/features/room/model/RoomDirectory';
import type { RegisteredRoomUiModule } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RootStackParamList } from '@/navigation/types';
import { log } from '@/utils/logger';

type NavigationProps = NativeStackScreenProps<RootStackParamList, 'Room'>;

interface RoomResolverScreenProps extends NavigationProps {
  readonly getGameModule: (gameType: GameType) => RegisteredRoomUiModule;
}

type ResolverState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'resolved';
      readonly room: RoomRecord;
      readonly module: RegisteredRoomUiModule;
    }
  | { readonly kind: 'error'; readonly message: string };

const resolverLog = log.extend('RoomResolver');

export const RoomResolverScreen: React.FC<RoomResolverScreenProps> = ({
  route,
  navigation,
  getGameModule,
}) => {
  const { roomDirectory } = useServices();
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [state, setState] = useState<ResolverState>({ kind: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    const roomCode = route.params.roomCode;
    if (!isRoomCode(roomCode)) {
      setState({ kind: 'error', message: '房间号格式错误' });
      return () => {
        isCurrent = false;
      };
    }

    setState({ kind: 'loading' });
    void roomDirectory
      .getRoom(roomCode)
      .then((room) => {
        if (!isCurrent) return;
        if (room === null) {
          setState({ kind: 'error', message: '房间不存在' });
          return;
        }
        setState({ kind: 'resolved', room, module: getGameModule(room.gameType) });
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        const cause = error instanceof Error ? error : new Error(String(error));
        const message =
          cause instanceof UnsupportedRoomGameTypeError
            ? '暂不支持该游戏类型'
            : '房间加载失败，请重试';
        resolverLog.error('room metadata resolution failed', {
          roomCode,
          error: cause.message,
        });
        Sentry.captureException(cause, { extra: { roomCode } });
        setState({ kind: 'error', message });
      });

    return () => {
      isCurrent = false;
    };
  }, [getGameModule, retryGeneration, roomDirectory, route.params.roomCode]);

  const handleRetry = useCallback(() => {
    setRetryGeneration((generation) => generation + 1);
  }, []);
  const handleBack = useCallback(() => exitRoomFlow(navigation), [navigation]);

  if (state.kind === 'loading') return <LoadingScreen message="正在查找房间" />;
  if (state.kind === 'error') {
    return <LoadingScreen error={state.message} onRetry={handleRetry} onBack={handleBack} />;
  }

  const GameRoomScreen = state.module.roomScreen;
  return (
    <GameRoomScreen
      room={state.room}
      entryReason={route.params.entryReason ?? null}
      navigation={navigation}
    />
  );
};
