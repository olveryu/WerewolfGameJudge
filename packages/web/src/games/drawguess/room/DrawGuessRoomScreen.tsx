/** DrawGuess room hosted by the shared entry boundary and room shell. */

import './components/DrawGuessStage.css';

import {
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessState,
  type DrawGuessViewModel,
} from '@game-judge/game-engine/games/drawguess/public';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { DrawingCanvas } from '@/features/drawing/components/DrawingCanvas';
import { DrawingToolbar } from '@/features/drawing/components/DrawingToolbar';
import {
  DRAWING_PALETTE,
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingTool,
  type DrawingWidth,
  isDrawingColor,
} from '@/features/drawing/model/drawing';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSummary, RoomGuideButton } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import { StageSettleRescue } from '@/features/room/components/StageSettleRescue';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { isSuccessfulRoomCommand } from '@/features/room/link/roomCommandResult';
import { buildEndedWaitingMessage } from '@/features/room/model/RoomBottomActions';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import { DrawGuessStatsPanel } from '@/games/drawguess/components/DrawGuessStatsPanel';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { drawGuessMediaTransport } from '@/games/drawguess/services/drawGuessMediaTransport';
import {
  drawGuessDrawingPainter,
  renderDrawGuessDrawing,
} from '@/games/drawguess/services/renderDrawGuessDrawing';
import { TESTIDS } from '@/testids';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { DrawGuessCorrectToast } from './components/DrawGuessCorrectToast';
import { DrawGuessDrawerZeroedNote } from './components/DrawGuessDrawerZeroedNote';
import { DrawGuessGuessComposer } from './components/DrawGuessGuessComposer';
import { DrawGuessGuessLog } from './components/DrawGuessGuessLog';
import { DrawGuessGuessPeek } from './components/DrawGuessGuessPeek';
import { DrawGuessReactionPicker } from './components/DrawGuessReactionPicker';
import { DrawGuessScoreboard, type DrawGuessScoreboardRow } from './components/DrawGuessScoreboard';
import { getDrawGuessRoomCommandFailureMessage } from './drawGuessRoomCommandFailureMessage';
import {
  type DrawGuessRoomScreenState,
  useDrawGuessRoomState,
} from './hooks/useDrawGuessRoomState';
import { drawGuessStrokeToElement, useDrawGuessStrokeSync } from './hooks/useDrawGuessStrokeSync';

type DrawGuessPhase = DrawGuessState['phase'];
type DrawGuessWordSelectPhase = Extract<DrawGuessPhase, { readonly kind: 'wordSelect' }>;
type DrawGuessDrawingPhase = Extract<DrawGuessPhase, { readonly kind: 'drawing' }>;
type DrawGuessRoundEndPhase = Extract<DrawGuessPhase, { readonly kind: 'roundEnd' }>;

/** Phone-sized column for the scrolling stages and the narrow drawing layout. */
const DRAWGUESS_STAGE_MAX_WIDTH = 430;
/** Canvas with the guess log aside from this viewport width up; below it a peek strip. */
const DRAWGUESS_WIDE_LAYOUT_BREAKPOINT = 768;
const DRAWGUESS_WIDE_STAGE_MAX_WIDTH = 960;
const PNG_UPLOAD_MAX_ATTEMPTS = 3;
const PNG_UPLOAD_RETRY_MS = 5000;

interface DrawGuessRoomScreenProps extends GameRoomScreenProps<'drawguess'> {
  readonly session: DrawGuessRoomSession;
  readonly review: RoomReviewContribution<DrawGuessState>;
}

/** Uses the platform entry lifecycle for direct links, joins and reconnects. */
export function DrawGuessRoomScreen(props: DrawGuessRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <DrawGuessRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

interface DrawGuessRoomContentProps extends DrawGuessRoomScreenProps {
  readonly entryController: RoomEntryController;
}

function DrawGuessRoomContent({ entryController, ...props }: DrawGuessRoomContentProps) {
  const screen = useDrawGuessRoomState({ ...props, entryController });
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  const stage = (
    <DrawGuessStage key={`${screen.state.turnIndex}:${screen.state.phase.kind}`} screen={screen} />
  );
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
                  title={`你画我猜 · ${config.numberOfPlayers}人局`}
                  subtitle={`每人 ${DRAWGUESS_ROUNDS_PER_DRAWER} 轮 · 选词 ${DRAWGUESS_WORD_SELECT_SECONDS} 秒 · 作画 ${DRAWGUESS_DRAWING_DURATION_SECONDS} 秒 · 结算 ${DRAWGUESS_ROUND_END_SECONDS} 秒`}
                  headerRight={
                    <RoomGuideButton
                      onPress={screen.openRules}
                      label="查看你画我猜玩法"
                      testId={TESTIDS.roomGuideButton('drawguess')}
                    />
                  }
                />
              ),
            }
          : screen.stageHud !== null
            ? { kind: 'stage', hud: screen.stageHud, element: stage }
            : { kind: 'workspace', element: stage }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <DrawGuessStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={screen.reviewOverlay}
    />
  );
}

