/** 秘密希特勒房间：全程保留共享座位表，公共身份配置可折叠。 */
import './SecrethitlerRoomScreen.css';

import {
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerRoleCounts,
  type SecrethitlerPolicy,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { BoardInfoContent } from '@/features/room/components/BoardInfoContent';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomBgmToggle } from '@/features/room/components/RoomBgmToggle';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import { formatSettleCountdown } from '@/features/room/model/formatCountdown';
import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { SecrethitlerAudioRuntime } from '@/games/secrethitler/audio/secrethitlerAudioRuntime';
import type { SecrethitlerRoomSession } from '@/games/secrethitler/model/SecrethitlerRoomSession';
import { TESTIDS } from '@/testids';

import {
  secrethitlerPolicyFascistImage,
  secrethitlerPolicyLiberalImage,
} from '../assets/secrethitlerPolicyImages';
import {
  secrethitlerVoteFailImage,
  secrethitlerVotePassImage,
} from '../assets/secrethitlerVoteImages';
import { toRevealRoleData } from '../components/SecrethitlerRoleCardAdapter';
import { SecrethitlerStatsPanel } from '../components/SecrethitlerStatsPanel';
import { SecrethitlerRules } from '../screens/SecrethitlerRulesScreen';
import {
  type SecrethitlerRoomScreenState,
  useSecrethitlerRoomState,
} from './hooks/useSecrethitlerRoomState';
import { SecrethitlerActionSheet } from './SecrethitlerActionSheet';
import { SecrethitlerMatchDetails } from './SecrethitlerHistory';
import {
  formatSecrethitlerVoteMode,
  SECRETHITLER_PHASE_LABELS,
  secrethitlerSeatLabel,
} from './secrethitlerPresentation';
import { SECRETHITLER_GAME_ACTION_KEY } from './secrethitlerRoomAdapter';
import { buildSecrethitlerRoomTracks, getSecrethitlerLatestResult } from './secrethitlerRoomTracks';

type SecrethitlerRoomScreenProps = GameRoomScreenProps<'secrethitler'> & {
  readonly session: SecrethitlerRoomSession;
  readonly audio: SecrethitlerAudioRuntime;
  /** 模块声明的本局复盘（defineClientGameModule 的 review）；房间只渲染这一份。 */
  readonly review: RoomReviewContribution<SecrethitlerState>;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function SecrethitlerRoomScreen(props: SecrethitlerRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => (
        <SecrethitlerRoomContent {...props} entryController={entryController} />
      )}
    </RoomEntryBoundary>
  );
}

/** The public match status and tracks wait until roles are viewed and first-night narration ends. */
export function shouldShowMatchSummary(state: SecrethitlerState): boolean {
  return (
    state.phase.kind !== 'lobby' &&
    state.phase.kind !== 'viewing' &&
    state.phase.kind !== 'night' &&
    !state.isAudioPlaying
  );
}

