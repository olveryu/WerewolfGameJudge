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

import { AvalonAssassinView } from './components/AvalonAssassinView';
import { AvalonBoardInfoCard } from './components/AvalonBoardInfoCard';
import { AvalonEndedView } from './components/AvalonEndedView';
import { AvalonHistoryOverlay } from './components/AvalonHistoryOverlay';
import { AvalonLadyView } from './components/AvalonLadyView';
import { AvalonNightConfirmModal } from './components/AvalonNightConfirmModal';
import { AvalonNominateView } from './components/AvalonNominateView';
import { AvalonQuestModal } from './components/AvalonQuestModal';
import { AvalonQuestResultPanel } from './components/AvalonQuestResultPanel';
import { AvalonRoleCardModal } from './components/AvalonRoleCardModal';
import { AvalonSeatPicker } from './components/AvalonSeatPicker';
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
  resolveAvalonStageKind,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from './policy/avalonInteractionPolicy';

type AvalonScreenState = AvalonRoomScreenState;

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
                  onRequestStrike={setStrikeConfirm}
                  strikePickMode={strikePickMode}
                  setStrikePickMode={setStrikePickMode}
                  onOpenVote={() => setVoteModalOpen(true)}
                  onOpenQuest={() => setQuestModalOpen(true)}
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
  onRequestStrike,
  strikePickMode,
  setStrikePickMode,
  onOpenVote,
  onOpenQuest,
}: {
  readonly screen: AvalonScreenState;
  readonly viewModel: AvalonViewModel;
  readonly onRequestStrike: (confirmation: AvalonStrikeConfirmation) => void;
  readonly strikePickMode: boolean;
  readonly setStrikePickMode: (active: boolean) => void;
  readonly onOpenVote: () => void;
  readonly onOpenQuest: () => void;
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
      {strikePickMode ? (
        <AvalonStageFrame title="提前刺杀：选择目标" testID="avalon-early-strike-picker">
          <AvalonInfoCard title="点选刺杀目标">
            <Text style={styles.strikeHint}>
              除自己外任意座位可选；刺中梅林坏人直接获胜，刺错好人直接获胜。
            </Text>
            <AvalonSeatPicker
              seats={eligibleStrikeTargets(viewModel).map((seat) => ({
                seat,
                displayName:
                  viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
                  `座位${seat + 1}`,
              }))}
              selectedSeats={new Set()}
              disabledSeats={new Set()}
              onSelect={(seat) => onRequestStrike({ seat, mode: 'earlyStrike' })}
              testIDPrefix="avalon-early-strike"
            />
            <Button variant="secondary" size="md" onPress={() => setStrikePickMode(false)}>
              取消
            </Button>
          </AvalonInfoCard>
        </AvalonStageFrame>
      ) : kind === 'nominate' ? (
        <AvalonNominateView
          viewModel={viewModel}
          isSubmitting={isSubmitting}
          onPropose={(seats) => void submit('提交队伍', { type: 'avalon.team.propose', seats })}
        />
      ) : kind === 'vote' ? (
        <AvalonVoteStrip screen={screen} viewModel={viewModel} onOpenVote={onOpenVote} />
      ) : kind === 'quest' ? (
        <AvalonQuestStrip screen={screen} viewModel={viewModel} onOpenQuest={onOpenQuest} />
      ) : kind === 'lady' ? (
        <AvalonLadyView
          viewModel={viewModel}
          isSubmitting={isSubmitting}
          onCheck={(seat) => void submit('查验', { type: 'avalon.lady.check', seat })}
          onAcknowledge={() => void submit('确认展示', { type: 'avalon.lady.acknowledge' })}
        />
      ) : kind === 'assassin' ? (
        <AvalonAssassinView
          viewModel={viewModel}
          onSelectSeat={(seat) => onRequestStrike({ seat, mode: 'accuse' })}
        />
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
