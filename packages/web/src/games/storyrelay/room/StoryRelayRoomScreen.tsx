/** Hosts Story Relay inside the shared room entry, connection, seat and profile shell. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useNavigate } from 'react-router';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

import { StoryRelayStage } from './components/StoryRelayStage';
import { useStoryRelayRoomState } from './hooks/useStoryRelayRoomState';

interface StoryRelayRoomScreenProps extends GameRoomScreenProps<'storyrelay'> {
  readonly session: StoryRelayRoomSession;
  readonly review: RoomReviewContribution<StoryRelayState>;
}

/** Uses the platform entry lifecycle for direct links, joins and reconnects. */
export function StoryRelayRoomScreen(props: StoryRelayRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <StoryRelayRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function StoryRelayRoomContent(
  props: StoryRelayRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useStoryRelayRoomState(props);
  const config = screen.state.config;
  const stage = (
    <StoryRelayStage
      state={screen.state}
      effectiveSeat={screen.effectiveSeat}
      controlledSeat={screen.controlledSeat}
      userId={screen.userId}
      isHost={screen.isHost}
      remainingSeconds={screen.remainingSeconds}
      isOverdue={screen.isOverdue}
      session={props.session}
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
                <RoomGameSummary
                  icon="book-outline"
                  title={`故事接龙 · ${config.numberOfPlayers}人局`}
                  subtitle={`${config.numberOfPlayers} 棒 · ${config.writingDurationSeconds === null ? '不限时写作' : `每棒 ${config.writingDurationSeconds} 秒`} · 间隔 ${config.transitionDurationSeconds} 秒`}
                  headerRight={
                    <RoomGuideButton onPress={screen.openRules} label="查看故事接龙玩法" />
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