function SecrethitlerRoomContent(
  props: SecrethitlerRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useSecrethitlerRoomState(props);
  const [information, setInformation] = useState<RoomInformation>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const isLobby = screen.state.phase.kind === 'lobby';
  const isPreGame = isLobby || screen.state.phase.kind === 'viewing';
  const showHistory = screen.viewModel !== null && shouldShowMatchSummary(screen.state);
  const { remainingSeconds: voteRemainingSeconds } = useStageDeadline({
    deadlineAt: screen.state.phase.kind === 'voting' ? screen.state.phase.deadlineAt : null,
  });
  const matchStatus =
    showHistory && screen.viewModel !== null
      ? buildSecrethitlerBoardStatus({
          state: screen.state,
          view: screen.viewModel,
          actionMessage: screen.shellModel.playerActions.message,
          remainingSeconds: voteRemainingSeconds,
        })
      : null;
  if (historyVisible && !showHistory) setHistoryVisible(false);
  return (
    <RoomShell
      model={screen.shellModel}
      selectionMode={
        screen.isSelecting
          ? { kind: 'player', escapeActionKey: SECRETHITLER_GAME_ACTION_KEY }
          : undefined
      }
      phaseLabel={
        isLobby
          ? '待开局'
          : isPreGame
            ? '已发牌'
            : screen.state.phase.kind === 'night'
              ? '夜晚'
              : screen.state.phase.kind === 'ended'
                ? '本局结束'
                : '游戏进行中'
      }
      lobbyAction={
        isLobby
          ? { label: '分配角色', occupiedSeats: getSecrethitlerOccupiedSeatCount(screen.state) }
          : null
      }
      directory={{
        main: showHistory
          ? [
              {
                key: 'history',
                label: '对局记录',
                category: 'resource',
                icon: 'document-text-outline',
                opensDialog: true,
                state: { kind: 'ready', onPress: () => setHistoryVisible(true) },
              },
            ]
          : [],
        manual: [
          {
            key: 'guide',
            label: '玩法',
            category: 'resource',
            icon: 'book-outline',
            testID: TESTIDS.roomGuideButton('secrethitler'),
            opensDialog: true,
            state: { kind: 'ready', onPress: () => setInformation('guide') },
          },
        ],
        openConfiguration: isPreGame ? null : () => setInformation('configuration'),
      }}
      content={{
        kind: 'seats',
        boardStatus: matchStatus,
        statusIcon: screen.state.phase.kind === 'night' ? 'moon-outline' : 'time-outline',
        contextHeader: null,
        informationLayout: showHistory ? 'scroll-with-seats' : 'fixed',
        beforeSeatBoard: <>{isPreGame && <SecrethitlerBoardInfo state={screen.state} />}</>,
        afterSeatBoard: null,
      }}
      leadingExtraActions={
        screen.isHost && screen.state.phase.kind === 'night' ? (
          <RoomBgmToggle bgm={screen.bgm} />
        ) : null
      }
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <SecrethitlerStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="秘密希特勒玩法"
            guide={<SecrethitlerRules embedded />}
            configuration={<SecrethitlerBoardInfo state={screen.state} embedded />}
            onClose={() => setInformation(null)}
          />
          {historyVisible && screen.viewModel !== null && showHistory && (
            <SecrethitlerHistoryDialog
              state={screen.state}
              view={screen.viewModel}
              mySeat={screen.mySeat}
              onClose={() => setHistoryVisible(false)}
            />
          )}
          <RoomAudioResumeDialog
            visible={screen.audioResume.isDue}
            onContinue={screen.audioResume.continueGame}
          />
          <RevealRoleCardModal
            visible={screen.roleViewing.isOpen}
            requireConfirmation
            roleKey={screen.viewModel?.myIdentity ?? null}
            toRoleData={toRevealRoleData}
            allRoles={screen.roleCardAllRoles}
            shouldPlay={screen.roleViewing.shouldPlayAnimation}
            remainingCards={screen.roleViewing.remainingCards}
            confirmDisabled={screen.roleViewing.isConfirmationDisabled}
            onClose={screen.roleViewing.close}
          />
          {screen.actionModalOpen && <SecrethitlerActionSheet screen={screen} />}
          <SecrethitlerInvestigationResult screen={screen} />
          {screen.reviewOverlay}
          <SecrethitlerPublicResult screen={screen} />
        </>
      }
    />
  );
}

