/** Pictionary room hosted by the shared entry boundary and room shell. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { PictionaryStatsPanel } from '@/games/pictionary/components/PictionaryStatsPanel';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { TESTIDS } from '@/testids';

import { PictionaryRules } from '../screens/PictionaryRulesScreen';
import {
  createPictionaryRoomSummarySettings,
  PictionaryRoomSummary,
} from './components/PictionaryRoomSummary';
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
  const [information, setInformation] = useState<RoomInformation>(null);
  const config = screen.state.config;
  const isLobby = screen.state.phase === 'lobby';
  const hasStageMenu = screen.stageHud !== null || screen.state.phase === 'gallery';
  const openGuide = () => setInformation('guide');
  const openConfiguration = () => setInformation('configuration');
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
      phaseLabel={isLobby ? '待开局' : null}
      lobbyAction={isLobby ? { label: '开始游戏', occupiedSeats: screen.occupiedSeatCount } : null}
      actionSurface={hasStageMenu ? 'menu' : 'hand'}
      directory={{
        main: [],
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            icon: 'book-outline',
            testID: TESTIDS.roomGuideButton('pictionary'),
            opensDialog: true,
            state: { kind: 'ready', onPress: openGuide },
          },
        ],
        openConfiguration: isLobby ? null : openConfiguration,
      }}
      content={
        isLobby
          ? {
              kind: 'seats',
              contextHeader: null,
              afterSeatBoard: null,
              beforeSeatBoard: <PictionaryRoomSummary config={config} guide={null} />,
            }
          : screen.stageHud !== null
            ? { kind: 'stage', hud: screen.stageHud, element: stage }
            : { kind: 'workspace', element: stage }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <PictionaryStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="你画我猜接龙玩法"
            guide={<PictionaryRules embedded />}
            configuration={
              <>
                <p>{`你画我猜接龙（${config.numberOfPlayers}人）`}</p>
                <RoomGameSettings settings={createPictionaryRoomSummarySettings(config)} />
              </>
            }
            onClose={() => setInformation(null)}
          />
          {screen.reviewOverlay}
        </>
      }
    />
  );
}