/** Picks the view for the authoritative phase; the hook already assembled the view model. */
function DrawGuessStage({ screen }: { readonly screen: DrawGuessRoomScreenState }) {
  const phase = screen.state.phase;
  let view: ReactNode;
  switch (phase.kind) {
    case 'wordSelect':
      view = <DrawGuessWordSelectView screen={screen} phase={phase} />;
      break;
    case 'drawing':
      view = <DrawGuessDrawingView screen={screen} phase={phase} />;
      break;
    case 'roundEnd':
      view = <DrawGuessRoundEndView screen={screen} phase={phase} />;
      break;
    case 'ended':
      view = <DrawGuessEndedView screen={screen} />;
      break;
    case 'lobby':
      throw new Error('[FAIL-FAST] DrawGuess stage received the lobby phase');
  }
  return <div className="drawguess-stage">{view}</div>;
}

/** Host rescue: re-run this phase's settle; overdue detection lives in the shared hook. */
function retryDrawGuessSettle(screen: DrawGuessRoomScreenState): void {
  void screen.submit('重新推进', { type: 'drawguess.phase.retrySettle' });
}

/** Overdue notice and host retry; turn and countdown live in the room information bar. */
function DrawGuessSettleRescue({ screen }: { readonly screen: DrawGuessRoomScreenState }) {
  return (
    <StageSettleRescue
      remainingSeconds={screen.remainingSeconds}
      isOverdue={screen.isOverdue}
      isHost={screen.isHost}
      isRetrying={screen.isSubmitting}
      onRetry={() => retryDrawGuessSettle(screen)}
      waitingLabel="等待推进…"
    />
  );
}

/** Scrolling phone-width column used by word select, round end and the final ranking. */
function DrawGuessStageColumn({
  header,
  children,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="drawguess-stage-scroll">
      <div className="drawguess-stage-column">
        {header}
        {children}
      </div>
    </div>
  );
}

function findDisplayName(viewModel: DrawGuessViewModel, seat: number | null): string | null {
  return viewModel.seats.find((view) => view.seat === seat)?.displayName ?? null;
}

// ─── Word select ────────────────────────────────────────────────────────────

function DrawGuessWordSelectView({
  screen,
  phase,
}: {
  readonly screen: DrawGuessRoomScreenState;
  readonly phase: DrawGuessWordSelectPhase;
}) {
  const { state, viewModel, effectiveSeat, controlledSeat, submit } = screen;
  const isDrawer = viewModel.drawerSeat !== null && effectiveSeat === viewModel.drawerSeat;
  const drawerName = findDisplayName(viewModel, viewModel.drawerSeat) ?? '画手';
  // Choosing is the drawer's seat action: a host driving a bot drawer sends it with that seat.
  const choose = (word: string): void => {
    void submit(
      '选择题目',
      {
        type: 'drawguess.word.choose',
        word,
        phaseRevision: state.phaseRevision,
        turnIndex: state.turnIndex,
      },
      { controlledSeat },
    );
  };
  return (
    <DrawGuessStageColumn header={<DrawGuessSettleRescue screen={screen} />}>
      {isDrawer ? (
        <section className="drawguess-section">
          <h3 className="drawguess-section-title" data-testid={TESTIDS.drawGuessWordSelectTitle}>
            请选择本轮题目（{phase.choices.length} 选 1）
          </h3>
          {viewModel.choices.length === 0 ? (
            <p className="drawguess-hint">题目准备中，请稍候…</p>
          ) : (
            viewModel.choices.map((word, index) => (
              <Button
                key={word}
                variant="secondary"
                size="lg"
                data-testid={TESTIDS.drawGuessWordChoice(index)}
                onClick={() => choose(word)}
              >
                {word}
              </Button>
            ))
          )}
          <p className="drawguess-hint">作画不许写字、写数字。</p>
        </section>
      ) : (
        <section className="drawguess-section">
          <h3 className="drawguess-section-title" data-testid={TESTIDS.drawGuessWordSelectTitle}>
            {drawerName} 正在选词…
          </h3>
          <p className="drawguess-hint">选词结束后开始作画，请准备猜词。</p>
        </section>
      )}
    </DrawGuessStageColumn>
  );
}

