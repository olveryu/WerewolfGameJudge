/** 秘密希特勒房间：全程保留共享座位表，公共身份配置可折叠。 */
import './SecrethitlerRoomScreen.css';

import {
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerRoleCounts,
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
import { RoomShell } from '@/features/room/components/RoomShell';
import { RoomStatusSummary } from '@/features/room/components/RoomStatusSummary';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { SecrethitlerAudioRuntime } from '@/games/secrethitler/audio/secrethitlerAudioRuntime';
import type { SecrethitlerRoomSession } from '@/games/secrethitler/model/SecrethitlerRoomSession';
import { TESTIDS } from '@/testids';
import IconDocumentTextOutline from '~icons/ion/document-text-outline';

import {
  secrethitlerVoteFailImage,
  secrethitlerVotePassImage,
} from '../assets/secrethitlerVoteImages';
import { toRevealRoleData } from '../components/SecrethitlerRoleCardAdapter';
import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import { SecrethitlerStatsPanel } from '../components/SecrethitlerStatsPanel';
import { SecrethitlerRules } from '../screens/SecrethitlerRulesScreen';
import {
  type SecrethitlerRoomScreenState,
  useSecrethitlerRoomState,
} from './hooks/useSecrethitlerRoomState';
import { SecrethitlerActionSheet } from './SecrethitlerActionSheet';
import {
  formatSecrethitlerVoteMode,
  SECRETHITLER_END_COPY,
  SECRETHITLER_PHASE_LABELS,
  SECRETHITLER_POWER_COPY,
  secrethitlerSeatLabel,
} from './secrethitlerPresentation';
import { SecrethitlerRoomTracks } from './SecrethitlerRoomTracks';

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

function shouldShowMatchSummary(state: SecrethitlerState): boolean {
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
  const [information, setInformation] = useState<'guide' | 'configuration' | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const isLobby = screen.state.phase.kind === 'lobby';
  const isPreGame = isLobby || screen.state.phase.kind === 'viewing';
  const showHistory = screen.viewModel !== null && shouldShowMatchSummary(screen.state);
  if (historyVisible && !showHistory) setHistoryVisible(false);
  return (
    <RoomShell
      model={screen.shellModel}
      selectionMode={screen.isSelecting ? 'player' : undefined}
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
      configurationEntry={isPreGame ? null : { onOpen: () => setInformation('configuration') }}
      mainEntries={
        showHistory
          ? [
              {
                label: '对局记录',
                icon: <IconDocumentTextOutline aria-hidden />,
                onOpen: () => setHistoryVisible(true),
              },
            ]
          : []
      }
      manualEntries={[
        {
          label: '玩法',
          onOpen: () => setInformation('guide'),
          testId: TESTIDS.roomGuideButton('secrethitler'),
        },
      ]}
      content={{
        kind: 'seats',
        contextHeader: null,
        informationLayout: showHistory ? 'scroll-with-seats' : 'fixed',
        summaryPresentation: 'after-message',
        bottomSummary: showHistory ? <SecrethitlerBoardHeader screen={screen} /> : null,
        beforeSeatBoard: <>{isPreGame && <SecrethitlerBoardInfo state={screen.state} />}</>,
        afterSeatBoard: null,
        sideInspector: null,
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
          {information === 'guide' && (
            <RoomDialog
              title="秘密希特勒玩法"
              onClose={() => setInformation(null)}
              dismissOnEscape
              footer={null}
            >
              <SecrethitlerRules embedded />
            </RoomDialog>
          )}
          {information === 'configuration' && (
            <RoomDialog
              title="本局配置"
              onClose={() => setInformation(null)}
              dismissOnEscape
              footer={null}
            >
              <SecrethitlerBoardInfo state={screen.state} embedded />
            </RoomDialog>
          )}
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
          <p>
            政府{voteResult.yesCount > voteResult.noCount ? '通过' : '未通过'}：赞成{' '}
            {voteResult.yesCount}，反对 {voteResult.noCount}
          </p>
          {view.voteMode === 'public' &&
            voteResult.votes?.map(({ seat: voter, vote }) => (
              <p key={voter}>
                {secrethitlerSeatLabel(view, voter)}：{vote === 'ja' ? '赞成' : '反对'}
              </p>
            ))}
        </>
      )}
      {previous.kind === 'legislativeChancellor' && phase.policy !== null && (
        <p>施行{policyLabel(phase.policy)}政策</p>
      )}
      {previous.kind === 'vetoResponse' && <p>总统{phase.vetoApproved ? '同意' : '拒绝'}否决</p>}
      {phase.chaosPolicy !== null && <p>混乱：自动施行{policyLabel(phase.chaosPolicy)}政策</p>}
      {remainingSeconds === null && <p>等待进入下一阶段…</p>}
      {remainingSeconds !== null && remainingSeconds > 0 && <p>{`${remainingSeconds} 秒后继续`}</p>}
      <StageSettleRescue
        remainingSeconds={remainingSeconds}
        isOverdue={isOverdue}
        isHost={screen.isHost}
        isRetrying={screen.isSubmitting}
        onRetry={() => void screen.submit('重新推进', { type: 'secrethitler.phase.retrySettle' })}
        waitingLabel="等待进入下一阶段…"
      />
    </CenterDialog>
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
      { controlledSeat: screen.controlledSeat },
    );
  return (
    <CenterDialog open title="私密调查结果" requireConfirmation onClose={acknowledge}>
      <p>
        {secrethitlerSeatLabel(view, result.targetSeat)}：
        {result.faction === 'liberal' ? '自由派' : '法西斯阵营'}
      </p>
      <Button disabled={screen.isSubmitting} onClick={acknowledge}>
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
          color: 'var(--color-villager)',
          items: [{ roleId: 'liberal', displayName: '自由派', count: counts.liberal }],
        },
        {
          title: '法西斯阵营',
          color: 'var(--color-wolf)',
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

/** Compact public status; match details are opened from the room hand. */
export function SecrethitlerBoardHeader({
  screen,
}: {
  readonly screen: Pick<SecrethitlerRoomScreenState, 'state' | 'viewModel' | 'mySeat'>;
}) {
  const view = screen.viewModel;
  if (view === null || !shouldShowMatchSummary(screen.state)) return null;
  return (
    <>
      <RoomStatusSummary summary={getMatchSummary(screen.state)} action={null} />
      <SecrethitlerRoomTracks state={screen.state} view={view} />
    </>
  );
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

export function SecrethitlerMatchDetails({
  state,
  view,
  mySeat,
}: {
  readonly state: SecrethitlerState;
  readonly view: SecrethitlerViewModel;
  readonly mySeat: number | null;
}) {
  const phase = state.phase;
  const lastGovernment = view.history.governments
    .filter((record) => record.outcome !== 'pending')
    .at(-1);
  const lastGovernmentVoteCounts = lastGovernment?.voteCounts;
  if (lastGovernment !== undefined && lastGovernmentVoteCounts === null) {
    throw new Error('[FAIL-FAST] Settled Secret Hitler government has no vote counts');
  }
  return (
    <div className="secrethitler-match-details">
      {phase.kind === 'ended' && (
        <>
          <p>{SECRETHITLER_END_COPY[phase.reason]}</p>
          <p>
            {' '}
            至少 5 名真人开局并正常结束时，注册玩家获得 33 经验和 3 次普通抽奖；游客和机器人不领取。
          </p>
          <ul className="secrethitler-result-list">
            {view.seats.map((player) => {
              if (player.identity === null)
                throw new Error('Ended Secret Hitler seat has no identity');
              const won = (player.identity === 'liberal' ? 'liberal' : 'fascist') === phase.winner;
              return (
                <li key={player.seat}>
                  <span>
                    {secrethitlerSeatLabel(view, player.seat)}
                    {player.seat === mySeat ? '（你）' : ''}
                    {player.isBot ? '（机器人）' : ''}
                  </span>
                  <strong>
                    {getSecrethitlerIdentityName(player.identity)} · {won ? '获胜' : '落败'}
                  </strong>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="secrethitler-tracks">
        <div>
          <span>自由派政策</span>
          <strong>{view.liberalPolicies} / 5</strong>
          <progress aria-label="自由派政策" max={5} value={view.liberalPolicies} />
        </div>
        <div>
          <span>法西斯政策</span>
          <strong>{view.fascistPolicies} / 6</strong>
          <progress aria-label="法西斯政策" max={6} value={view.fascistPolicies} />
        </div>
      </div>
      <p>
        选举失败 {view.electionTracker} / 3 · 存活 {view.livingSeats.length} 人
        {view.vetoUnlocked ? ' · 否决权已解锁' : ''}
      </p>
      {view.presidentSeat !== null && (
        <p>
          总统：{secrethitlerSeatLabel(view, view.presidentSeat)}
          {view.chancellorSeat === null
            ? ''
            : ` · 总理：${secrethitlerSeatLabel(view, view.chancellorSeat)}`}
        </p>
      )}
      {phase.kind === 'executive' && <p>本次权力：{SECRETHITLER_POWER_COPY[phase.power]}</p>}
      {lastGovernment !== undefined &&
        lastGovernmentVoteCounts !== null &&
        lastGovernmentVoteCounts !== undefined && (
          <>
            <img
              src={
                lastGovernment.outcome === 'passed'
                  ? secrethitlerVotePassImage
                  : secrethitlerVoteFailImage
              }
              alt=""
              decoding="async"
              className="secrethitler-settled-vote-banner"
              data-testid={TESTIDS.secrethitlerSettledVoteBanner}
            />
            <p role="status">
              上次政府{lastGovernment.outcome === 'passed' ? '通过' : '未通过'} · 赞成{' '}
              {lastGovernmentVoteCounts.ja} 票
            </p>
          </>
        )}
      <SecrethitlerPublicHistory view={view} />
    </div>
  );
}

function SecrethitlerPublicHistory({ view }: { readonly view: SecrethitlerViewModel }) {
  return (
    <section className="secrethitler-history">
      <h2>公开对局记录</h2>
      {view.history.governments.length === 0 ? (
        <p>暂无已记录的政府投票</p>
      ) : (
        <>
          <h3>政府投票</h3>
          <ol>
            {view.history.governments.map((record, index) => (
              <li key={index}>
                <p>
                  总统 {record.presidentSeat + 1} 号 / 总理 {record.chancellorSeat + 1} 号 ·{' '}
                  {record.outcome === 'pending'
                    ? '投票中'
                    : record.outcome === 'passed'
                      ? '通过'
                      : '未通过'}
                </p>
                {record.votes !== null && (
                  <p>
                    {record.votes
                      .map(({ seat, vote }) => `${seat + 1}号${vote === 'ja' ? '赞成' : '反对'}`)
                      .join('、')}
                  </p>
                )}
                {record.votes === null && record.voteCounts !== null && (
                  <p>
                    暗投：赞成 {record.voteCounts.ja} 票，反对 {record.voteCounts.nein} 票
                  </p>
                )}
              </li>
            ))}
          </ol>
          <h3>政策记录</h3>
          <ol>
            {view.history.policies.map((record, index) => (
              <li key={index}>
                {record.policy === 'liberal' ? '自由派' : '法西斯'}政策 ·{' '}
                {record.source === 'chaos' ? '三次失败自动施行' : '政府施行'}
              </li>
            ))}
          </ol>
          <h3>总统行动</h3>
          <ol>
            {view.history.actions.map((record, index) => (
              <li key={index}>
                {record.presidentSeat + 1} 号{SECRETHITLER_POWER_COPY[record.action]}
                {record.targetSeat === null ? '' : `：${record.targetSeat + 1} 号`}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
