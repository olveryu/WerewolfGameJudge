/** Hosts Story Relay inside the shared room entry, connection, seat and profile shell. */

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';

import { StoryRelayStage } from './components/StoryRelayStage';
import { useStoryRelayRoomState } from './hooks/useStoryRelayRoomState';

type StoryRelayRoomScreenProps = GameRoomScreenProps<'storyrelay'> & {
  readonly session: StoryRelayRoomSession;
};

/** Uses the platform entry lifecycle for direct links, joins and reconnects. */
export function StoryRelayRoomScreen(props: StoryRelayRoomScreenProps) {
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(props.navigation)}
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
                  title="故事接龙"
                  subtitle={`${config.numberOfPlayers} 人 · ${config.numberOfPlayers} 棒 · ${config.writingDurationSeconds === null ? '不限时写作' : `每棒 ${config.writingDurationSeconds} 秒`} · 间隔 ${config.transitionDurationSeconds} 秒`}
                  headerRight={
                    <RoomGuideButton onPress={screen.openRules} label="查看故事接龙玩法" />
                  }
                />
              ),
            }
          : {
              kind: 'workspace',
              element: (
                <StoryRelayStage
                  state={screen.state}
                  roomId={props.room.roomId}
                  effectiveSeat={screen.effectiveSeat}
                  controlledSeat={screen.controlledSeat}
                  userId={screen.userId}
                  isHost={screen.isHost}
                  seatModel={screen.shellModel.seats}
                  session={props.session}
                />
              ),
            }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={null}
    />
  );
}