// ─── Drawing ────────────────────────────────────────────────────────────────

function DrawGuessDrawingView({
  screen,
  phase,
}: {
  readonly screen: DrawGuessRoomScreenState;
  readonly phase: DrawGuessDrawingPhase;
}) {
  const { state, viewModel, session, effectiveSeat, controlledSeat, remainingSeconds } = screen;
  const isWideLayout = useViewportWidth() >= DRAWGUESS_WIDE_LAYOUT_BREAKPOINT;
  const asideTitleId = useId();
  const isDrawer = effectiveSeat === phase.drawerSeat;
  const [tool, setTool] = useState<DrawingTool>('brush');
  const [color, setColor] = useState<DrawingColor>(DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<DrawingWidth>(DRAWING_WIDTHS[1]);
  // The draft survives a failed submit; it clears only once the server accepts the guess.
  const [draft, setDraft] = useState('');
  const hasTimeLeft = remainingSeconds !== null && remainingSeconds > 0;
  const canDraw = isDrawer && hasTimeLeft;
  const canGuess = !isDrawer && effectiveSeat !== null && hasTimeLeft;
  const isLocked = viewModel.seats.find((seat) => seat.seat === effectiveSeat)?.isLocked ?? false;
  const sync = useDrawGuessStrokeSync({
    session,
    authoritativeStrokes: phase.strokes,
    phaseRevision: state.phaseRevision,
    turnIndex: state.turnIndex,
    effectiveSeat,
    controlledSeat,
    canDraw,
  });

  const submitGuess = async (text: string): Promise<boolean> => {
    try {
      const result = await session.dispatch(
        {
          type: 'drawguess.guess.submit',
          text,
          phaseRevision: state.phaseRevision,
          turnIndex: state.turnIndex,
        },
        { controlledSeat, label: '提交猜词', durable: false },
      );
      if (isSuccessfulRoomCommand(result)) return true;
      if (result.kind === 'undelivered' && result.cause === 'throttled') {
        showErrorAlert('猜得太快了', '猜得太快了，稍后再试');
      } else {
        showErrorAlert('提交猜词失败', getDrawGuessRoomCommandFailureMessage(result));
      }
      return false;
    } catch (error: unknown) {
      handleError(error, {
        label: '提交猜词',
        logger: roomScreenLog,
        alertMessage: '提交猜词失败，请重试',
      });
      return false;
    }
  };

  return (
    <RoomTaskFrame
      className="drawguess-task-frame"
      maxWidth={isWideLayout ? DRAWGUESS_WIDE_STAGE_MAX_WIDTH : DRAWGUESS_STAGE_MAX_WIDTH}
      header={<DrawGuessSettleRescue screen={screen} />}
      footer={
        <div className="drawguess-task-footer">
          <DrawGuessReactionPicker
            drawerSeat={phase.drawerSeat}
            reactionsBySeat={viewModel.reactionsBySeat}
            seats={viewModel.seats}
            effectiveSeat={effectiveSeat}
            controlledSeat={controlledSeat}
            isSubmitting={screen.isSubmitting}
            phaseRevision={state.phaseRevision}
            turnIndex={state.turnIndex}
            submit={screen.submit}
          />
          {isDrawer ? (
            <DrawingToolbar
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              canUndo={sync.elements.length > 0}
              canRedo={sync.canRedo}
              disabled={!canDraw}
              palette={DRAWING_PALETTE}
              widths={DRAWING_WIDTHS}
              onToolChange={setTool}
              onColorChange={(nextColor) => {
                if (isDrawingColor(nextColor)) setColor(nextColor);
              }}
              onWidthChange={(nextWidth) => {
                const width = DRAWING_WIDTHS.find((candidate) => candidate === nextWidth);
                if (width !== undefined) setStrokeWidth(width);
              }}
              onUndo={sync.undo}
              onRedo={sync.redo}
              onClear={() =>
                showDestructiveAlert('清空画布？', '所有绘画内容都会被删除。', '清空', sync.clear)
              }
            />
          ) : (
            <DrawGuessGuessComposer
              draft={draft}
              onDraftChange={setDraft}
              isLocked={isLocked}
              canGuess={canGuess}
              onSubmitGuess={submitGuess}
            />
          )}
        </div>
      }
    >
      <div className="drawguess-drawing-body" data-layout={isWideLayout ? 'wide' : 'narrow'}>
        <div className="drawguess-canvas-media">
          <div className="drawguess-canvas-fit">
            <DrawingCanvas
              elements={sync.elements}
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              isEnabled={canDraw}
              // The canvas draws the in-progress element on its own overlay layer.
              onElementChange={() => undefined}
              onElementComplete={sync.onElementComplete}
              onFill={(point) => sync.onFill(point, color)}
              painter={drawGuessDrawingPainter}
              testId={TESTIDS.drawGuessDrawingCanvas}
              ariaLabel="绘画画布"
            />
            <DrawGuessCorrectToast messages={viewModel.messages} viewerSeat={effectiveSeat} />
          </div>
        </div>
        {isWideLayout ? (
          <aside className="drawguess-guess-aside" aria-labelledby={asideTitleId}>
            <h3 id={asideTitleId} className="drawguess-guess-aside-title">
              猜词记录
            </h3>
            <DrawGuessGuessLog messages={viewModel.messages} viewerSeat={effectiveSeat} />
          </aside>
        ) : (
          <DrawGuessGuessPeek messages={viewModel.messages} viewerSeat={effectiveSeat} />
        )}
      </div>
    </RoomTaskFrame>
  );
}

// ─── Round end ──────────────────────────────────────────────────────────────

/** Drawer side: reserve a one-time upload slot, then upload the final strokes as a PNG. */
function useDrawGuessFinalDrawingUpload(
  screen: DrawGuessRoomScreenState,
  phase: DrawGuessRoundEndPhase,
): void {
  const { session, effectiveSeat, controlledSeat, roomCode } = screen;
  const isDrawer = effectiveSeat === phase.drawerSeat;
  const hasReservation = phase.reservation !== null;
  const reserveInFlight = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const uploadSucceeded = useRef(false);
  const uploadAttempts = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadRetryTick, setUploadRetryTick] = useState(0);

  useEffect(
    () => () => {
      uploadController.current?.abort();
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!isDrawer || hasReservation || reserveInFlight.current) return;
    reserveInFlight.current = true;
    void (async () => {
      try {
        const result = await session.dispatch(
          { type: 'drawguess.drawing.reserve' },
          { controlledSeat, label: '预留画作上传', durable: false },
        );
        if (isSuccessfulRoomCommand(result)) return;
        reserveInFlight.current = false;
        showErrorAlert('画作上传预留失败', getDrawGuessRoomCommandFailureMessage(result));
      } catch (error: unknown) {
        reserveInFlight.current = false;
        handleError(error, {
          label: '预留画作上传',
          logger: roomScreenLog,
          alertMessage: '画作上传预留失败，请重试',
        });
      }
    })();
  }, [isDrawer, hasReservation, session, controlledSeat]);

  useEffect(() => {
    const reservation = phase.reservation;
    if (
      !isDrawer ||
      reservation === null ||
      phase.pngEntry !== null ||
      phase.strokes.length === 0 ||
      uploadSucceeded.current ||
      uploadController.current !== null ||
      uploadAttempts.current >= PNG_UPLOAD_MAX_ATTEMPTS
    )
      return;
    const controller = new AbortController();
    uploadController.current = controller;
    uploadAttempts.current += 1;
    const strokes = phase.strokes;
    void (async () => {
      try {
        const png = await renderDrawGuessDrawing(strokes.map(drawGuessStrokeToElement));
        const result = await drawGuessMediaTransport.uploadDrawing(
          roomCode,
          reservation.submissionId,
          png,
          controlledSeat,
          controller.signal,
        );
        if (result.kind !== 'committed' || result.outcome.kind !== 'success') {
          throw new Error('Server rejected the final DrawGuess drawing');
        }
        uploadSucceeded.current = true;
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        roomScreenLog.warn('round-end PNG upload failed', { attempt: uploadAttempts.current });
        handleError(error, {
          label: '上传终稿画作',
          logger: roomScreenLog,
          alertMessage: '画作上传失败，稍后自动重试',
        });
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          setUploadRetryTick((tick) => tick + 1);
        }, PNG_UPLOAD_RETRY_MS);
      } finally {
        if (uploadController.current === controller) uploadController.current = null;
      }
    })();
  }, [
    isDrawer,
    phase.reservation,
    phase.pngEntry,
    phase.strokes,
    controlledSeat,
    roomCode,
    uploadRetryTick,
  ]);
}

