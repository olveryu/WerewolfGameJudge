/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import './AvalonRoomScreen.css';

import type { AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import { RoomAudioResumeDialog } from '@/features/room/components/RoomAudioResumeDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
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
import { formatAvalonVoteMode } from './avalonRecordCopy';
import { createAvalonHistorySummary } from './avalonRoomAdapter';
import { AvalonBoardInfoCard } from './components/AvalonBoardInfoCard';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
import { AvalonHistorySummary } from './components/AvalonHistorySummary';
import { AvalonLadyAcknowledgeModal } from './components/AvalonLadyAcknowledgeModal';
import { AvalonLadyCheckConfirmModal } from './components/AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from './components/AvalonLadyResultModal';
import { AvalonNightConfirmModal } from './components/AvalonNightConfirmModal';
import { AvalonQuestModal } from './components/AvalonQuestModal';
import { AvalonQuestResultPanel } from './components/AvalonQuestResultPanel';
import { AvalonStrikeConfirmModal } from './components/AvalonStrikeConfirmModal';
import { AvalonTeamPickModal } from './components/AvalonTeamPickModal';
import { AvalonVoteModal } from './components/AvalonVoteModal';
import { AvalonVoteResultPanel } from './components/AvalonVoteResultPanel';
import { useAvalonRoomState } from './hooks/useAvalonRoomState';
import { useRevealWatermark } from './hooks/useRevealWatermark';
import {
  resolveLadyInstruction,
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
  const viewModel = screen.viewModel;
  const [historyVisible, setHistoryVisible] = useState(false);
  const historySummary = isLobby ? null : createAvalonHistorySummary(screen.state);
  // 顶部主面第二行：投票/任务进行中显示未提交名单（与警长 HUD 同位置）。
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
      void screen.submit('指认', { type: 'avalon.assassin.accuse', seat }, { controlledSeat });
    else
      void screen.submit(
        '提前刺杀',
        { type: 'avalon.assassin.earlyStrike', seat },
        { controlledSeat },
      );
    setStrikePickMode(false);
  };
  const strikeName =
    strikeConfirm === null || viewModel === null
      ? ''
      : (viewModel.seats.find((seatView) => seatView.seat === strikeConfirm.seat)?.displayName ??
        `座位${strikeConfirm.seat + 1}`);
  // 投票结算面板：只在结算后的 nominate/quest 展示一次（ended 由终局视图接管）。
  // 水位语义见 useRevealWatermark：进房前已结算的结果只作基线、不重弹。
  // lastVoteResult 本身没有序号字段，它恒等于 roundHistory 最后一条已结算
  // 提案，故以对局代次 + 全量已结算提案数给它定身份键。
  const voteResult = viewModel?.lastVoteResult ?? null;
  const settledProposalCount =
    viewModel?.roundHistory.reduce((total, record) => total + record.proposals.length, 0) ?? 0;
  const voteResultWatermark = useRevealWatermark(
    voteResult === null ? null : `${screen.state.gameSequence}:vote:${settledProposalCount}`,
    viewModel !== null,
  );
  const showVoteResult =
    voteResult !== null &&
    voteResultWatermark.shouldReveal &&
    viewModel !== null &&
    (viewModel.phase === 'nominate' || viewModel.phase === 'quest');
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
    if (!resolveVoteInstruction(viewModel).canVote) return;
    if (voteAutoKeyRef.current !== voteRoundKey) {
      voteAutoKeyRef.current = voteRoundKey;
      setVoteModalOpen(true);
    }
  }, [viewModel, voteRoundKey, setVoteModalOpen]);
  const questAutoKeyRef = useRef<string | null>(null);
  const questRoundKey = viewModel === null ? null : `${viewModel.questResults.length}`;
  useEffect(() => {
    if (viewModel === null || viewModel.phase !== 'quest') {
      setQuestModalOpen(false);
      questAutoKeyRef.current = null;
      return;
    }
    if (!resolveQuestInstruction(viewModel).isTeamMember) return;
    if (questAutoKeyRef.current !== questRoundKey) {
      questAutoKeyRef.current = questRoundKey;
      setQuestModalOpen(true);
    }
  }, [viewModel, questRoundKey, setQuestModalOpen]);
  // 任务结算面板：每轮任务结算后展示一次（终局由终局视图接管）。
  // 身份键 = 对局代次 + 已结算任务数：questHistory 只增不减，条数即序号；
  // 进房时第一份快照的条数只作基线（旧任务结果不重弹，见 useRevealWatermark）。
  const questHistoryCount = viewModel?.questHistory.length ?? 0;
  const questResultWatermark = useRevealWatermark(
    questHistoryCount === 0 ? null : `${screen.state.gameSequence}:quest:${questHistoryCount}`,
    viewModel !== null,
  );
  const questResultEntry =
    viewModel !== null &&
    questResultWatermark.shouldReveal &&
    (viewModel.phase === 'nominate' || viewModel.phase === 'lady' || viewModel.phase === 'assassin')
      ? viewModel.questHistory[questHistoryCount - 1]
      : undefined;
  // 座位盘选人：提名（组队者点选切换服务端草稿）/ 湖仙（持有人点选→二次确认）/ 刺杀
  // （刺客点选→二次确认）/ 提前刺杀（选人模式开启时点选→二次确认，优先于阶段点选）。
  const { setLadyAckOpen } = screen;
  const ladyAckKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewModel === null || viewModel.phase !== 'lady') {
      setLadyAckOpen(false);
      ladyAckKeyRef.current = null;
      return;
    }
    const instruction = resolveLadyInstruction(viewModel);
    if (instruction.kind !== 'targetConfirm') return;
    const key = `${viewModel.questResults.length}:${instruction.holderSeat}:${viewModel.mySeat}`;
    if (ladyAckKeyRef.current !== key) {
      ladyAckKeyRef.current = key;
      setLadyAckOpen(true);
    }
  }, [viewModel, setLadyAckOpen]);
  // 湖仙查验结果弹窗：水位住在 hook（底部「查验结果」入口直接 reveal）。
  const ladyResult = viewModel?.ladyCheckResult ?? null;
  const { ladyResultWatermark } = screen;
  const showLadyResult = ladyResult !== null && ladyResultWatermark.shouldReveal;
  const seatDisplayName = (seat: number) =>
    `${seat + 1} 号 · ${viewModel?.seats.find((entry) => entry.seat === seat)?.displayName ?? `座位${seat + 1}`}`;
  // 晚上阶段：座位盘保持可见（对齐狼人杀），确认信息走弹窗。
  // 全程座位盘保持可见；阶段交互按落点总规则分布（盘上点选 / 弹窗 / 底部
  // 动作区），座位盘下方不放任何阶段 UI——与全平台各家一致。
  const isNight = viewModel !== null && viewModel.phase === 'night';
  return (
    <RoomShell
      model={screen.shellModel}
      content={
        isLobby || viewModel === null
          ? {
              kind: 'seats',
              contextHeader: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <>
                  <RoomGameSummary
                    icon="shield-outline"
                    title={`阿瓦隆 · ${config.numberOfPlayers}人局`}
                    subtitle={`投票${formatAvalonVoteMode(config.voteMode)} · 否决上限 ${config.vetoLimit}`}
                    headerRight={
                      <RoomGuideButton onPress={screen.openRules} label="查看阿瓦隆玩法" />
                    }
                  />
                  <AvalonBoardInfoCard
                    playerCount={config.numberOfPlayers}
                    onRolePress={screen.setRolePreviewId}
                  />
                </>
              ),
            }
          : {
              kind: 'seats',
              // 对局摘要条常驻座位表上方（狼人杀入口形态）：最新结论 +
              // 「对局记录 ›」唯一入口；大厅分支不渲染（摘要恒为 null）。
              contextHeader:
                historySummary === null ? null : (
                  <AvalonHistorySummary
                    summary={historySummary}
                    pendingSeats={historyPendingSeats}
                    pendingLabel={historyPendingLabel}
                    onOpenHistory={() => setHistoryVisible(true)}
                  />
                ),
              sideInspector: null,
              // 终局结算只在本局复盘里：座位表上方不留结算区；板子信息
              // 折叠常驻（恢复 #313 前的形态，终局区不恢复）。
              beforeSeatBoard: (
                <AvalonBoardInfoCard
                  playerCount={config.numberOfPlayers}
                  collapsed
                  onRolePress={screen.setRolePreviewId}
                />
              ),
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
          {viewModel === null ? null : (
            <>
              {historyVisible && (
                <AvalonHistoryOverlay
                  viewModel={viewModel}
                  onClose={() => setHistoryVisible(false)}
                />
              )}
              {showVoteResult && voteResult !== null ? (
                <AvalonVoteResultPanel
                  result={voteResult}
                  seats={viewModel.seats}
                  onClose={voteResultWatermark.dismiss}
                />
              ) : null}
              {questResultEntry !== undefined ? (
                <AvalonQuestResultPanel
                  entry={questResultEntry}
                  onClose={questResultWatermark.dismiss}
                />
              ) : null}
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
                      },
                    )
                  }
                  onRetry={() =>
                    void screen.submit('重新推进', { type: 'avalon.phase.retrySettle' })
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
                      },
                    )
                  }
                  onRetry={() =>
                    void screen.submit('重新推进', { type: 'avalon.phase.retrySettle' })
                  }
                  onClose={() => setQuestModalOpen(false)}
                />
              ) : null}
              {isNight && screen.nightModalVisible ? (
                <AvalonNightConfirmModal
                  viewModel={viewModel}
                  isSubmitting={screen.isSubmitting}
                  onConfirm={() => {
                    screen.setNightModalVisible(false);
                    void screen.submit(
                      '确认信息',
                      { type: 'avalon.night.confirm' },
                      { controlledSeat: screen.controlledSeat },
                    );
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
                    { controlledSeat: screen.controlledSeat },
                  );
                }}
                onClose={() => setLadyCheckTarget(null)}
              />
              {screen.ladyAckOpen && viewModel.phase === 'lady' ? (
                <AvalonLadyAcknowledgeModal
                  viewModel={viewModel}
                  isSubmitting={screen.isSubmitting}
                  onAcknowledge={() => {
                    setLadyAckOpen(false);
                    void screen.submit(
                      '确认展示',
                      { type: 'avalon.lady.acknowledge' },
                      { controlledSeat: screen.controlledSeat },
                    );
                  }}
                  onClose={() => setLadyAckOpen(false)}
                />
              ) : null}
              {showLadyResult && ladyResult !== null ? (
                <AvalonLadyResultModal
                  targetName={seatDisplayName(ladyResult.targetSeat)}
                  faction={ladyResult.faction}
                  onClose={ladyResultWatermark.dismiss}
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
            onClose={() => {
              if (screen.rolePreviewId !== null) screen.setRolePreviewId(null);
              else screen.roleViewing.close();
            }}
          />
        </>
      }
    />
  );
}
