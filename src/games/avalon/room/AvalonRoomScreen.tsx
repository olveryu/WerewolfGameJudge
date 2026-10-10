/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { createBoardInfoStyles } from '@/features/room/components/boardInfo.styles';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { AvalonAudioRuntime } from '@/games/avalon/audio/AvalonAudioPlayer';
import type { AvalonRoomSession } from '@/games/avalon/model/AvalonRoomSession';
import { borderRadius, colors, componentSizes, fixed, spacing, textStyles } from '@/theme';

import { AvalonBoardInfoCard } from './components/AvalonBoardInfoCard';
import { AvalonEarlyStrikeModal } from './components/AvalonEarlyStrikeModal';
import { AvalonEndedView } from './components/AvalonEndedView';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
import { AvalonLadyAcknowledgeModal } from './components/AvalonLadyAcknowledgeModal';
import { AvalonLadyCheckConfirmModal } from './components/AvalonLadyCheckConfirmModal';
import { AvalonLadyResultModal } from './components/AvalonLadyResultModal';
import { AvalonLadyView } from './components/AvalonLadyView';
import { AvalonNightConfirmModal } from './components/AvalonNightConfirmModal';
import { AvalonNominateView } from './components/AvalonNominateView';
import { AvalonQuestModal } from './components/AvalonQuestModal';
import { AvalonQuestResultPanel } from './components/AvalonQuestResultPanel';
import { AvalonRoleCardModal } from './components/AvalonRoleCardModal';
import { AvalonInfoCard, AvalonStageFrame } from './components/AvalonStageFrame';
import {
  type AvalonStrikeConfirmation,
  AvalonStrikeConfirmModal,
} from './components/AvalonStrikeConfirmModal';
import { AvalonVoteModal } from './components/AvalonVoteModal';
import { AvalonVoteResultPanel } from './components/AvalonVoteResultPanel';
import { type AvalonRoomScreenState, useAvalonRoomState } from './hooks/useAvalonRoomState';
import {
  eligibleStrikeTargets,
  formatAvalonRoundLabel,
  resolveAssassinInstruction,
  resolveAvalonStageKind,
  resolveLadyInstruction,
  resolveNominateInstruction,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

type AvalonScreenState = AvalonRoomScreenState;

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
  // 刺杀二次确认住在 overlays 层：阶段组件重挂载（阶段切换）不能把它吞掉。
  const [strikeConfirm, setStrikeConfirm] = useState<AvalonStrikeConfirmation | null>(null);
  const [strikePickMode, setStrikePickMode] = useState(false);
  const closeStrike = () => {
    setStrikeConfirm(null);
    setStrikePickMode(false);
  };
  const confirmStrike = () => {
    if (strikeConfirm === null) return;
    const { seat, mode } = strikeConfirm;
    setStrikeConfirm(null);
    if (mode === 'accuse') void screen.submit('指认', { type: 'avalon.assassin.accuse', seat });
    else void screen.submit('提前刺杀', { type: 'avalon.assassin.earlyStrike', seat });
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
  // 投票/出牌弹窗：每轮自动弹一次（按轮次键去重），关后不重弹，阶段条可重开。
  const [voteModalOpen, setVoteModalOpen] = useState(false);
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
  }, [viewModel, voteRoundKey]);
  const [questModalOpen, setQuestModalOpen] = useState(false);
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
  }, [viewModel, questRoundKey]);
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
  }, [viewModel]);
  const [ladyAckOpen, setLadyAckOpen] = useState(false);
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
  }, [viewModel]);
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
  // 其他阶段：同样座位盘保持可见，阶段 UI 在座位盘下方（对齐狼人杀全程 seats 模式）。
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
                <AvalonBoardInfoCard
                  playerCount={config.numberOfPlayers}
                  collapsed
                  onRolePress={(roleId) => {
                    screen.setRolePreviewId(roleId);
                    screen.setRoleCardVisible(true);
                  }}
                  styles={boardInfoStyles}
                />
              ),
              afterSeatBoard: (
                <AvalonStage
                  key={screen.state.phase.kind}
                  screen={screen}
                  viewModel={viewModel}
                  strikePickMode={strikePickMode}
                  setStrikePickMode={setStrikePickMode}
                  onOpenVote={() => setVoteModalOpen(true)}
                  onOpenQuest={() => setQuestModalOpen(true)}
                  nominateSelection={nominateSelection}
                  onShowLadyAcknowledge={() => setLadyAckOpen(true)}
                />
              ),
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
              {voteModalOpen && viewModel.phase === 'vote' ? (
                <AvalonVoteModal
                  viewModel={viewModel}
                  remainingSeconds={screen.phaseRemainingSeconds}
                  isSubmitting={screen.isSubmitting}
                  onVote={(vote) => void screen.submit('投票', { type: 'avalon.team.vote', vote })}
                  onClose={() => setVoteModalOpen(false)}
                />
              ) : null}
              {questModalOpen && viewModel.phase === 'quest' ? (
                <AvalonQuestModal
                  viewModel={viewModel}
                  remainingSeconds={screen.phaseRemainingSeconds}
                  isSubmitting={screen.isSubmitting}
                  onPlay={(play) => void screen.submit('出牌', { type: 'avalon.quest.play', play })}
                  onClose={() => setQuestModalOpen(false)}
                />
              ) : null}
              {isNight && screen.nightModalVisible ? (
                <AvalonNightConfirmModal
                  viewModel={viewModel}
                  isSubmitting={screen.isSubmitting}
                  onConfirm={() => {
                    screen.setNightModalVisible(false);
                    void screen.submit('确认信息', { type: 'avalon.night.confirm' });
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
                  void screen.submit('查验', { type: 'avalon.lady.check', seat });
                }}
                onClose={() => setLadyCheckTarget(null)}
              />
              {ladyAckOpen && viewModel.phase === 'lady' ? (
                <AvalonLadyAcknowledgeModal
                  viewModel={viewModel}
                  isSubmitting={screen.isSubmitting}
                  onAcknowledge={() => {
                    setLadyAckOpen(false);
                    void screen.submit('确认展示', { type: 'avalon.lady.acknowledge' });
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
              {strikePickMode ? (
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

/** 按权威阶段选择视图；刺杀类操作走 AlertModal 二次确认。 */
function AvalonStage({
  screen,
  viewModel,
  strikePickMode,
  setStrikePickMode,
  onOpenVote,
  onOpenQuest,
  nominateSelection,
  onShowLadyAcknowledge,
}: {
  readonly screen: AvalonScreenState;
  readonly viewModel: AvalonViewModel;
  readonly strikePickMode: boolean;
  readonly setStrikePickMode: (active: boolean) => void;
  readonly onOpenVote: () => void;
  readonly onOpenQuest: () => void;
  readonly nominateSelection: ReadonlySet<number>;
  readonly onShowLadyAcknowledge: () => void;
}) {
  const { submit, isSubmitting } = screen;
  // 晚上走弹窗模式（Cupid 两步），不在 afterSeatBoard 渲染阶段 UI。
  if (screen.state.phase.kind === 'night') return null;
  const kind = resolveAvalonStageKind(screen.state.phase);
  return (
    <>
      {viewModel.canEarlyStrike && !strikePickMode ? (
        <View style={styles.strikeBar}>
          <Button
            variant="danger"
            size="sm"
            onPress={() => setStrikePickMode(true)}
            testID="avalon-early-strike"
          >
            刺杀
          </Button>
          <Text style={styles.strikeHint}>晚上已过，可随时提前刺杀</Text>
        </View>
      ) : null}
      {kind === 'nominate' ? (
        <AvalonNominateView
          viewModel={viewModel}
          selectedSeats={nominateSelection}
          isSubmitting={isSubmitting}
          onPropose={(seats) => void submit('提交队伍', { type: 'avalon.team.propose', seats })}
        />
      ) : kind === 'vote' ? (
        <AvalonVoteStrip screen={screen} viewModel={viewModel} onOpenVote={onOpenVote} />
      ) : kind === 'quest' ? (
        <AvalonQuestStrip screen={screen} viewModel={viewModel} onOpenQuest={onOpenQuest} />
      ) : kind === 'lady' ? (
        <AvalonLadyView viewModel={viewModel} onShowAcknowledge={onShowLadyAcknowledge} />
      ) : kind === 'assassin' ? (
        <AvalonAssassinStrip viewModel={viewModel} />
      ) : (
        <AvalonEndedView viewModel={viewModel} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  strikeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.tight,
  },
  strikeHint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  stripBody: {
    ...textStyles.body,
    color: colors.text,
  },
  historyButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
  },
});

/** 投票阶段条：进度与倒计时在盘下，投票动作走弹窗（自动弹一次，本条可重开）。 */
function AvalonVoteStrip({
  screen,
  viewModel,
  onOpenVote,
}: {
  readonly screen: AvalonScreenState;
  readonly viewModel: AvalonViewModel;
  readonly onOpenVote: () => void;
}) {
  const phase = screen.state.phase;
  const instruction = resolveVoteInstruction(viewModel);
  const castCount = phase.kind === 'vote' ? Object.keys(phase.ballots).length : 0;
  const totalCount = Object.keys(screen.state.roster).length;
  const remaining = screen.phaseRemainingSeconds;
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 组队投票`}
      testID="avalon-vote"
    >
      <AvalonInfoCard title="投票进行中">
        <Text style={styles.stripBody}>
          {remaining !== null
            ? `已全部投票，${remaining} 秒后揭晓`
            : `已投 ${castCount}/${totalCount}`}
        </Text>
        {instruction.myBallot !== null ? (
          <Text style={styles.stripBody}>
            你已投：{instruction.myBallot === 'approve' ? '赞成' : '反对'}（揭晓前可改票）
          </Text>
        ) : null}
        {instruction.canVote ? (
          <Button variant="primary" size="md" onPress={onOpenVote} testID="avalon-vote-open">
            {instruction.myBallot === null ? '去投票' : '修改投票'}
          </Button>
        ) : (
          <Text style={styles.stripBody}>
            {screen.canControlBots ? '长按机器人座位接管后投票。' : '你不在座位上，无法投票。'}
          </Text>
        )}
      </AvalonInfoCard>
    </AvalonStageFrame>
  );
}

/** 任务阶段条：进度与倒计时在盘下，出牌动作走弹窗（自动弹一次，本条可重开）。 */
function AvalonQuestStrip({
  screen,
  viewModel,
  onOpenQuest,
}: {
  readonly screen: AvalonScreenState;
  readonly viewModel: AvalonViewModel;
  readonly onOpenQuest: () => void;
}) {
  const phase = screen.state.phase;
  const instruction = resolveQuestInstruction(viewModel);
  const playedCount =
    phase.kind === 'quest'
      ? phase.teamSeats.filter((seat) => phase.plays[seat] !== undefined).length
      : 0;
  const teamSize = phase.kind === 'quest' ? phase.teamSeats.length : 0;
  const remaining = screen.phaseRemainingSeconds;
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 任务执行`}
      testID="avalon-quest"
    >
      <AvalonInfoCard title="任务进行中">
        <Text style={styles.stripBody}>
          {remaining !== null
            ? `已全部出牌，${remaining} 秒后揭晓`
            : `已出牌 ${playedCount}/${teamSize}`}
        </Text>
        {instruction.isTeamMember ? (
          <Button variant="primary" size="md" onPress={onOpenQuest} testID="avalon-quest-open">
            {instruction.myPlay === null ? '去出牌' : '修改出牌'}
          </Button>
        ) : (
          <Text style={styles.stripBody}>等待队员出牌…</Text>
        )}
      </AvalonInfoCard>
    </AvalonStageFrame>
  );
}

/** 刺杀阶段条：刺客在座位盘上点选指认目标（点选后走二次确认弹窗），其余人等待。 */
function AvalonAssassinStrip({ viewModel }: { readonly viewModel: AvalonViewModel }) {
  const instruction = resolveAssassinInstruction(viewModel);
  return (
    <AvalonStageFrame title="刺杀阶段" testID="avalon-assassin">
      {instruction.kind === 'assassinPick' ? (
        <AvalonInfoCard title="在座位盘上指认梅林" testID="avalon-assassin-picker">
          <Text style={styles.stripBody}>
            点座位盘点选一名玩家指认其为梅林（除自己外任意座位），点选后会再次确认。指认正确坏人获胜，指认错误好人直接获胜。
          </Text>
        </AvalonInfoCard>
      ) : instruction.kind === 'evilWait' ? (
        <AvalonInfoCard title="坏人商量时间">
          <Text style={styles.stripBody}>坏人商量时间（线下口头），等待刺客指认。</Text>
        </AvalonInfoCard>
      ) : (
        <AvalonInfoCard title="等待刺杀结果">
          <Text style={styles.stripBody}>坏人正在商量刺杀目标…</Text>
        </AvalonInfoCard>
      )}
    </AvalonStageFrame>
  );
}
