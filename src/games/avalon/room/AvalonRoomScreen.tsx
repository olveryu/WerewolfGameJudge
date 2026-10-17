/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useSeatPicking } from '@/features/room/hooks/useSeatPicking';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { AvalonAudioRuntime } from '@/games/avalon/audio/AvalonAudioPlayer';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { colors } from '@/theme';

import { createAvalonHistorySummary } from './avalonRoomAdapter';
import { AvalonBoardInfoCard } from './components/AvalonBoardInfoCard';
import { AvalonEndedSection } from './components/AvalonEndedSection';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
import { AvalonHistorySummary } from './components/AvalonHistorySummary';
import { AvalonLadyAcknowledgeModal } from './components/AvalonLadyAcknowledgeModal';
import { AvalonLadyCheckConfirmModal } from './components/AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from './components/AvalonLadyResultModal';
import { AvalonNightConfirmModal } from './components/AvalonNightConfirmModal';
import { AvalonQuestModal } from './components/AvalonQuestModal';
import { AvalonQuestResultPanel } from './components/AvalonQuestResultPanel';
import { AvalonRoleCardModal } from './components/AvalonRoleCardModal';
import {
  type AvalonStrikeConfirmation,
  AvalonStrikeConfirmModal,
} from './components/AvalonStrikeConfirmModal';
import { AvalonVoteModal } from './components/AvalonVoteModal';
import { AvalonVoteResultPanel } from './components/AvalonVoteResultPanel';
import { useAvalonRoomState } from './hooks/useAvalonRoomState';
import { useRevealWatermark } from './hooks/useRevealWatermark';
import {
  eligibleStrikeTargets,
  resolveAssassinInstruction,
  resolveLadyInstruction,
  resolveNominateInstruction,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

type AvalonRoomScreenProps = GameRoomScreenProps<'avalon'> & {
  readonly session: AvalonRoomSession;
  readonly audio: AvalonAudioRuntime;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function AvalonRoomScreen(props: AvalonRoomScreenProps) {
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(props.navigation)}
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
  // 刺杀二次确认住在 overlays 层：阶段切换不能把它吞掉。
  // 选人模式（strikePickMode）住在 hook：底部动作区的「刺杀」入口与此处共用。
  const [strikeConfirm, setStrikeConfirm] = useState<AvalonStrikeConfirmation | null>(null);
  const { setStrikePickMode } = screen;
  const closeStrike = () => {
    setStrikeConfirm(null);
    setStrikePickMode(false);
  };
  const confirmStrike = () => {
    if (strikeConfirm === null) return;
    const { seat, mode } = strikeConfirm;
    setStrikeConfirm(null);
    if (mode === 'accuse')
      void screen.submit('指认', { type: 'avalon.assassin.accuse', seat }, screen.controlledSeat);
    else
      void screen.submit(
        '提前刺杀',
        { type: 'avalon.assassin.earlyStrike', seat },
        screen.controlledSeat,
      );
    setStrikePickMode(false);
  };
  const strikeName =
    strikeConfirm === null || viewModel === null
      ? ''
      : (viewModel.seats.find((seatView) => seatView.seat === strikeConfirm.seat)?.displayName ??
        `座位${strikeConfirm.seat + 1}`);
  const boardInfoStyles = useMemo(() => createBoardInfoStyles(colors), []);
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
  // 座位盘选人：提名（队长点选切换服务端草稿）/ 湖仙（持有人点选→二次确认）/ 刺杀
  // （刺客点选→二次确认）/ 提前刺杀（选人模式开启时点选→二次确认，优先于阶段点选）。
  const [ladyCheckTarget, setLadyCheckTarget] = useState<number | null>(null);
  useEffect(() => {
    if (viewModel?.phase !== 'lady') setLadyCheckTarget(null);
    if (viewModel === null || !viewModel.canEarlyStrike) setStrikePickMode(false);
  }, [viewModel, setStrikePickMode]);
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
  // 结果弹窗的身份键按结果本身的值（同一局内同一座位只会被查验一次，值即
  // 身份）；不能把轮次编进键：轮次推进会误判旧结果为新结果。前缀对局代次
  // 只防跨局同值碰撞。水位语义见 useRevealWatermark：进房前已有的查验结果
  // 只作基线、不重弹；底部「查验结果」按钮是设计内的主动重看（reveal）。
  const ladyResult = viewModel?.ladyCheckResult ?? null;
  const ladyResultWatermark = useRevealWatermark(
    ladyResult === null
      ? null
      : `${screen.state.gameSequence}:lady:${ladyResult.targetSeat}:${ladyResult.faction}`,
    viewModel !== null,
  );
  // 底部动作区「查验结果」重开入口：经 hook 注册回本组件，强制重弹结果弹窗。
  const { setLadyResultReopenHandler } = screen;
  const ladyResultReveal = ladyResultWatermark.reveal;
  useEffect(() => {
    setLadyResultReopenHandler(ladyResultReveal);
    return () => setLadyResultReopenHandler(null);
  }, [setLadyResultReopenHandler, ladyResultReveal]);
  const showLadyResult = ladyResult !== null && ladyResultWatermark.shouldReveal;
  const seatDisplayName = (seat: number) =>
    `${seat + 1} 号 · ${viewModel?.seats.find((entry) => entry.seat === seat)?.displayName ?? `座位${seat + 1}`}`;
  const { setSeatPickHandler, strikePickMode, submitTeamDraft, setNominationDraftOverride } =
    screen;
  // 座位盘点选全部经共享点选机制（useSeatPicking）：四个消费点各一份配置，
  // 资格集仍由 avalonInteractionPolicy 产出，本组件只做装配。注册桥按现行
  // 优先级合成单个 handler：提前刺杀选人模式开启时独占点按（遮蔽其余
  // 点选，与原先的提前返回注册一致），其余按提名 → 湖仙 → 刺杀指认的
  // 顺序逐个尝试消费；都不消费时落回默认座位语义。
  const nominateInstruction =
    viewModel !== null && viewModel.phase === 'nominate'
      ? resolveNominateInstruction(viewModel, viewModel.mySeat)
      : null;
  const ladyInstruction =
    viewModel !== null && viewModel.phase === 'lady' ? resolveLadyInstruction(viewModel) : null;
  const assassinInstruction =
    viewModel !== null && viewModel.phase === 'assassin'
      ? resolveAssassinInstruction(viewModel)
      : null;
  const strikePicking = useSeatPicking({
    active: strikePickMode && viewModel !== null && viewModel.canEarlyStrike,
    mode: 'trigger',
    eligibleSeats: viewModel === null ? [] : eligibleStrikeTargets(viewModel),
    storage: { kind: 'local' },
    onPick: (seat) => {
      setStrikePickMode(false);
      setStrikeConfirm({ seat, mode: 'earlyStrike' });
    },
  });
  const nominatePicking = useSeatPicking({
    // 提名草稿住服务端：selection 是 VM 投影，点选先落机制的乐观镜像
    // 即时显示、变化经 updateDraft 整集提交；镜像经 onMirrorChange 同步
    // 进 room-state 的派生覆盖（徽标与满员判断读镜像，见
    // useAvalonRoomState 的 shellState），派发结果回传机制回滚被拒的
    // 镜像，服务端草稿始终是权威。点未入座座位落回默认语义。
    active: nominateInstruction?.isLeader === true,
    mode: 'toggle',
    eligibleSeats: viewModel === null ? [] : viewModel.seats.map((entry) => entry.seat),
    maxSize: nominateInstruction?.requiredSize,
    ineligibleTap: 'fallthrough',
    storage: {
      kind: 'room',
      selection: viewModel?.draftSeats ?? [],
      onSelectionChange: (nextSelection) => submitTeamDraft(nextSelection),
      onMirrorChange: (mirror) => setNominationDraftOverride(mirror),
    },
  });
  const ladyPicking = useSeatPicking({
    active: ladyInstruction?.kind === 'holderPick',
    mode: 'trigger',
    eligibleSeats: ladyInstruction?.kind === 'holderPick' ? ladyInstruction.eligibleSeats : [],
    storage: { kind: 'local' },
    onPick: setLadyCheckTarget,
  });
  const assassinPicking = useSeatPicking({
    active: assassinInstruction?.kind === 'assassinPick',
    mode: 'trigger',
    eligibleSeats: viewModel === null ? [] : eligibleStrikeTargets(viewModel),
    storage: { kind: 'local' },
    onPick: (seat) => setStrikeConfirm({ seat, mode: 'accuse' }),
  });
  const strikePickActive = strikePickMode && viewModel !== null && viewModel.canEarlyStrike;
  const strikeTap = strikePicking.handleSeatTap;
  const nominateTap = nominatePicking.handleSeatTap;
  const ladyTap = ladyPicking.handleSeatTap;
  const assassinTap = assassinPicking.handleSeatTap;
  useEffect(() => {
    if (viewModel === null) {
      setSeatPickHandler(null);
      return;
    }
    setSeatPickHandler((seat) =>
      strikePickActive ? strikeTap(seat) : nominateTap(seat) || ladyTap(seat) || assassinTap(seat),
    );
  }, [
    viewModel,
    setSeatPickHandler,
    strikePickActive,
    strikeTap,
    nominateTap,
    ladyTap,
    assassinTap,
  ]);
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
                    subtitle={`投票${config.voteMode === 'public' ? '公投' : '暗投'} · 否决上限 ${config.vetoLimit}`}
                    headerRight={
                      <RoomGuideButton onPress={screen.openRules} label="查看阿瓦隆玩法" />
                    }
                  />
                  <AvalonBoardInfoCard
                    playerCount={config.numberOfPlayers}
                    onRolePress={(roleId) => {
                      screen.setRolePreviewId(roleId);
                      screen.setRoleCardVisible(true);
                    }}
                    styles={boardInfoStyles}
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
                    onOpenHistory={() => setHistoryVisible(true)}
                  />
                ),
              sideInspector: null,
              beforeSeatBoard: (
                <>
                  {viewModel.phase === 'ended' ? (
                    <AvalonEndedSection viewModel={viewModel} />
                  ) : null}
                  <AvalonBoardInfoCard
                    playerCount={config.numberOfPlayers}
                    collapsed
                    onRolePress={(roleId) => {
                      screen.setRolePreviewId(roleId);
                      screen.setRoleCardVisible(true);
                    }}
                    styles={boardInfoStyles}
                  />
                </>
              ),
              afterSeatBoard: null,
            }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={
        <>
          {viewModel === null ? null : (
            <>
              <AvalonHistoryOverlay
                visible={historyVisible}
                viewModel={viewModel}
                onClose={() => setHistoryVisible(false)}
              />
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
                  isSubmitting={screen.isSubmitting}
                  onVote={(vote) =>
                    void screen.submit(
                      '投票',
                      { type: 'avalon.team.vote', vote },
                      screen.controlledSeat,
                    )
                  }
                  onClose={() => setVoteModalOpen(false)}
                />
              ) : null}
              {screen.questModalOpen && viewModel.phase === 'quest' ? (
                <AvalonQuestModal
                  viewModel={viewModel}
                  remainingSeconds={screen.phaseRemainingSeconds}
                  isSubmitting={screen.isSubmitting}
                  onPlay={(play) =>
                    void screen.submit(
                      '出牌',
                      { type: 'avalon.quest.play', play },
                      screen.controlledSeat,
                    )
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
                      screen.controlledSeat,
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
                    screen.controlledSeat,
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
                      screen.controlledSeat,
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
          <AvalonRoleCardModal
            visible={screen.roleCardVisible}
            roleId={screen.rolePreviewId ?? viewModel?.myRole ?? null}
            effectType={
              screen.rolePreviewId !== null || screen.controlledSeat !== null
                ? null
                : screen.equippedRevealEffect
            }
            shouldPlay={screen.rolePreviewId === null && screen.roleCardShouldPlay}
            allRoles={screen.roleCardAllRoles}
            remainingCards={screen.roleCardRemainingCards}
            onClose={() => {
              screen.setRoleCardVisible(false);
              screen.setRolePreviewId(null);
            }}
          />
        </>
      }
    />
  );
}
