/** Hosts Story Relay inside the shared room entry, connection, seat and profile shell. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useNavigate } from 'react-router';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { StoryRelayStatsPanel } from '@/games/storyrelay/components/StoryRelayStatsPanel';
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
              bottomSummary: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <RoomGameSummary
                  title="轮流讲故事"
                  playerCount={config.numberOfPlayers}
                  settings={[
                    { label: '总棒数', value: `${config.numberOfPlayers} 棒` },
                    {
                      label: '写作时限',
                      value:
                        config.writingDurationSeconds === null
                          ? '不限时'
                          : `${config.writingDurationSeconds} 秒`,
                    },
                    { label: '过渡间隔', value: `${config.transitionDurationSeconds} 秒` },
                  ]}
                  guide={{ onPress: screen.openRules, label: '查看轮流讲故事玩法' }}
                />
              ),
            }
          : screen.stageHud !== null
            ? { kind: 'stage', hud: screen.stageHud, element: stage }
            : { kind: 'workspace', element: stage }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <StoryRelayStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={screen.reviewOverlay}
    />
  );
}
