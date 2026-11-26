/** 解码战房间：大厅复用共享座位表，开局后进入舞台工作区。 */
import './DecryptoRoomScreen.css';

import {
  type DecryptoState,
  getDecryptoOccupiedSeatCount,
} from '@game-judge/game-engine/games/decrypto/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { DecryptoRoomSession } from '@/games/decrypto/model/DecryptoRoomSession';
import { TESTIDS } from '@/testids';

import { DecryptoStatsPanel } from '../components/DecryptoStatsPanel';
import { DecryptoRules } from '../screens/DecryptoRulesScreen';
import { DecryptoStage } from './DecryptoStage';
import { type DecryptoRoomScreenState, useDecryptoRoomState } from './hooks/useDecryptoRoomState';

type DecryptoRoomScreenProps = GameRoomScreenProps<'decrypto'> & {
  readonly session: DecryptoRoomSession;
  readonly review: RoomReviewContribution<DecryptoState>;
};

/** Uses the shared room-entry lifecycle for deep links, joining, and reconnects. */
export function DecryptoRoomScreen(props: DecryptoRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <DecryptoRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function DecryptoRoomContent(
  props: DecryptoRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useDecryptoRoomState(props);
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  const [information, setInformation] = useState<RoomInformation>(null);
  const openGuide = () => setInformation('guide');
  const openConfiguration = () => setInformation('configuration');
  return (
    <RoomShell
      model={screen.shellModel}
      phaseLabel={
        isLobby ? '待开局' : screen.state.phase.kind === 'ended' ? '本局结束' : '游戏进行中'
      }
      lobbyAction={
        isLobby
          ? {
              label: '开始游戏',
              occupiedSeats: getDecryptoOccupiedSeatCount(screen.state),
            }
          : null
      }
      actionSurface={isLobby || screen.state.phase.kind === 'ended' ? 'hand' : 'menu'}
      directory={{
        main: [],
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            icon: 'book-outline',
            testID: TESTIDS.roomGuideButton('decrypto'),
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
              bottomSummary: null,
              afterSeatBoard: null,
              beforeSeatBoard: (
                <RoomGameSummary
                  title="解码战"
                  playerCount={config.numberOfPlayers}
                  settings={[
                    {
                      label: '出题模式',
                      value: config.encryptorMode === 'rotating' ? '随机轮换' : '固定出题',
                    },
                  ]}
                  guide={{ label: '查看玩法', onPress: openGuide }}
                />
              ),
            }
          : screen.state.phase.kind === 'playing'
            ? {
                kind: 'stage',
                hud: {
                  rosterPlacement: 'primary',
                  chips: [{ key: 'game', label: '解码战', detail: null, tone: 'accent' }],
                  secondaryChips: [],
                  timer: null,
                  roster: {
                    chipLabel: `名单 ${screen.viewModel.seats.length} 人`,
                    title: '本局玩家',
                    groupTitles: { acting: '行动中', pending: '参与中', done: '已提交' },
                    actingSeat: null,
                    pendingLabel: '参与中',
                    isUrgent: false,
                  },
                },
                element: <DecryptoStage screen={screen} />,
              }
            : { kind: 'workspace', element: <DecryptoStage screen={screen} /> }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <DecryptoStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="解码战玩法"
            guide={<DecryptoRules embedded />}
            configuration={
              <>
                <p>{`解码战（${config.numberOfPlayers}人）`}</p>
                <p>{`出题模式：${config.encryptorMode === 'rotating' ? '随机轮换' : '固定出题'}`}</p>
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

export type { DecryptoRoomScreenState };