/** Final artwork: the stored PNG when available, else a local render of the authoritative strokes. */
function useDrawGuessFinalDrawingUri(
  screen: DrawGuessRoomScreenState,
  phase: DrawGuessRoundEndPhase,
): string | null {
  const { roomCode, controlledSeat } = screen;
  const entryId = phase.pngEntry !== null ? (phase.reservation?.entryId ?? null) : null;
  const [loaded, setLoaded] = useState<{ readonly entryId: string; readonly uri: string } | null>(
    null,
  );

  useEffect(() => {
    if (entryId === null) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const uri = await drawGuessMediaTransport.readDrawingDataUri(
          roomCode,
          entryId,
          controlledSeat,
          controller.signal,
        );
        if (!controller.signal.aborted) setLoaded({ entryId, uri });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        roomScreenLog.warn('round-end PNG read failed, falling back to strokes', { entryId });
        handleError(error, { label: '读取终稿画作', logger: roomScreenLog });
      }
    })();
    return () => controller.abort();
  }, [entryId, roomCode, controlledSeat]);

  return loaded !== null && loaded.entryId === entryId ? loaded.uri : null;
}

function buildScoreboardRows(
  screen: DrawGuessRoomScreenState,
  readScores: (seat: number) => { readonly roundScore: number | null; readonly totalScore: number },
): DrawGuessScoreboardRow[] {
  return screen.viewModel.seats.map((seat) => ({
    seat: seat.seat,
    displayName: seat.displayName,
    isBot: seat.isBot,
    isDrawer: seat.isDrawer,
    isSelf: seat.seat === screen.effectiveSeat,
    ...readScores(seat.seat),
  }));
}

