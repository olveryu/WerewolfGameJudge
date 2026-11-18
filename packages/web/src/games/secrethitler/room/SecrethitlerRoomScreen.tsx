/** 秘密希特勒房间：全程保留共享座位表，公共身份配置可折叠。 */
import './SecrethitlerRoomScreen.css';

import {
  getSecrethitlerRoleCounts,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { BoardInfoCard } from '@/features/room/components/BoardInfoCard';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomRecordSummary } from '@/features/room/components/RoomRecordSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { SecrethitlerAudioRuntime } from '@/games/secrethitler/audio/secrethitlerAudioRuntime';
import type { SecrethitlerRoomSession } from '@/games/secrethitler/model/SecrethitlerRoomSession';

import { toRevealRoleData } from '../components/SecrethitlerRoleCardAdapter';
import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import { SecrethitlerStatsPanel } from '../components/SecrethitlerStatsPanel';
import {
  type SecrethitlerRoomScreenState,
  useSecrethitlerRoomState,
} from './hooks/useSecrethitlerRoomState';
import { SecrethitlerActionSheet } from './SecrethitlerActionSheet';
import {
  SECRETHITLER_END_COPY,
  SECRETHITLER_PHASE_LABELS,
  SECRETHITLER_POWER_COPY,
  secrethitlerSeatLabel,
} from './secrethitlerPresentation';

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

function SecrethitlerRoomContent(
  props: SecrethitlerRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useSecrethitlerRoomState(props);
  const isLobby = screen.state.phase.kind === 'lobby';
  return (
    <RoomShell
      model={screen.shellModel}
      content={{
        kind: 'seats',
        contextHeader: isLobby ? null : <SecrethitlerBoardHeader screen={screen} />,
        beforeSeatBoard: (
          <SecrethitlerBoardInfo state={screen.state} openRules={screen.openRules} />
        ),
        afterSeatBoard: null,
        sideInspector: null,
      }}
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <SecrethitlerStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          <RevealRoleCardModal
            visible={screen.roleViewing.isOpen}
            roleKey={screen.viewModel?.myIdentity ?? null}
            toRoleData={toRevealRoleData}
            allRoles={screen.roleCardAllRoles}
            shouldPlay={screen.roleViewing.shouldPlayAnimation}
            remainingCards={screen.roleViewing.remainingCards}
            onClose={screen.roleViewing.close}
          />
          {screen.actionModalOpen && <SecrethitlerActionSheet screen={screen} />}
          {screen.reviewOverlay}
        </>
      }
    />
  );
}

/** Public role composition uses the same collapsible board card as Werewolf and Avalon. */
export function SecrethitlerBoardInfo({
  state,
  openRules,
}: {
  readonly state: SecrethitlerState;
  readonly openRules: () => void;
}) {
  const [previewRole, setPreviewRole] = useState<string | null>(null);
  const counts = getSecrethitlerRoleCounts(state.config.numberOfPlayers);
  return (
    <>
      <RoomGameSummary
        icon="game-controller-outline"
        title={`秘密希特勒 · ${state.config.numberOfPlayers}人局`}
        subtitle={state.phase.kind === 'lobby' ? '隐藏阵营玩家选举政府并秘密施行政策' : undefined}
        headerRight={<RoomGuideButton onPress={openRules} label="查看秘密希特勒玩法" />}
      >
        <BoardInfoCard
          playerCount={state.config.numberOfPlayers}
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
          collapsed={state.phase.kind !== 'lobby'}
          onRolePress={setPreviewRole}
          onStrategyPress={null}
          onNotepadPress={null}
          footer={null}
        />
      </RoomGameSummary>
      {previewRole !== null && (
        <RoleCardDialog role={toRevealRoleData(previewRole)} onClose={() => setPreviewRole(null)} />
      )}
    </>
  );
}

/** Compact public status; the shared dialog owns the scrollable match details. */
export function SecrethitlerBoardHeader({
  screen,
}: {
  readonly screen: Pick<SecrethitlerRoomScreenState, 'state' | 'viewModel' | 'mySeat'>;
}) {
  const [historyVisible, setHistoryVisible] = useState(false);
  const phase = screen.state.phase;
  const view = screen.viewModel;
  if (view === null) return null;
  const summary =
    phase.kind === 'ended'
      ? `${phase.winner === 'liberal' ? '自由派' : '法西斯阵营'}获胜`
      : SECRETHITLER_PHASE_LABELS[phase.kind];
  return (
    <>
      <RoomRecordSummary
        summary={summary}
        detail={`自由派 ${view.liberalPolicies}/5 · 法西斯 ${view.fascistPolicies}/6 · 选举失败 ${view.electionTracker}/3`}
        onOpen={() => setHistoryVisible(true)}
      />
      {historyVisible && (
        <RoomDialog
          title="对局记录"
          subtitle={summary}
          onClose={() => setHistoryVisible(false)}
          footer={
            <Button variant="secondary" onClick={() => setHistoryVisible(false)}>
              关闭
            </Button>
          }
        >
          <SecrethitlerMatchDetails state={screen.state} view={view} mySeat={screen.mySeat} />
        </RoomDialog>
      )}
    </>
  );
}

function SecrethitlerMatchDetails({
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
      {lastGovernment !== undefined && (
        <p role="status">
          上次政府{lastGovernment.outcome === 'passed' ? '通过' : '未通过'} · 赞成{' '}
          {lastGovernment.votes?.filter(({ vote }) => vote === 'ja').length} 票
        </p>
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
