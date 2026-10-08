/**
 * 你画我猜房间：按权威阶段渲染大厅（座位表）、选词、作画、结算与终局。
 */

import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessPhase,
  type DrawGuessViewModel,
  getDrawGuessViewModel,
} from '@game-judge/game-engine/games/drawguess/public';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AlertModal } from '@/components/AlertModal';
import { BotTakeover, type BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { Button } from '@/components/Button';
import {
  DRAWING_PALETTE,
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingTool,
  type DrawingWidth,
} from '@/features/drawing/model/drawing';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import { RoomTaskViewport } from '@/features/room/components/RoomTaskViewport';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useStageDeadline } from '@/features/room/hooks/useStageDeadline';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { CloudflareHttpError } from '@/services/cloudflare/cfFetch';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import {
  readDrawGuessDrawingDataUri,
  renderDrawGuessDrawing,
  uploadDrawGuessDrawing,
} from '../services/drawGuessMediaApi';
import { DrawGuessDrawingCanvas } from './components/DrawGuessDrawingCanvas';
import { DrawGuessGuessPanel } from './components/DrawGuessGuessPanel';
import { DrawGuessHintBar } from './components/DrawGuessHintBar';
import { DrawGuessScoreboard } from './components/DrawGuessScoreboard';
import { DrawGuessToolbar } from './components/DrawGuessToolbar';
import { getDrawGuessRoomCommandFailureMessage } from './drawGuessRoomCommandFailureMessage';
import { useDrawGuessRoomState } from './hooks/useDrawGuessRoomState';
import { drawGuessStrokeToElement, useDrawGuessStrokeSync } from './hooks/useDrawGuessStrokeSync';

/** 游戏工作区最大宽度（与接龙版一致），水平居中。 */
const DRAWGUESS_STAGE_MAX_WIDTH = 430;
/** 宽屏断点：达到此宽度时作画区切换为左右分栏（画布左、工具+聊天右）。 */
const DRAWGUESS_WIDE_LAYOUT_BREAKPOINT = 768;
const PNG_UPLOAD_MAX_ATTEMPTS = 3;
const PNG_UPLOAD_RETRY_MS = 5000;

type DrawGuessScreenState = ReturnType<typeof useDrawGuessRoomState>;
type DrawGuessWordSelectPhase = Extract<DrawGuessPhase, { readonly kind: 'wordSelect' }>;
type DrawGuessDrawingPhase = Extract<DrawGuessPhase, { readonly kind: 'drawing' }>;
type DrawGuessRoundEndPhase = Extract<DrawGuessPhase, { readonly kind: 'roundEnd' }>;

