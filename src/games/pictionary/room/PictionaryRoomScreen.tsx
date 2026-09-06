/** Pictionary room hosted by the shared entry boundary and room shell. */

import { getPictionaryOccupiedSeatCount } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useCallback } from 'react';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

import { PictionaryRoomSummary } from './components/PictionaryRoomSummary';
import { PictionaryStage } from './components/PictionaryStage';
import { usePictionaryRoomScreenState } from './hooks/usePictionaryRoomScreenState';

interface PictionaryRoomScreenProps extends GameRoomScreenProps<'pictionary'> {
  readonly session: PictionaryRoomSession;
}

export const PictionaryRoomScreen: React.FC<PictionaryRoomScreenProps> = (props) => {
  const handleExit = useCallback(() => exitRoomFlow(props.navigation), [props.navigation]);
  return (
    <RoomEntryBoundary room={props.room} session={props.session} onExit={handleExit}>
      {(entryController) => <PictionaryRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
};

interface PictionaryRoomContentProps extends PictionaryRoomScreenProps {
  readonly entryController: RoomEntryController;
}

const PictionaryRoomContent: React.FC<PictionaryRoomContentProps> = ({
  entryController,
  ...props
}) => {
  const screen = usePictionaryRoomScreenState({ ...props, entryController });
  const isLobby = screen.state.phase === 'lobby';
  return (
    <RoomShell
      model={screen.shellModel}
      gameWorkspace={
        isLobby ? null : (
          <PictionaryStage
            state={screen.state}
            effectiveSeat={screen.effectiveSeat}
            controlledSeat={screen.controlledSeat}
            userId={screen.userId}
            isHost={screen.isHost}
            seatModel={screen.shellModel.seats}
            session={screen.session}
          />
        )
      }
      contextHeader={null}
      leadingExtraActions={null}
      trailingExtraActions={null}
      beforeSeatBoard={
        <PictionaryRoomSummary
          config={screen.state.config}
          occupiedSeatCount={getPictionaryOccupiedSeatCount(screen.state)}
          onOpenRules={screen.openRules}
        />
      }
      afterSeatBoard={null}
      sideInspector={null}
      gameOverlays={null}
    />
  );
};
