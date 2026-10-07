/**
 * 阿瓦隆房间：按权威阶段渲染大厅（座位表）、晚上、组队、投票、出牌、湖仙、刺杀与终局。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  type AvalonViewModel,
  getAvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
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
import { AvalonQuestView } from './components/AvalonQuestView';
import { AvalonRoleCardModal } from './components/AvalonRoleCardModal';
import { AvalonSeatPicker } from './components/AvalonSeatPicker';
import { AvalonInfoCard, AvalonStageFrame } from './components/AvalonStageFrame';
import {
  type AvalonStrikeConfirmation,
  AvalonStrikeConfirmModal,
} from './components/AvalonStrikeConfirmModal';
import { AvalonVoteResultPanel } from './components/AvalonVoteResultPanel';
import { AvalonVoteView } from './components/AvalonVoteView';
import { useAvalonRoomState } from './hooks/useAvalonRoomState';
import { eligibleStrikeTargets, resolveAvalonStageKind } from './policy/avalonInteractionPolicy';

type AvalonScreenState = ReturnType<typeof useAvalonRoomState>;

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
  const viewModel = isLobby ? null : getAvalonViewModel(screen.state, screen.effectiveSeat);
  const [historyVisible, setHistoryVisible] = useState(false);
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
                    title="阿瓦隆"
                    subtitle={`${config.numberOfPlayers} 人 · 投票${config.voteMode === 'public' ? '公投' : '暗投'} · 否决上限 ${config.vetoLimit}`}
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
                />
              ),
              afterSeatBoard: (
                <AvalonStage
                  key={`${screen.state.phaseRevision}:${screen.state.phase.kind}`}
                  screen={screen}
                  viewModel={viewModel}
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
}: {
  readonly screen: AvalonScreenState;
  readonly viewModel: AvalonViewModel;
}) {
  const { submit, isSubmitting } = screen;
  const [strikePickMode, setStrikePickMode] = useState(false);
  const [strikeConfirm, setStrikeConfirm] = useState<AvalonStrikeConfirmation | null>(null);
  // 晚上走弹窗模式（Cupid 两步），不在 afterSeatBoard 渲染阶段 UI。
  if (screen.state.phase.kind === 'night') return null;
  const kind = resolveAvalonStageKind(screen.state.phase);
  const closeStrike = () => {
    setStrikeConfirm(null);
    setStrikePickMode(false);
  };
  const confirmStrike = () => {
    if (strikeConfirm === null) return;
    const { seat, mode } = strikeConfirm;
    closeStrike();
    if (mode === 'accuse') void submit('指认', { type: 'avalon.assassin.accuse', seat });
    else void submit('提前刺杀', { type: 'avalon.assassin.earlyStrike', seat });
  };
  const strikeName =
    strikeConfirm === null
      ? ''
      : (viewModel.seats.find((seatView) => seatView.seat === strikeConfirm.seat)?.displayName ??
        `座位${strikeConfirm.seat + 1}`);
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
              onSelect={(seat) => setStrikeConfirm({ seat, mode: 'earlyStrike' })}
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
        <AvalonVoteView
          viewModel={viewModel}
          onVote={(vote) => void submit('投票', { type: 'avalon.team.vote', vote })}
        />
      ) : kind === 'quest' ? (
        <AvalonQuestView
          viewModel={viewModel}
          onPlay={(play) => void submit('出牌', { type: 'avalon.quest.play', play })}
        />
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
          onSelectSeat={(seat) => setStrikeConfirm({ seat, mode: 'accuse' })}
        />
      ) : (
        <AvalonEndedView viewModel={viewModel} />
      )}
      <AvalonStrikeConfirmModal
        confirmation={strikeConfirm}
        seatName={strikeName}
        onConfirm={confirmStrike}
        onClose={closeStrike}
      />
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
  historyButton: {
    minWidth: fixed.minTouchTarget,
    minHeight: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.small,
  },
});
