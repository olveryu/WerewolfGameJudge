/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import './AvalonRoomScreen.css';

import {
  type AvalonState,
  getAvalonOccupiedSeatCount,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import {
  type RoomInformation,
  RoomInformationDialog,
} from '@/features/room/components/RoomInformationDialog';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { AvalonAudioRuntime } from '@/games/avalon/audio/AvalonAudioPlayer';
import { AvalonStatsPanel } from '@/games/avalon/components/AvalonStatsPanel';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { TESTIDS } from '@/testids';
import IconMusicalNotes from '~icons/ion/musical-notes';
import IconPause from '~icons/ion/pause';

import { toRevealRoleData } from '../components/AvalonRoleCardAdapter';
import { AvalonGuide } from '../screens/AvalonGuideScreen';
import { formatAvalonVoteMode } from './avalonRecordCopy';
import {
  AVALON_EARLY_STRIKE_ACTION_KEY,
  createAvalonCurrentStatus,
  createAvalonHistorySummary,
} from './avalonRoomAdapter';
import { AvalonBoardInfoContent } from './components/AvalonBoardInfoContent';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
import { AvalonHistorySummary } from './components/AvalonHistorySummary';
import { AvalonLadyCheckConfirmModal } from './components/AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from './components/AvalonLadyResultModal';
import { AvalonNightConfirmModal } from './components/AvalonNightConfirmModal';
import { AvalonQuestModal } from './components/AvalonQuestModal';
import { AvalonQuestResultPanel } from './components/AvalonQuestResultPanel';
import { AvalonRoomTracks } from './components/AvalonRoomTracks';
import { AvalonStrikeConfirmModal } from './components/AvalonStrikeConfirmModal';
import { AvalonTeamPickModal } from './components/AvalonTeamPickModal';
import { AvalonVoteModal } from './components/AvalonVoteModal';
import { AvalonVoteResultPanel } from './components/AvalonVoteResultPanel';
import { useAvalonRoomState } from './hooks/useAvalonRoomState';
import {
  formatAvalonQuestLabel,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

type AvalonRoomScreenProps = GameRoomScreenProps<'avalon'> & {
  readonly session: AvalonRoomSession;
  readonly review: RoomReviewContribution<AvalonState>;
  readonly audio: AvalonAudioRuntime;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function AvalonRoomScreen(props: AvalonRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <AvalonRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function AvalonRoomContent(
  props: AvalonRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useAvalonRoomState(props);
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  const isPreGame = isLobby || screen.state.phase.kind === 'viewing';
  const viewModel = screen.viewModel;
  const [historyVisible, setHistoryVisible] = useState(false);
  const [information, setInformation] = useState<RoomInformation>(null);
  const isReading = information !== null || historyVisible || screen.rolePreviewId !== null;
  const historySummary = createAvalonHistorySummary(screen.state);
  const currentStatus = createAvalonCurrentStatus(screen.state);
  const phase = screen.state.phase;
  const statusContext =
    phase.kind === 'nominate' || phase.kind === 'vote'
      ? `${formatAvalonQuestLabel(phase.round)} · 第${Math.min((screen.state.roundHistory.find((record) => record.round === phase.round)?.proposals.length ?? 0) + 1, config.vetoLimit)}次提案`
      : phase.kind === 'voteResult' || phase.kind === 'quest' || phase.kind === 'questResult'
        ? formatAvalonQuestLabel(phase.round)
        : phase.kind === 'lady'
          ? formatAvalonQuestLabel(phase.afterRound)
          : null;
  if (historyVisible && (historySummary === null || viewModel === null)) {
    setHistoryVisible(false);
  }
  // 底部摘要：投票/任务进行中显示未提交名单（与警长摘要同形）。
  const historyPendingSeats =
    viewModel === null
      ? null
      : viewModel.phase === 'vote'
        ? viewModel.pendingVoteSeats
        : viewModel.phase === 'quest'
          ? viewModel.pendingPlaySeats
          : null;
  const historyPendingLabel = viewModel?.phase === 'quest' ? '未出牌' : '未投票';
  // 刺杀二次确认住在 overlays 层：阶段切换不能把它吞掉。
  // 选人模式（strikePickMode）住在 hook：底部动作区的「刺杀」入口与此处共用。
  const { strikeConfirm, setStrikeConfirm, ladyCheckTarget, setLadyCheckTarget } =
    screen.seatPicking;
  const { setStrikePickMode } = screen;
  const closeStrike = () => {
    setStrikeConfirm(null);
    setStrikePickMode(false);
  };
  const confirmStrike = () => {
    if (strikeConfirm === null) return;
    const { seat, mode } = strikeConfirm;
    setStrikeConfirm(null);
    const controlledSeat = screen.controlledSeat;
    if (mode === 'accuse')
      void screen.submit(
        '指认',
        { type: 'avalon.assassin.accuse', seat },
        { controlledSeat, actionKey: null },
      );
    else
      void screen.submit(
        '提前刺杀',
        { type: 'avalon.assassin.earlyStrike', seat },
        { controlledSeat, actionKey: null },
      );
    setStrikePickMode(false);
  };
  const strikeName =
    strikeConfirm === null || viewModel === null
      ? ''
      : (viewModel.seats.find((seatView) => seatView.seat === strikeConfirm.seat)?.displayName ??
        `座位${strikeConfirm.seat + 1}`);
  // 结果确认是权威阶段，重连也必须显示，直到全员确认。
  const voteResult = viewModel?.lastVoteResult ?? null;
  // 投票/出牌弹窗：每轮自动弹一次（按轮次键去重），关后不重弹，底部按钮可重开。
  // 开关状态住在 hook（screen.setVoteModalOpen 等），与底部动作区共用。
  const { setVoteModalOpen, setQuestModalOpen } = screen;
  const voteAutoKeyRef = useRef<string | null>(null);
  const voteRoundKey =
    viewModel === null
      ? null
      : `${viewModel.questResults.length}:${screen.state.rejectStreak}:${screen.state.leaderSeat}`;
  useEffect(() => {
    if (viewModel === null || viewModel.phase !== 'vote') {
      setVoteModalOpen(false);
      voteAutoKeyRef.current = null;
      return;
    }
    if (isReading || !resolveVoteInstruction(viewModel).canVote) return;
    if (voteAutoKeyRef.current !== voteRoundKey) {
      voteAutoKeyRef.current = voteRoundKey;
      setVoteModalOpen(true);
    }
  }, [viewModel, voteRoundKey, setVoteModalOpen, isReading]);
  const questAutoKeyRef = useRef<string | null>(null);
  const questRoundKey =
    viewModel === null ? null : `${viewModel.questResults.length}:${screen.effectiveSeat}`;
  useEffect(() => {
    if (viewModel === null || viewModel.phase !== 'quest') {
      setQuestModalOpen(false);
      questAutoKeyRef.current = null;
      return;
    }
    if (!resolveQuestInstruction(viewModel).isTeamMember) {
      setQuestModalOpen(false);
      return;
    }
    if (isReading) return;
    if (questAutoKeyRef.current !== questRoundKey) {
      questAutoKeyRef.current = questRoundKey;
      setQuestModalOpen(true);
    }
  }, [viewModel, questRoundKey, setQuestModalOpen, isReading]);
  const questResultEntry =
    viewModel?.phase === 'questResult' ? viewModel.questHistory.at(-1) : undefined;
  // 座位盘选人：提名（组队者点选切换服务端草稿）/ 湖仙（持有人点选→二次确认）/ 刺杀
  // （刺客点选→二次确认）/ 提前刺杀（选人模式开启时点选→二次确认，优先于阶段点选）。
  // 湖仙结果只在持有人尚未确认时显示，重连后仍能恢复。
  const ladyResult = viewModel?.ladyCheckResult ?? null;
  const ladyResultNeedsConfirmation =
    viewModel?.phase === 'lady' && viewModel.lady?.needsAcknowledge === true;
  const showLadyResult = ladyResult !== null && ladyResultNeedsConfirmation && !isReading;
  const seatDisplayName = (seat: number) =>
    `${seat + 1} 号 · ${viewModel?.seats.find((entry) => entry.seat === seat)?.displayName ?? `座位${seat + 1}`}`;
  // 晚上阶段：座位盘保持可见（对齐狼人杀），确认信息走弹窗。
  // 全程座位盘保持可见；阶段交互按落点总规则分布（盘上点选 / 弹窗 / 底部
  // 动作区），座位盘下方不放任何阶段 UI——与全平台各家一致。
  const isNight = viewModel !== null && viewModel.phase === 'night';
  const settings = [
    { label: '投票方式', value: formatAvalonVoteMode(config.voteMode) },
    { label: '最多组队', value: `${config.vetoLimit} 次` },
  ];
  const board = (
    <AvalonBoardInfoContent
      playerCount={config.numberOfPlayers}
      onRolePress={screen.setRolePreviewId}
    />
  );
  const gameConfiguration = (
    <RoomGameSummary
      title="阿瓦隆"
      playerCount={config.numberOfPlayers}
      settings={settings}
      guide={null}
    >
      {board}
    </RoomGameSummary>
  );
  return (
    <RoomShell
      model={screen.shellModel}
      phaseLabel={
        isLobby
          ? '待开局'
          : isPreGame
            ? '已发牌'
            : screen.state.phase.kind === 'night'
              ? '夜晚'
              : screen.state.phase.kind === 'ended'
                ? '本局结束'
                : (statusContext ?? '游戏进行中')
      }
      lobbyAction={
        isLobby
          ? { label: '分配角色', occupiedSeats: getAvalonOccupiedSeatCount(screen.state) }
          : null
      }
      selectionMode={
        screen.strikePickMode
          ? { kind: 'player', escapeActionKey: AVALON_EARLY_STRIKE_ACTION_KEY }
          : undefined
      }
      directory={{
        main:
          historySummary !== null && viewModel !== null
            ? [
                {
                  key: 'history',
                  label: '对局记录',
                  category: 'resource',
                  icon: 'document-text-outline',
                  testID: TESTIDS.avalonHistoryButton,
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
            testID: TESTIDS.roomGuideButton('avalon'),
            opensDialog: true,
            state: { kind: 'ready', onPress: () => setInformation('guide') },
          },
        ],
        openConfiguration:
          !isPreGame && viewModel !== null ? () => setInformation('configuration') : null,
      }}
      content={
        isLobby || viewModel === null
          ? {
              kind: 'seats',
              contextHeader: null,
              bottomSummary: null,
              afterSeatBoard: null,
              beforeSeatBoard: gameConfiguration,
            }
          : {
              kind: 'seats',
              contextHeader: null,
              informationLayout: historySummary !== null ? 'scroll-with-seats' : 'fixed',
              summaryPresentation: 'after-message',
              // 白天及终局显示摘要与记录入口；查看身份和夜晚由阶段派生隐藏。
              bottomSummary:
                historySummary === null || currentStatus === null ? null : (
                  <AvalonHistorySummary
                    status={currentStatus}
                    tracks={<AvalonRoomTracks view={viewModel} />}
                    latestResult={
                      screen.state.phase.kind !== 'ended' &&
                      (screen.state.roundHistory.some((round) => round.proposals.length > 0) ||
                        screen.state.questHistory.length > 0)
                        ? historySummary
                        : null
                    }
                    pendingSeats={historyPendingSeats}
                    pendingLabel={historyPendingLabel}
                  />
                ),
              beforeSeatBoard: <>{isPreGame && gameConfiguration}</>,
              afterSeatBoard: null,
            }
      }
      leadingExtraActions={
        screen.isHost && isNight ? (
          <IconButton
            className="avalon-bgm-toggle"
            data-playing={screen.bgm.isBgmPlaying}
            label={screen.bgm.isBgmPlaying ? '暂停音乐' : '播放音乐'}
            icon={
              screen.bgm.isBgmPlaying ? <IconPause aria-hidden /> : <IconMusicalNotes aria-hidden />
            }
            onClick={screen.bgm.isBgmPlaying ? screen.bgm.stopBgm : screen.bgm.playBgm}
            data-testid={TESTIDS.bgmToggleButton}
          />
        ) : null
      }
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <AvalonStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          <RoomInformationDialog
            information={information}
            guideTitle="阿瓦隆玩法"
            guide={<AvalonGuide parentPath={null} />}
            configuration={
              <>
                <p>{`阿瓦隆（${config.numberOfPlayers}人）`}</p>
                {board}
                <RoomGameSettings settings={settings} />
              </>
            }
            onClose={() => setInformation(null)}
          />
          {viewModel === null ? null : (
            <>
              {historyVisible && (
                <AvalonHistoryOverlay
                  viewModel={viewModel}
                  onClose={() => setHistoryVisible(false)}
                />
              )}
              <AvalonStrikeConfirmModal
                confirmation={strikeConfirm}
                seatName={strikeName}
                onConfirm={confirmStrike}
                onClose={closeStrike}
              />
              {screen.voteModalOpen && viewModel.phase === 'vote' ? (
                <AvalonVoteModal
                  viewModel={viewModel}
                  remainingSeconds={screen.phaseRemainingSeconds}
                  isOverdue={screen.isOverdue}
                  isHost={screen.isHost}
                  isSubmitting={screen.isSubmitting}
                  onVote={(vote) =>
                    void screen.submit(
                      '投票',
                      { type: 'avalon.team.vote', vote },
                      {
                        controlledSeat: screen.controlledSeat,
                        actionKey: null,
                      },
                    )
                  }
                  onRetry={() =>
                    void screen.submit(
                      '重新推进',
                      { type: 'avalon.phase.retrySettle' },
                      { actionKey: null },
                    )
                  }
                  onClose={() => setVoteModalOpen(false)}
                />
              ) : null}
              {screen.teamPickModal !== null && viewModel.phase === 'nominate' ? (
                <AvalonTeamPickModal
                  viewModel={viewModel}
                  kind={screen.teamPickModal}
                  isSubmitting={screen.isSubmitting}
                  onConfirm={(seats) => void screen.confirmTeamPick(seats)}
                  onClose={() => screen.setTeamPickModal(null)}
                />
              ) : null}
              {screen.questModalOpen && viewModel.phase === 'quest' ? (
                <AvalonQuestModal
                  viewModel={viewModel}
                  remainingSeconds={screen.phaseRemainingSeconds}
                  isOverdue={screen.isOverdue}
                  isHost={screen.isHost}
                  isSubmitting={screen.isSubmitting}
                  onPlay={(play) =>
                    void screen.submit(
                      '出牌',
                      { type: 'avalon.quest.play', play },
                      {
                        controlledSeat: screen.controlledSeat,
                        actionKey: null,
                      },
                    )
                  }
                  onRetry={() =>
                    void screen.submit(
                      '重新推进',
                      { type: 'avalon.phase.retrySettle' },
                      { actionKey: null },
                    )
                  }
                  onClose={() => setQuestModalOpen(false)}
                />
              ) : null}
              {isNight && screen.nightModalVisible ? (
                <AvalonNightConfirmModal
                  key={`${screen.state.gameSequence}:${viewModel.nightStep}:${screen.effectiveSeat}`}
                  viewModel={viewModel}
                  isSubmitting={screen.isSubmitting}
                  onConfirm={() => {
                    void screen
                      .submit(
                        '确认信息',
                        { type: 'avalon.night.confirm' },
                        { controlledSeat: screen.controlledSeat, actionKey: null },
                      )
                      .then((success) => {
                        if (success) screen.setNightModalVisible(false);
                      });
                  }}
                  onClose={() => screen.setNightModalVisible(false)}
                />
              ) : null}
              <AvalonLadyCheckConfirmModal
                targetName={ladyCheckTarget === null ? null : seatDisplayName(ladyCheckTarget)}
                onConfirm={() => {
                  if (ladyCheckTarget === null) return;
                  const seat = ladyCheckTarget;
                  setLadyCheckTarget(null);
                  void screen.submit(
                    '查验',
                    { type: 'avalon.lady.check', seat },
                    { controlledSeat: screen.controlledSeat, actionKey: null },
                  );
                }}
                onClose={() => setLadyCheckTarget(null)}
              />
              {showLadyResult && ladyResult !== null ? (
                <AvalonLadyResultModal
                  targetName={seatDisplayName(ladyResult.targetSeat)}
                  faction={ladyResult.faction}
                  requireConfirmation
                  isSubmitting={screen.isSubmitting}
                  onClose={() =>
                    void screen.submit(
                      '确认查验结果',
                      { type: 'avalon.lady.acknowledge' },
                      { controlledSeat: screen.controlledSeat, actionKey: null },
                    )
                  }
                />
              ) : null}
            </>
          )}
          {screen.reviewOverlay}
          <RoomAudioResumeDialog
            visible={screen.audioResume.isDue}
            onContinue={screen.audioResume.continueGame}
          />
          {/* 身份卡（查看记录确认后弹）与板子信息的角色预览共用一个弹窗；预览无揭示动效。 */}
          <RevealRoleCardModal
            visible={screen.rolePreviewId !== null || screen.roleViewing.isOpen}
            roleKey={screen.rolePreviewId ?? viewModel?.myRole ?? null}
            toRoleData={toRevealRoleData}
            effectType={
              screen.rolePreviewId !== null || screen.controlledSeat !== null
                ? null
                : screen.equippedRevealEffect
            }
            shouldPlay={screen.rolePreviewId === null && screen.roleViewing.shouldPlayAnimation}
            allRoles={screen.roleCardAllRoles}
            remainingCards={screen.roleViewing.remainingCards}
            confirmDisabled={
              screen.rolePreviewId === null && screen.roleViewing.isConfirmationDisabled
            }
            requireConfirmation={screen.rolePreviewId === null}
            onClose={() => {
              if (screen.rolePreviewId !== null) screen.setRolePreviewId(null);
              else screen.roleViewing.close();
            }}
          />
          {viewModel !== null &&
          phase.kind === 'voteResult' &&
          voteResult !== null &&
          !screen.voteModalOpen ? (
            <AvalonVoteResultPanel
              result={voteResult}
              seats={viewModel.seats}
              remainingSeconds={screen.phaseRemainingSeconds}
              isOverdue={screen.isOverdue}
              isHost={screen.isHost}
              isSubmitting={screen.isSubmitting}
              onRetry={() =>
                void screen.submit(
                  '重新推进',
                  { type: 'avalon.phase.retrySettle' },
                  { actionKey: null },
                )
              }
            />
          ) : null}
          {viewModel !== null &&
          phase.kind === 'questResult' &&
          questResultEntry !== undefined &&
          !screen.questModalOpen ? (
            <AvalonQuestResultPanel
              entry={questResultEntry}
              remainingSeconds={screen.phaseRemainingSeconds}
              isOverdue={screen.isOverdue}
              isHost={screen.isHost}
              isSubmitting={screen.isSubmitting}
              onRetry={() =>
                void screen.submit(
                  '重新推进',
                  { type: 'avalon.phase.retrySettle' },
                  { actionKey: null },
                )
              }
            />
          ) : null}
        </>
      }
    />
  );
}
