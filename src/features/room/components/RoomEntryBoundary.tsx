/** Resolved-room auth and session boundary; game hooks mount only after a snapshot exists. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  type RoomEntryController,
  useRoomEntryController,
} from '@/features/room/controllers/useRoomEntryController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RoomSessionClient, RoomUserEvent } from '@/features/room/session/types';
import { colors, componentSizes } from '@/theme';
import { isMiniProgram } from '@/utils/miniProgram';

import { RoomAuthGate } from './RoomAuthGate';
import { roomEntryStyles as styles } from './roomEntry.styles';
import { RoomMiniProgramAuthFailure } from './RoomMiniProgramAuthFailure';

interface RoomEntryBoundaryProps<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
  TEvent extends RoomUserEvent,
> {
  readonly room: RoomRecord;
  readonly session: RoomSessionClient<TState, TCommand, TEvent>;
  readonly onExit: () => void;
  readonly children: (controller: RoomEntryController) => React.ReactNode;
}

export function RoomEntryBoundary<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
  TEvent extends RoomUserEvent,
>({
  room,
  session,
  onExit,
  children,
}: RoomEntryBoundaryProps<TState, TCommand, TEvent>): React.ReactNode {
  const { user, loading: isAuthLoading } = useAuthContext();
  const controller = useRoomEntryController({
    room,
    session,
    authUserId: user?.id ?? null,
    isAuthLoading,
    onExit,
  });

  if (controller.isAuthRequired) {
    if (isMiniProgram()) {
      return <RoomMiniProgramAuthFailure onCancel={() => controller.requestExit(false)} />;
    }
    return (
      <RoomAuthGate onSuccess={() => undefined} onCancel={() => controller.requestExit(false)} />
    );
  }

  if (controller.isReady) return children(controller);

  if (controller.showRetryButton) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="warning-outline" size={componentSizes.icon.xl} color={colors.error} />
        <Text style={styles.errorText}>{controller.loadingMessage}</Text>
        <View style={styles.actionRow}>
          <Button variant="primary" onPress={controller.retry}>
            重试
          </Button>
          <Button variant="secondary" onPress={() => controller.requestExit(false)}>
            返回首页
          </Button>
        </View>
      </View>
    );
  }

  return <LoadingScreen message={controller.loadingMessage} />;
}