type DrawGuessRoomScreenProps = GameRoomScreenProps<'drawguess'> & {
  readonly session: DrawGuessRoomSession;
};

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function DrawGuessRoomScreen(props: DrawGuessRoomScreenProps) {
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(props.navigation)}
    >
      {(entryController) => <DrawGuessRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function DrawGuessRoomContent(
  props: DrawGuessRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useDrawGuessRoomState(props);
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  return (
    <RoomShell
      model={screen.shellModel}
      content={
        isLobby
          ? {
              kind: 'seats',
              contextHeader: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <RoomGameSummary
                  icon="pencil-outline"
                  title="你画我猜"
                  subtitle={`${config.numberOfPlayers} 人 · 每人 ${DRAWGUESS_ROUNDS_PER_DRAWER} 轮 · 选词 ${DRAWGUESS_WORD_SELECT_SECONDS} 秒 · 作画 ${DRAWGUESS_DRAWING_DURATION_SECONDS} 秒 · 结算 ${DRAWGUESS_ROUND_END_SECONDS} 秒`}
                  headerRight={
                    <RoomGuideButton onPress={screen.openRules} label="查看你画我猜玩法" />
                  }
                />
              ),
            }
          : {
              kind: 'workspace',
              element: (
                <DrawGuessStage
                  key={`${screen.state.turnIndex}:${screen.state.phase.kind}`}
                  screen={screen}
                />
              ),
            }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={null}
    />
  );
}

/** 按权威阶段选择视图；view model 按当前有效席位裁剪后传入各视图。 */
function DrawGuessStage({ screen }: { readonly screen: DrawGuessScreenState }) {
  const { state, session, effectiveSeat } = screen;
  const phase = state.phase;
  const deadlineAt =
    phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd'
      ? phase.deadlineAt
      : null;
  const shouldExpire = useCallback(() => {
    const current = session.getSnapshot();
    return (
      current.phase === 'ready' &&
      current.connection === 'live' &&
      current.pendingCommandCount === 0 &&
      current.snapshot.state.phaseRevision === state.phaseRevision
    );
  }, [session, state.phaseRevision]);
  const onExpire = useCallback(
    () =>
      session.dispatch(
        {
          type: 'drawguess.phase.expire',
          phaseRevision: state.phaseRevision,
          turnIndex: state.turnIndex,
        },
        { controlledSeat: null, label: '推进作画阶段', isRecoverable: true },
      ),
    [session, state.phaseRevision, state.turnIndex],
  );
  const remainingSeconds = useStageDeadline({
    deadlineAt,
    shouldExpire,
    onExpire,
    label: '推进作画阶段',
  });
  // drawguess 原 hook 返回 { remainingSeconds }，此处保持调用方兼容
  const deadline = { remainingSeconds };
  const nowMs = useDrawGuessNowMs();
  // view model 每次渲染用当前时间重新计算，拼音首字母揭示随 1 秒 tick 更新。
  const viewModel = getDrawGuessViewModel(state, effectiveSeat, nowMs);
  if (phase.kind === 'wordSelect') {
    return (
      <DrawGuessWordSelectView
        screen={screen}
        phase={phase}
        viewModel={viewModel}
        remainingSeconds={deadline.remainingSeconds}
      />
    );
  }
  if (phase.kind === 'drawing') {
    return (
      <DrawGuessDrawingView
        screen={screen}
        phase={phase}
        viewModel={viewModel}
        remainingSeconds={deadline.remainingSeconds}
      />
    );
  }
  if (phase.kind === 'roundEnd') {
    return (
      <DrawGuessRoundEndView
        screen={screen}
        phase={phase}
        viewModel={viewModel}
        remainingSeconds={deadline.remainingSeconds}
      />
    );
  }
  if (phase.kind === 'ended') {
    return <DrawGuessEndedView screen={screen} viewModel={viewModel} />;
  }
  throw new Error('[FAIL-FAST] DrawGuess stage received the lobby phase');
}

function DrawGuessStageFrame({
  turnLabel,
  remainingSeconds,
  countdownLabel,
  children,
}: {
  readonly turnLabel: string;
  readonly remainingSeconds: number | null;
  readonly countdownLabel: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.stageOuter}>
      <View style={styles.stageInner}>
        <View style={styles.stageHeader}>
          <Text style={styles.turnLabel}>{turnLabel}</Text>
          <DrawGuessCountdown remainingSeconds={remainingSeconds} label={countdownLabel} />
        </View>
        <ScrollView
          style={styles.stageScroll}
          contentContainerStyle={styles.stageScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

/** 每秒更新的本地时钟：驱动拼音首字母揭示的显示 tick（effect 内更新，render 保持纯）。 */
function useDrawGuessNowMs(): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return nowMs;
}

/** 固定宽度 mm:ss 等宽倒计时；最后 5 秒醒目提示。 */
function DrawGuessCountdown({
  remainingSeconds,
  label,
}: {
  readonly remainingSeconds: number | null;
  readonly label: string;
}) {
  if (remainingSeconds === null) return <View style={styles.countdownPlaceholder} />;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const urgent = remainingSeconds <= 5;
  return (
    <View
      style={styles.countdown}
      accessibilityLabel={`${label}剩余 ${minutes} 分 ${seconds} 秒`}
      accessibilityRole="timer"
    >
      <Text style={[styles.countdownText, urgent && styles.countdownUrgent]}>
        {minutes}:{String(seconds).padStart(2, '0')}
      </Text>
    </View>
  );
}

/** 房主接管机器人：转接共用 BotTakeover 组件（2026 重设计）。 */
function DrawGuessTakeover({
  screen,
  viewModel,
  remainingSeconds,
}: {
  readonly screen: DrawGuessScreenState;
  readonly viewModel: DrawGuessViewModel;
  readonly remainingSeconds: number | null;
}) {
  const { state, isHost, canControlBots, controlledSeat, takeOver, releaseBot } = screen;
  const isLobby = state.phase.kind === 'lobby';
  const bots: BotTakeoverBot[] = viewModel.seats
    .filter((seat) => seat.isBot)
    .map((seat) => ({
      seat: seat.seat,
      displayName: seat.displayName,
      status: seat.isLocked
        ? ('done' as const)
        : seat.isDrawer
          ? ('acting' as const)
          : ('waiting' as const),
      statusLabel: seat.isDrawer
        ? `正在作画${remainingSeconds !== null ? ` · 剩余 ${remainingSeconds}s` : ''}`
        : seat.isLocked
          ? '已猜中'
          : '等待',
      actionLabel: seat.isDrawer ? '接管代画' : '接管',
    }));
  const activeSeat =
    state.phase.kind === 'drawing'
      ? state.phase.drawerSeat
      : state.phase.kind === 'wordSelect'
        ? state.phase.drawerSeat
        : null;
  return (
    <BotTakeover
      bots={bots}
      activeSeat={activeSeat}
      remainingSeconds={remainingSeconds}
      controlledSeat={controlledSeat}
      canControl={isHost && canControlBots}
      isLobby={isLobby}
      onTakeOver={takeOver}
      onRelease={releaseBot}
    />
  );
}

// ─── 选词 ────────────────────────────────────────────────────────────────────

function DrawGuessWordSelectView({
  screen,
  phase,
  viewModel,
  remainingSeconds,
}: {
  readonly screen: DrawGuessScreenState;
  readonly phase: DrawGuessWordSelectPhase;
  readonly viewModel: DrawGuessViewModel;
  readonly remainingSeconds: number | null;
}) {
  const { state, effectiveSeat, submit } = screen;
  const isDrawer = viewModel.drawerSeat !== null && effectiveSeat === viewModel.drawerSeat;
  const drawerName =
    viewModel.seats.find((seat) => seat.seat === viewModel.drawerSeat)?.displayName ?? '画手';
  const choose = (word: string) => {
    void submit('选择题目', {
      type: 'drawguess.word.choose',
      word,
      phaseRevision: state.phaseRevision,
      turnIndex: state.turnIndex,
    });
  };
  return (
    <DrawGuessStageFrame
      turnLabel={viewModel.turnLabel}
      remainingSeconds={remainingSeconds}
      countdownLabel="选词"
    >
      {isDrawer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>请选择本轮题目（{phase.choices.length} 选 1）</Text>
          {viewModel.choices.length === 0 ? (
            <Text style={styles.hint}>题目准备中，请稍候…</Text>
          ) : (
            viewModel.choices.map((word, index) => (
              <Button
                key={word}
                variant="secondary"
                size="lg"
                testID={`drawguess-word-choice-${index}`}
                onPress={() => choose(word)}
              >
                {word}
              </Button>
            ))
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{drawerName} 正在选词…</Text>
          <Text style={styles.hint}>选词结束后开始作画，请准备猜词。</Text>
        </View>
      )}
      <DrawGuessTakeover
        screen={screen}
        viewModel={viewModel}
        remainingSeconds={remainingSeconds}
      />
    </DrawGuessStageFrame>
  );
}

// ─── 作画 ────────────────────────────────────────────────────────────────────

function DrawGuessDrawingView({
  screen,
  phase,
  viewModel,
  remainingSeconds,
}: {
  readonly screen: DrawGuessScreenState;
  readonly phase: DrawGuessDrawingPhase;
  readonly viewModel: DrawGuessViewModel;
  readonly remainingSeconds: number | null;
}) {
  const { state, session, effectiveSeat, controlledSeat, isHost, submit } = screen;
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= DRAWGUESS_WIDE_LAYOUT_BREAKPOINT;
  const isDrawer = effectiveSeat === phase.drawerSeat;
  const [tool, setTool] = useState<DrawingTool>('brush');
  const [color, setColor] = useState<DrawingColor>(DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<DrawingWidth>(DRAWING_WIDTHS[1]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const canDraw = isDrawer && remainingSeconds !== null && remainingSeconds > 0;
  const sync = useDrawGuessStrokeSync({
    session,
    authoritativeStrokes: phase.strokes,
    phaseRevision: state.phaseRevision,
    turnIndex: state.turnIndex,
    effectiveSeat,
    controlledSeat,
    canDraw,
  });

  const clearDrawing = (): void => {
    setShowClearConfirm(true);
  };

  const confirmClearDrawing = (): void => {
    setShowClearConfirm(false);
    sync.clear();
  };
  const viewerSeatView = viewModel.seats.find((seat) => seat.seat === effectiveSeat);
  const isLocked = viewerSeatView?.isLocked ?? false;
  const canGuess =
    !isDrawer && effectiveSeat !== null && remainingSeconds !== null && remainingSeconds > 0;

  const submitGuess = (text: string) => {
    void (async () => {
      try {
        const result = await session.dispatch(
          {
            type: 'drawguess.guess.submit',
            text,
            phaseRevision: state.phaseRevision,
            turnIndex: state.turnIndex,
          },
          { controlledSeat, label: '提交猜词' },
        );
        if (!isSuccessfulRoomCommand(result))
          showErrorAlert('提交猜词失败', getDrawGuessRoomCommandFailureMessage(result));
      } catch (error: unknown) {
        if (error instanceof CloudflareHttpError && error.status === 429) {
          showErrorAlert('猜得太快了', '猜得太快了，稍后再试');
          return;
        }
        handleError(error, {
          label: '提交猜词',
          logger: roomScreenLog,
          alertMessage: '提交猜词失败，请重试',
        });
      }
    })();
  };

  const giveUp = () => {
    showConfirmAlert('放弃本轮', '将直接进入结算并公布答案，确定放弃本轮作画吗？', () => {
      void submit('放弃本轮', { type: 'drawguess.round.finish' });
    });
  };

  return (
    <>
      <DrawGuessTakeover
        screen={screen}
        viewModel={viewModel}
        remainingSeconds={remainingSeconds}
      />
      <RoomTaskViewport>
        <DrawGuessStageFrame
          turnLabel={viewModel.turnLabel}
          remainingSeconds={remainingSeconds}
          countdownLabel="作画"
        >
          <DrawGuessHintBar
            word={viewModel.word}
            hintText={viewModel.hintText}
            wordLength={viewModel.wordLength}
          />
          <View style={isWideLayout ? styles.drawingBodyWide : styles.drawingBodyNarrow}>
            <View style={isWideLayout ? styles.canvasWide : styles.canvasNarrow}>
              <DrawGuessDrawingCanvas
                elements={sync.elements}
                tool={tool}
                color={color}
                strokeWidth={strokeWidth}
                isEnabled={canDraw}
                onElementChange={sync.onElementChange}
                onElementComplete={sync.onElementComplete}
                onFill={(point) => sync.onFill(point, color, strokeWidth)}
              />
            </View>
            <View style={isWideLayout ? styles.sidePanelWide : styles.sidePanelNarrow}>
              {isDrawer ? (
                <>
                  <DrawGuessToolbar
                    tool={tool}
                    color={color}
                    strokeWidth={strokeWidth}
                    canUndo={sync.elements.length > 0}
                    canRedo={sync.canRedo}
                    disabled={!canDraw}
                    onToolChange={setTool}
                    onColorChange={setColor}
                    onWidthChange={setStrokeWidth}
                    onUndo={sync.undo}
                    onRedo={sync.redo}
                    onClear={clearDrawing}
                  />
                  <View style={styles.drawerActions}>
                    {(isDrawer || isHost) && (
                      <Button variant="danger" size="sm" onPress={giveUp}>
                        放弃本轮
                      </Button>
                    )}
                  </View>
                  <Text style={styles.hint}>作画不许写字、写数字。猜词聊天流：</Text>
                </>
              ) : null}
              <View style={styles.guessPanelContainer}>
                <DrawGuessGuessPanel
                  messages={viewModel.messages}
                  viewerSeat={effectiveSeat}
                  isLocked={isDrawer ? false : isLocked}
                  canGuess={isDrawer ? false : canGuess}
                  readOnly={isDrawer}
                  onSubmitGuess={submitGuess}
                />
              </View>
            </View>
          </View>
        </DrawGuessStageFrame>
      </RoomTaskViewport>
      <AlertModal
        visible={showClearConfirm}
        title="清空画布？"
        message="所有绘画内容都会被删除。"
        buttons={[
          { text: '取消', style: 'cancel', onPress: () => setShowClearConfirm(false) },
          { text: '清空', style: 'destructive', onPress: confirmClearDrawing },
        ]}
        onClose={() => setShowClearConfirm(false)}
      />
    </>
  );
}

// ─── 结算 ────────────────────────────────────────────────────────────────────

function DrawGuessRoundEndView({
  screen,
  phase,
  viewModel,
  remainingSeconds,
}: {
  readonly screen: DrawGuessScreenState;
  readonly phase: DrawGuessRoundEndPhase;
  readonly viewModel: DrawGuessViewModel;
  readonly remainingSeconds: number | null;
}) {
  const { state, session, effectiveSeat, controlledSeat, roomCode } = screen;
  const isDrawer = effectiveSeat === phase.drawerSeat;
  const [pngUri, setPngUri] = useState<string | null>(null);
  const reserveFlight = useRef(false);
  const uploadFlight = useRef(false);
  const uploadAttempts = useRef(0);
  const [uploadRetryTick, setUploadRetryTick] = useState(0);

  // 画手：先拿一次性上传预留，再把终稿笔画渲染成 PNG 上传。
  useEffect(() => {
    if (!isDrawer || phase.reservation !== null || reserveFlight.current) return;
    reserveFlight.current = true;
    void session
      .dispatch({ type: 'drawguess.drawing.reserve' }, { controlledSeat, label: '预留画作上传' })
      .catch((error: unknown) => {
        reserveFlight.current = false;
        handleError(error, {
          label: '预留画作上传',
          logger: roomScreenLog,
          alertMessage: '画作上传预留失败，请重试',
        });
      });
  }, [isDrawer, phase.reservation, session, controlledSeat]);

  useEffect(() => {
    const reservation = phase.reservation;
    if (
      !isDrawer ||
      reservation === null ||
      phase.pngEntry !== null ||
      phase.strokes.length === 0 ||
      uploadFlight.current ||
      uploadAttempts.current >= PNG_UPLOAD_MAX_ATTEMPTS
    )
      return;
    uploadFlight.current = true;
    uploadAttempts.current += 1;
    let cancelled = false;
    void (async () => {
      try {
        const elements = phase.strokes.map(drawGuessStrokeToElement);
        const png = renderDrawGuessDrawing(elements);
        await uploadDrawGuessDrawing(roomCode, reservation.submissionId, png, controlledSeat);
      } catch (error: unknown) {
        roomScreenLog.warn('round-end PNG upload failed', {
          attempt: uploadAttempts.current,
        });
        handleError(error, {
          label: '上传终稿画作',
          logger: roomScreenLog,
          alertMessage: '画作上传失败，稍后自动重试',
        });
        setTimeout(() => {
          if (!cancelled) setUploadRetryTick((tick) => tick + 1);
        }, PNG_UPLOAD_RETRY_MS);
      } finally {
        if (!cancelled) uploadFlight.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isDrawer,
    phase.reservation,
    phase.pngEntry,
    phase.strokes,
    controlledSeat,
    roomCode,
    uploadRetryTick,
    state.phaseRevision,
  ]);

  // 终稿展示优先 R2 PNG，缺失或读取失败时降级用权威笔画本地渲染。
  useEffect(() => {
    const reservation = phase.reservation;
    if (phase.pngEntry === null || reservation === null) {
      setPngUri(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const uri = await readDrawGuessDrawingDataUri(
          roomCode,
          reservation.entryId,
          controlledSeat,
        );
        if (!cancelled) setPngUri(uri);
      } catch (error: unknown) {
        roomScreenLog.warn('round-end PNG read failed, falling back to strokes', {
          entryId: reservation.entryId,
        });
        handleError(error, { label: '读取终稿画作', logger: roomScreenLog });
        if (!cancelled) setPngUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase.pngEntry, phase.reservation, roomCode, controlledSeat]);

  const roundRows = viewModel.seats.map((seat) => ({
    seat: seat.seat,
    displayName: seat.displayName,
    isBot: seat.isBot,
    isDrawer: seat.isDrawer,
    score: viewModel.roundScores?.[seat.seat] ?? 0,
  }));

  return (
    <DrawGuessStageFrame
      turnLabel={viewModel.turnLabel}
      remainingSeconds={remainingSeconds}
      countdownLabel="结算"
    >
      <View style={styles.answerBanner} accessibilityLabel={`本轮答案：${phase.word}`}>
        <Text style={styles.answerLabel}>本轮答案</Text>
        <Text style={styles.answerWord}>{phase.word}</Text>
      </View>
      {pngUri !== null ? (
        <Image
          source={{ uri: pngUri }}
          style={styles.artwork}
          accessibilityLabel="本轮画作终稿"
          resizeMode="contain"
        />
      ) : (
        <DrawGuessDrawingCanvas
          elements={phase.strokes.map(drawGuessStrokeToElement)}
          tool="brush"
          color={DRAWING_PALETTE[0].value}
          strokeWidth={DRAWING_WIDTHS[1]}
          isEnabled={false}
          onElementChange={() => undefined}
          onElementComplete={() => undefined}
          onFill={() => undefined}
        />
      )}
      <DrawGuessScoreboard title="本轮得分" competitionRanking={false} rows={roundRows} />
    </DrawGuessStageFrame>
  );
}

// ─── 终局 ────────────────────────────────────────────────────────────────────

function DrawGuessEndedView({
  screen,
  viewModel,
}: {
  readonly screen: DrawGuessScreenState;
  readonly viewModel: DrawGuessViewModel;
}) {
  const { isHost } = screen;
  const totalRows = viewModel.seats.map((seat) => ({
    seat: seat.seat,
    displayName: seat.displayName,
    isBot: seat.isBot,
    isDrawer: seat.isDrawer,
    score: viewModel.totalScores[seat.seat] ?? 0,
  }));
  return (
    <DrawGuessStageFrame turnLabel="本局结束" remainingSeconds={null} countdownLabel="">
      <DrawGuessScoreboard title="最终排名" competitionRanking rows={totalRows} />
      {!isHost && <Text style={styles.hint}>等待房主操作（再来一局 / 返回大厅）</Text>}
    </DrawGuessStageFrame>
  );
}

const styles = StyleSheet.create({
  stageOuter: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  stageInner: {
    width: '100%',
    maxWidth: DRAWGUESS_STAGE_MAX_WIDTH,
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.small,
    gap: spacing.small,
    flex: 1,
    minHeight: 0,
  },
  stageScroll: {
    flex: 1,
    minHeight: 0,
  },
  stageScrollContent: {
    gap: spacing.small,
    paddingBottom: spacing.medium,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  turnLabel: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  countdown: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  countdownPlaceholder: {
    minWidth: 76,
  },
  countdownText: {
    ...textStyles.titleBold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  countdownUrgent: {
    color: colors.primary,
  },
  section: {
    width: '100%',
    gap: spacing.small,
  },
  sectionTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  drawerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawingBodyNarrow: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    gap: spacing.small,
  },
  drawingBodyWide: {
    width: '100%',
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: spacing.small,
    alignItems: 'stretch',
  },
  canvasNarrow: {
    width: '100%',
    maxHeight: '55%',
  },
  canvasWide: {
    flex: 1,
    minWidth: 0,
  },
  sidePanelNarrow: {
    width: '100%',
    gap: spacing.small,
  },
  sidePanelWide: {
    width: 320,
    flexShrink: 0,
    gap: spacing.small,
  },
  guessPanelContainer: {
    width: '100%',
    minHeight: 200,
    flex: 1,
  },
  answerBanner: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
    gap: spacing.tight,
  },
  answerLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  answerWord: {
    ...textStyles.headingBold,
    color: colors.primary,
  },
  artwork: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  botStrip: {
    width: '100%',
    gap: spacing.tight,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  botStripTitle: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: fixed.minTouchTarget,
  },
  botName: {
    ...textStyles.secondary,
    color: colors.text,
  },
});
