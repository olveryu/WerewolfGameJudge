/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { AvalonAudioRuntime } from '@/games/avalon/audio/AvalonAudioPlayer';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { borderRadius, colors, componentSizes, fixed } from '@/theme';

import { AvalonBoardInfoCard } from './components/AvalonBoardInfoCard';
import { AvalonEarlyStrikeModal } from './components/AvalonEarlyStrikeModal';
import { AvalonEndedSection } from './components/AvalonEndedSection';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
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
import {
  eligibleStrikeTargets,
  resolveAssassinInstruction,
  resolveLadyInstruction,
  resolveNominateInstruction,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

const EMPTY_PICKED_SEATS: ReadonlySet<number> = new Set();

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
  // 投票结算面板：只在结算后的 nominate/quest 展示一次（ended 由终局视图接管）；
  // 新一轮提案会把 lastVoteResult 清零，届时重置 dismissed。
  const voteResult = viewModel?.lastVoteResult ?? null;
  const [voteResultDismissed, setVoteResultDismissed] = useState(false);
  useEffect(() => {
    if (voteResult === null) setVoteResultDismissed(false);
  }, [voteResult]);
  const showVoteResult =
    voteResult !== null &&
    !voteResultDismissed &&
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
  const questHistoryCount = viewModel?.questHistory.length ?? 0;
  const [questResultSeenCount, setQuestResultSeenCount] = useState(0);
  const questResultEntry =
    viewModel !== null &&
    questHistoryCount > questResultSeenCount &&
    (viewModel.phase === 'nominate' || viewModel.phase === 'lady' || viewModel.phase === 'assassin')
      ? viewModel.questHistory[questHistoryCount - 1]
      : undefined;
  // 座位盘选人：提名（队长点选切换选中集）/ 湖仙（持有人点选→二次确认）/ 刺杀（刺客点选→二次确认）。
  const [nominateSelection, setNominateSelection] = useState<ReadonlySet<number>>(new Set());
  const nominateKey =
    viewModel === null ? null : `${viewModel.questResults.length}:${viewModel.leaderSeat}`;
  const nominateKeyRef = useRef<string | null>(null);
  const phaseKind = viewModel?.phase;
  useEffect(() => {
    if (phaseKind !== 'nominate') {
      nominateKeyRef.current = null;
      setNominateSelection(new Set());
      return;
    }
    if (nominateKeyRef.current !== nominateKey) {
      nominateKeyRef.current = nominateKey;
      setNominateSelection(new Set());
    }
  }, [phaseKind, nominateKey]);
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
  // 结果弹窗去重按结果本身的值（同一局内同一座位只会被查验一次，值即身份）；
  // 结果消失（新局）时重置已看记录。不能把轮次编进键：轮次推进会误判旧结果为新结果。
  const ladyResult = viewModel?.ladyCheckResult ?? null;
  const [ladyResultSeen, setLadyResultSeen] = useState<{
    readonly targetSeat: number;
    readonly faction: 'good' | 'evil';
  } | null>(null);
  useEffect(() => {
    if (ladyResult === null) setLadyResultSeen(null);
  }, [ladyResult]);
  // 底部动作区「查验结果」重开入口：经 hook 注册回本组件，清已阅即重弹结果弹窗。
  const { setLadyResultReopenHandler } = screen;
  useEffect(() => {
    setLadyResultReopenHandler(() => setLadyResultSeen(null));
    return () => setLadyResultReopenHandler(null);
  }, [setLadyResultReopenHandler]);
  const showLadyResult =
    ladyResult !== null &&
    (ladyResultSeen === null ||
      ladyResultSeen.targetSeat !== ladyResult.targetSeat ||
      ladyResultSeen.faction !== ladyResult.faction);
  const seatDisplayName = (seat: number) =>
    `${seat + 1} 号 · ${viewModel?.seats.find((entry) => entry.seat === seat)?.displayName ?? `座位${seat + 1}`}`;
  const { setSeatPickHandler, setPickedSeats } = screen;
  useEffect(() => {
    if (viewModel === null) {
      setSeatPickHandler(null);
      return;
    }
    if (
      viewModel.phase === 'nominate' &&
      resolveNominateInstruction(viewModel, viewModel.mySeat).isLeader
    ) {
      setSeatPickHandler((seat) => {
        setNominateSelection((current) => {
          const next = new Set(current);
          if (next.has(seat)) next.delete(seat);
          else next.add(seat);
          return next;
        });
        return true;
      });
      return;
    }
    if (viewModel.phase === 'lady') {
      const instruction = resolveLadyInstruction(viewModel);
      if (instruction.kind === 'holderPick') {
        const eligible = instruction.eligibleSeats;
        setSeatPickHandler((seat) => {
          if (!eligible.includes(seat)) return false;
          setLadyCheckTarget(seat);
          return true;
        });
        return;
      }
    }
    if (
      viewModel.phase === 'assassin' &&
      resolveAssassinInstruction(viewModel).kind === 'assassinPick'
    ) {
      const targets = eligibleStrikeTargets(viewModel);
      setSeatPickHandler((seat) => {
        if (!targets.includes(seat)) return false;
        setStrikeConfirm({ seat, mode: 'accuse' });
        return true;
      });
      return;
    }
    setSeatPickHandler(null);
  }, [viewModel, setSeatPickHandler]);
  // 提名选中集同步给座位数据源（选中座位的「队员」徽标）。
  useEffect(() => {
    const isLeaderPicking =
      viewModel !== null &&
      viewModel.phase === 'nominate' &&
      resolveNominateInstruction(viewModel, viewModel.mySeat).isLeader;
    setPickedSeats(isLeaderPicking ? nominateSelection : EMPTY_PICKED_SEATS);
  }, [viewModel, nominateSelection, setPickedSeats]);
  // 晚上阶段：座位盘保持可见（对齐狼人杀），确认信息走弹窗。
  // 全程座位盘保持可见；阶段交互按落点总规则分布（盘上点选 / 弹窗 / 底部
  // 动作区 / 状态条），座位盘下方不放任何阶段 UI——与全平台各家一致。
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
              contextHeader: null,
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
      trailingExtraActions={
        isLobby || viewModel === null ? null : (
          <TouchableOpacity
            style={styles.historyButton}
            activeOpacity={fixed.activeOpacity}
            accessibilityRole="button"
            accessibilityLabel="对局记录"
            testID="avalon-history-button"
            onPress={() => setHistoryVisible(true)}
          >
            <Ionicons name="list-outline" size={componentSizes.icon.md} color={colors.text} />
          </TouchableOpacity>
        )
      }
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
                  onClose={() => setVoteResultDismissed(true)}
                />
              ) : null}
              {questResultEntry !== undefined ? (
                <AvalonQuestResultPanel
                  entry={questResultEntry}
                  onClose={() => setQuestResultSeenCount(questHistoryCount)}
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
                  onClose={() => setLadyResultSeen(ladyResult)}
                />
              ) : null}
              {screen.strikePickMode ? (
                <AvalonEarlyStrikeModal
                  viewModel={viewModel}
                  onSelectSeat={(seat) => {
                    setStrikePickMode(false);
                    setStrikeConfirm({ seat, mode: 'earlyStrike' });
                  }}
                  onClose={() => setStrikePickMode(false)}
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

const styles = StyleSheet.create({
  historyButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
  },
});
