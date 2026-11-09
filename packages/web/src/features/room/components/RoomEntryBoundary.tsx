/**
 * Resolved-room session boundary: game hooks mount only after the link has a snapshot.
 * Authentication is settled upstream by the room route; this boundary never renders without
 * a user.
 */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { ReactNode } from 'react';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  type RoomEntryController,
  useRoomEntryController,
} from '@/features/room/controllers/useRoomEntryController';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RoomLink } from '@/platform/realtime/types';

export function RoomEntryBoundary<TState extends BaseGameState<GameType>, TCommand extends object>({
  room,
  session,
  onExit,
  children,
}: {
  readonly room: RoomRecord<TState['gameType']>;
  readonly session: RoomLink<TState, TCommand>;
  readonly onExit: () => void;
  readonly children: (controller: RoomEntryController) => ReactNode;
}): ReactNode {
  const { user } = useAuthContext();
  if (user === null) {
    throw new Error('[FAIL-FAST] RoomEntryBoundary rendered without an authenticated user');
  }
  const controller = useRoomEntryController({
    room,
    link: session,
    authUserId: user.id,
    onExit,
  });

  if (controller.isReady) return children(controller);
  if (controller.showRetryButton) {
    return (
      <LoadingScreen
        error={controller.loadingMessage}
        onRetry={controller.retry}
        onBack={() => controller.requestExit(false)}
      />
    );
  }
  return <LoadingScreen message={controller.loadingMessage} />;
}