function DrawGuessRoundEndView({
  screen,
  phase,
}: {
  readonly screen: DrawGuessRoomScreenState;
  readonly phase: DrawGuessRoundEndPhase;
}) {
  const { state, viewModel, effectiveSeat, controlledSeat } = screen;
  useDrawGuessFinalDrawingUpload(screen, phase);
  const pngUri = useDrawGuessFinalDrawingUri(screen, phase);
  const roundRows = buildScoreboardRows(screen, (seat) => ({
    roundScore: viewModel.roundScores?.[seat] ?? 0,
    totalScore: viewModel.scores[seat] ?? 0,
  }));
  return (
    <DrawGuessStageColumn header={<DrawGuessSettleRescue screen={screen} />}>
      <div className="drawguess-answer-banner" role="group" aria-label={`本轮答案：${phase.word}`}>
        <span className="drawguess-answer-label">本轮答案</span>
        <span className="drawguess-answer-word">{phase.word}</span>
      </div>
      {pngUri !== null ? (
        <img className="drawguess-artwork" src={pngUri} alt="本轮画作终稿" />
      ) : (
        <DrawingCanvas
          elements={phase.strokes.map(drawGuessStrokeToElement)}
          tool="brush"
          color={DRAWING_PALETTE[0].value}
          strokeWidth={DRAWING_WIDTHS[1]}
          isEnabled={false}
          onElementChange={() => undefined}
          onElementComplete={() => undefined}
          onFill={() => undefined}
          painter={drawGuessDrawingPainter}
          testId={TESTIDS.drawGuessDrawingCanvas}
          ariaLabel="本轮画作终稿"
        />
      )}
      <DrawGuessDrawerZeroedNote visible={viewModel.drawerZeroed} />
      <DrawGuessScoreboard title="本轮得分" competitionRanking rows={roundRows} />
      <DrawGuessReactionPicker
        drawerSeat={phase.drawerSeat}
        reactionsBySeat={viewModel.reactionsBySeat}
        seats={viewModel.seats}
        effectiveSeat={effectiveSeat}
        controlledSeat={controlledSeat}
        isSubmitting={screen.isSubmitting}
        phaseRevision={state.phaseRevision}
        turnIndex={state.turnIndex}
        submit={screen.submit}
      />
    </DrawGuessStageColumn>
  );
}

// ─── Ended ──────────────────────────────────────────────────────────────────

function DrawGuessEndedView({ screen }: { readonly screen: DrawGuessRoomScreenState }) {
  const { viewModel, userId, isHost, mySeat } = screen;
  const totalRows = buildScoreboardRows(screen, (seat) => ({
    roundScore: null,
    totalScore: viewModel.totalScores[seat] ?? 0,
  }));
  const waitingMessage = buildEndedWaitingMessage({
    isEnded: true,
    viewer: { userId, isHost, seat: mySeat },
  });
  return (
    <DrawGuessStageColumn header={<h2 className="drawguess-turn-label">本局结束</h2>}>
      <DrawGuessScoreboard title="最终排名" competitionRanking rows={totalRows} />
      {waitingMessage !== null && <p className="drawguess-hint">{waitingMessage}</p>}
    </DrawGuessStageColumn>
  );
}
