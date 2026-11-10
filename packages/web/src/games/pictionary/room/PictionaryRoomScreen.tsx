/** Pictionary room hosted by the shared entry boundary and room shell. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import { useNavigate } from 'react-router';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

import { PictionaryRoomSummary } from './components/PictionaryRoomSummary';
import { PictionaryStage } from './components/PictionaryStage';
import { usePictionaryRoomState } from './hooks/usePictionaryRoomState';

interface PictionaryRoomScreenProps extends GameRoomScreenProps<'pictionary'> {
  readonly session: PictionaryRoomSession;
  readonly review: RoomReviewContribution<PictionaryState>;
}

/** Uses the platform entry lifecycle for direct links, joins and reconnects. */
export function PictionaryRoomScreen(props: PictionaryRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <PictionaryRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

interface PictionaryRoomContentProps extends PictionaryRoomScreenProps {
  readonly entryController: RoomEntryController;
}

function PictionaryRoomContent({ entryController, ...props }: PictionaryRoomContentProps) {
  const screen = usePictionaryRoomState({ ...props, entryController });
  const stage = (
    <PictionaryStage
      state={screen.state}
      effectiveSeat={screen.effectiveSeat}
      controlledSeat={screen.controlledSeat}
      userId={screen.userId}
      isHost={screen.isHost}
      remainingSeconds={screen.remainingSeconds}
      isOverdue={screen.isOverdue}
      session={screen.session}
      submit={screen.submit}
      isSubmitting={screen.isSubmitting}
      openReview={screen.openReview}
    />
  );
  return (
    <RoomShell
      model={screen.shellModel}
      content={
        screen.state.phase === 'lobby'
          ? {
              kind: 'seats',
              contextHeader: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <PictionaryRoomSummary
                  config={screen.state.config}
                  occupiedSeatCount={screen.occupiedSeatCount}
                  headerRight={
                    <RoomGuideButton onPress={screen.openRules} label="查看你画我猜接龙玩法说明" />
                  }
                />
              ),
            }
          : screen.stageHud !== null
            ? { kind: 'stage', hud: screen.stageHud, element: stage }
            : { kind: 'workspace', element: stage }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={screen.reviewOverlay}
    />
  );
}
