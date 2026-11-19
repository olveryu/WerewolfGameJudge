/** Hosts Story Relay inside the shared room entry, connection, seat and profile shell. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { StoryRelayStatsPanel } from '@/games/storyrelay/components/StoryRelayStatsPanel';
import type { StoryRelayRoomSession } from '@/games/storyrelay/model/StoryRelayRoomSession';
import { TESTIDS } from '@/testids';

import { StoryRelayRules } from '../screens/StoryRelayRulesScreen';
import { StoryRelayStage } from './components/StoryRelayStage';
import { useStoryRelayRoomState } from './hooks/useStoryRelayRoomState';
import { createStoryRelayRoomSummarySettings } from './storyRelayRoomAdapter';

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
  const [information, setInformation] = useState<'guide' | 'configuration' | null>(null);
  const isLobby = screen.state.phase === 'lobby';
  const hasStageMenu = screen.stageHud !== null || screen.state.phase === 'gallery';
  const openGuide = () => setInformation('guide');
  const openConfiguration = () => setInformation('configuration');
  const settings = createStoryRelayRoomSummarySettings(config);
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
      showPlayerHand
      stageMenu={
        hasStageMenu ? { onOpenGuide: openGuide, onOpenConfiguration: openConfiguration } : null
      }
      configurationEntry={isLobby ? null : { onOpen: openConfiguration }}
      manualEntries={[
        { label: '玩法', onOpen: openGuide, testId: TESTIDS.roomGuideButton('storyrelay') },
      ]}
      content={
        isLobby
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
                  settings={settings}
                  guide={null}
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
      gameOverlays={
        <>
          {information === 'guide' && (
            <RoomDialog
              title="轮流讲故事玩法"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <StoryRelayRules embedded />
            </RoomDialog>
          )}
          {information === 'configuration' && (
            <RoomDialog
              title="本局配置"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <p>{`轮流讲故事（${config.numberOfPlayers}人）`}</p>
              <RoomGameSettings settings={settings} />
            </RoomDialog>
          )}
          {screen.reviewOverlay}
        </>
      }
    />
  );
}