export function SecrethitlerPublicResult({
  screen,
}: {
  readonly screen: Pick<
    SecrethitlerRoomScreenState,
    | 'state'
    | 'viewModel'
    | 'effectiveSeat'
    | 'controlledSeat'
    | 'isHost'
    | 'isSubmitting'
    | 'submit'
  >;
}) {
  const phase = screen.state.phase;
  const { remainingSeconds, isOverdue } = useStageDeadline({
    deadlineAt: phase.kind === 'publicResult' ? phase.deadlineAt : null,
  });
  const view = screen.viewModel;
  if (phase.kind !== 'publicResult' || view === null) return null;
  const previous = phase.previous;
  const voteResult = view.publicVoteResult;
  if (previous.kind === 'voting' && voteResult === null)
    throw new Error('Secret Hitler public vote result is missing from the view model');
  if (view.voteMode === 'public' && voteResult?.votes === null)
    throw new Error('Secret Hitler public ballots are missing from the view model');
  const policyLabel = (policy: 'liberal' | 'fascist') =>
    policy === 'liberal' ? '自由派' : '法西斯';
  return (
    <CenterDialog open title="公共结果" requireConfirmation onClose={() => undefined}>
      {previous.kind === 'voting' && voteResult !== null && (
        <>
          <img
            src={voteResult.passed ? secrethitlerVotePassImage : secrethitlerVoteFailImage}
            alt=""
            decoding="async"
            className="secrethitler-result-banner-image"
            data-testid={TESTIDS.secrethitlerSettledVoteBanner}
          />
          <p
            className="secrethitler-result-summary"
            data-testid={TESTIDS.secrethitlerVoteResultSummary}
          >
            政府{voteResult.passed ? '通过' : '未通过'}：赞成 {voteResult.yesCount}，反对{' '}
            {voteResult.noCount}
          </p>
          {view.voteMode === 'public' && voteResult.votes !== null && (
            <section className="secrethitler-vote-details" aria-label="投票明细">
              <h2>投票明细</h2>
              <ul role="list">
                {voteResult.votes.map(({ seat: voter, vote }) => (
                  <li key={voter} data-testid={TESTIDS.secrethitlerVoteResultRow(voter)}>
                    <span>{secrethitlerSeatLabel(view, voter)}</span>
                    <strong>{vote === 'ja' ? '赞成' : '反对'}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {previous.kind === 'legislativeChancellor' && phase.policy !== null && (
        <>
          <PolicyResultImage policy={phase.policy} />
          <p className="secrethitler-result-summary">施行{policyLabel(phase.policy)}政策</p>
        </>
      )}
      {previous.kind === 'vetoResponse' && <p>总统{phase.vetoApproved ? '同意' : '拒绝'}否决</p>}
      {phase.chaosPolicy !== null && (
        <>
          <PolicyResultImage policy={phase.chaosPolicy} />
          <p className="secrethitler-result-summary">
            混乱：自动施行{policyLabel(phase.chaosPolicy)}政策
          </p>
        </>
      )}
      {remainingSeconds === null && <p>等待进入下一阶段…</p>}
      {remainingSeconds !== null && remainingSeconds > 0 && <p>{`${remainingSeconds} 秒后继续`}</p>}
      <StageSettleRescue
        remainingSeconds={remainingSeconds}
        isOverdue={isOverdue}
        isHost={screen.isHost}
        isRetrying={screen.isSubmitting}
        onRetry={() =>
          void screen.submit(
            '重新推进',
            { type: 'secrethitler.phase.retrySettle' },
            { actionKey: null },
          )
        }
        waitingLabel="等待进入下一阶段…"
      />
    </CenterDialog>
  );
}

function PolicyResultImage({ policy }: { readonly policy: SecrethitlerPolicy }) {
  return (
    <img
      src={policy === 'liberal' ? secrethitlerPolicyLiberalImage : secrethitlerPolicyFascistImage}
      alt=""
      decoding="async"
      className="secrethitler-policy-result-image"
      data-testid={TESTIDS.secrethitlerPolicyResultImage}
    />
  );
}

/** Displays the pending result only to the investigating seat. */
export function SecrethitlerInvestigationResult({
  screen,
}: {
  readonly screen: Pick<
    SecrethitlerRoomScreenState,
    'viewModel' | 'submit' | 'controlledSeat' | 'isSubmitting'
  >;
}) {
  const view = screen.viewModel;
  const result = view?.myInvestigation;
  if (view === null || result === null || result === undefined) return null;
  const acknowledge = () =>
    void screen.submit(
      '确认调查结果',
      { type: 'secrethitler.action.acknowledgeInvestigation' },
      { controlledSeat: screen.controlledSeat, actionKey: null },
    );
  return (
    <CenterDialog
      open
      title="私密调查结果"
      requireConfirmation
      onClose={acknowledge}
      testId={TESTIDS.secrethitlerInvestigationResultDialog}
      titleTestId={TESTIDS.secrethitlerInvestigationResultTitle}
    >
      <p data-testid={TESTIDS.secrethitlerInvestigationResultFaction}>
        {secrethitlerSeatLabel(view, result.targetSeat)}：
        {result.faction === 'liberal' ? '自由派' : '法西斯阵营'}
      </p>
      <Button
        disabled={screen.isSubmitting}
        data-testid={TESTIDS.secrethitlerInvestigationAcknowledge}
        onClick={acknowledge}
      >
        知道了
      </Button>
    </CenterDialog>
  );
}

/** Public role composition shared by the lobby and configuration dialog. */
export function SecrethitlerBoardInfo({
  state,
  embedded = false,
}: {
  readonly state: SecrethitlerState;
  readonly embedded?: boolean;
}) {
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const counts = getSecrethitlerRoleCounts(state.config.numberOfPlayers);
  const settings = [
    { label: '投票方式', value: formatSecrethitlerVoteMode(state.config.voteMode) },
  ];
  const board = (
    <BoardInfoContent
      sections={[
        {
          title: '自由派',
          tone: 'villager',
          items: [{ roleId: 'liberal', displayName: '自由派', count: counts.liberal }],
        },
        {
          title: '法西斯阵营',
          tone: 'wolf',
          items: [
            { roleId: 'fascist', displayName: '法西斯', count: counts.fascist },
            { roleId: 'hitler', displayName: '希特勒', count: counts.hitler },
          ],
        },
      ]}
      onRolePress={setPreviewRole}
      footer={null}
    />
  );
  return (
    <>
      {embedded ? (
        <>
          <p>{`秘密希特勒（${state.config.numberOfPlayers}人）`}</p>
          {board}
          <RoomGameSettings settings={settings} />
        </>
      ) : (
        <RoomGameSummary
          title="秘密希特勒"
          playerCount={state.config.numberOfPlayers}
          settings={settings}
          guide={null}
        >
          {board}
        </RoomGameSummary>
      )}
      {previewRole !== null && (
        <RoleCardDialog role={toRevealRoleData(previewRole)} onClose={() => setPreviewRole(null)} />
      )}
    </>
  );
}

/** Public submission status and interactive policy tracks for the room's one status bar. */
export function buildSecrethitlerBoardStatus({
  state,
  view,
  actionMessage,
  remainingSeconds,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
  readonly actionMessage: string | null;
  readonly remainingSeconds: number | null;
}): RoomBoardStatusModel {
  const phase = state.phase;
  const pending = view.pendingVoteSeats;
  if (phase.kind === 'voting' && pending === null)
    throw new Error('Secret Hitler voting view is missing submission progress');
  const isVoting = phase.kind === 'voting' && pending !== null && pending.length > 0;
  return {
    context:
      phase.kind === 'voting' ? (isVoting ? '政府投票中' : '政府投票') : getMatchSummary(state),
    message:
      phase.kind === 'voting'
        ? isVoting
          ? null
          : formatSettleCountdown(remainingSeconds, '投票')
        : actionMessage,
    progress:
      isVoting && pending !== null
        ? `已投 ${view.livingSeats.length - pending.length}/${view.livingSeats.length}`
        : null,
    pendingSeats: isVoting && pending !== null ? { seats: pending, label: '未投票' } : null,
    icon: isVoting ? 'checkbox-outline' : 'time-outline',
    tracks: buildSecrethitlerRoomTracks(state, view),
    footnote: getSecrethitlerLatestResult(state),
  };
}

function getMatchSummary(state: SecrethitlerState): string {
  const phase = state.phase;
  return phase.kind === 'ended'
    ? `${phase.winner === 'liberal' ? '自由派' : '法西斯阵营'}获胜`
    : SECRETHITLER_PHASE_LABELS[phase.kind];
}

/** Match record dialog, using the same viewer-cropped details as the room. */
export function SecrethitlerHistoryDialog({
  state,
  view,
  mySeat,
  onClose,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
  readonly mySeat: number | null;
  readonly onClose: () => void;
}) {
  return (
    <RoomDialog
      title="对局记录"
      subtitle={getMatchSummary(state)}
      onClose={onClose}
      dismissOnEscape
      footer={
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <SecrethitlerMatchDetails state={state} view={view} mySeat={mySeat} />
    </RoomDialog>
  );
}
