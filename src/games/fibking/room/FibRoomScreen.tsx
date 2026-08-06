/** FibKing room rendered entirely through the shared RoomEntryBoundary and RoomShell. */

import type React from 'react';
import { useCallback } from 'react';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { FibRoomSession } from '@/games/fibking/model/FibRoomSession';

import { FibIdentityModal } from './components/FibIdentityModal';
import { FibRoomSummary } from './components/FibRoomSummary';
import { useFibRoomScreenState } from './hooks/useFibRoomScreenState';

interface FibRoomScreenProps extends GameRoomScreenProps<'fibking'> {
  readonly session: FibRoomSession;
}

export const FibRoomScreen: React.FC<FibRoomScreenProps> = ({
  room,
  entryReason,
  navigation,
  session,
}) => {
  const handleExit = useCallback(() => navigation.navigate('Home'), [navigation]);
  return (
    <RoomEntryBoundary room={room} session={session} onExit={handleExit}>
      {(entryController) => (
        <FibRoomContent
          room={room}
          entryReason={entryReason}
          navigation={navigation}
          session={session}
          entryController={entryController}
        />
      )}
    </RoomEntryBoundary>
  );
};

interface FibRoomContentProps extends FibRoomScreenProps {
  readonly entryController: RoomEntryController;
}

const FibRoomContent: React.FC<FibRoomContentProps> = ({
  room,
  entryReason,
  navigation,
  session,
  entryController,
}) => {
  const screen = useFibRoomScreenState({
    room,
    entryReason,
    navigation,
    session,
    entryController,
  });

  return (
    <RoomShell
      model={screen.shellModel}
      leadingExtraActions={null}
      trailingExtraActions={null}
      beforeSeatBoard={
        <FibRoomSummary
          phase={screen.phase}
          occupiedSeatCount={screen.occupiedSeatCount}
          playerCount={screen.playerCount}
          onOpenRules={screen.openRules}
        />
      }
      afterSeatBoard={null}
      gameOverlays={
        screen.isIdentityVisible && screen.roundView !== null ? (
          <FibIdentityModal view={screen.roundView} onClose={screen.closeIdentity} />
        ) : null
      }
    />
  );
};
