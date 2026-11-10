/** Pictionary drawing task: draw the previous prompt on the shared canvas with the toolbar. */

import { createPictionaryCommand } from '@game-judge/game-engine/games/pictionary/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { DrawingToolbar } from '@/features/drawing/components/DrawingToolbar';
import {
  DRAWING_PALETTE,
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingDraftAction,
  type DrawingElement,
  type DrawingPoint,
  type DrawingTool,
  type DrawingWidth,
  EMPTY_DRAWING_DRAFT,
  isDrawingColor,
  reduceDrawingDraft,
} from '@/features/drawing/model/drawing';
import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import { createPictionaryFillElement } from '@/games/pictionary/services/renderPictionaryDrawing';
import { TESTIDS } from '@/testids';
import { showDestructiveAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import {
  PICTIONARY_STAGE_MAX_WIDTH,
  PictionaryDrawingCanvas,
  PictionaryTaskMedia,
  type PictionaryTaskViewProps,
} from './PictionaryTaskLayout';

/** Draws the previous text (or a free drawing after a missed step), with a ready toggle. */
export function PictionaryDrawingTask({
  inputs,
  state,
  task,
  effectiveSeat,
  submit,
  isSubmitting,
  controlledSeat,
  isExpired,
}: PictionaryTaskViewProps) {
  const [draft, setDraft] = useState(() => {
    const input = inputs.get(effectiveSeat);
    if (typeof input === 'string') throw new Error('[FAIL-FAST] Expected Pictionary drawing input');
    return input ?? EMPTY_DRAWING_DRAFT;
  });
  const [tool, setTool] = useState<DrawingTool>('brush');
  const [color, setColor] = useState<DrawingColor>(DRAWING_PALETTE[0].value);
  const [strokeWidth, setStrokeWidth] = useState<DrawingWidth>(14);

  const updateDraft = (action: DrawingDraftAction): void => {
    const next = reduceDrawingDraft(draft, action);
    inputs.set(effectiveSeat, next);
    setDraft(next);
  };

  // Keeps an in-progress stroke collectable if the step settles mid-gesture.
  const persistElement = (element: DrawingElement): void => {
    inputs.set(effectiveSeat, reduceDrawingDraft(draft, { type: 'element.add', element }));
  };

  const addElement = (element: DrawingElement): void => {
    updateDraft({ type: 'element.add', element });
  };

  const fillDrawing = (point: DrawingPoint): void => {
    try {
      const element = createPictionaryFillElement(draft.elements, point, color);
      if (element !== null) addElement(element);
    } catch (error: unknown) {
      handleError(error, {
        label: '填充画布',
        logger: roomScreenLog,
        alertMessage: '无法填充这个区域，请稍后重试。',
      });
    }
  };

  const clearDrawing = (): void => {
    showDestructiveAlert('清空画布？', '所有绘画内容都会被删除。', '清空', () =>
      updateDraft({ type: 'drawing.clear' }),
    );
  };

  const isReady = state.readySeats.includes(effectiveSeat);
  const toggleReady = (): void => {
    if (!isReady && draft.elements.length === 0) return;
    void submit(
      isReady ? '继续编辑' : '完成编辑',
      createPictionaryCommand(
        state,
        { type: 'pictionary.task.ready.set', isReady: !isReady },
        effectiveSeat,
      ),
      { controlledSeat, durable: true },
    );
  };

  const previousEntry = task.previousEntry;
  if (previousEntry === null || previousEntry.kind === 'drawing') {
    throw new Error('[FAIL-FAST] Pictionary drawing task requires a text or missed context');
  }
  const canEdit = !isReady && !isSubmitting && !isExpired;
  const canComplete = draft.elements.length > 0 && !isSubmitting && !isExpired;

  return (
    <RoomTaskFrame
      header={null}
      maxWidth={PICTIONARY_STAGE_MAX_WIDTH}
      testId={TESTIDS.pictionaryStageFrame}
      className="pictionary-task-frame"
      footer={
        <>
          <DrawingToolbar
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            canUndo={draft.elements.length > 0}
            canRedo={draft.redoElements.length > 0}
            disabled={!canEdit}
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
            onUndo={() => updateDraft({ type: 'element.undo' })}
            onRedo={() => updateDraft({ type: 'element.redo' })}
            onClear={clearDrawing}
          />
          <Button
            variant={isReady ? 'secondary' : 'primary'}
            onClick={toggleReady}
            disabled={isReady ? isExpired || isSubmitting : !canComplete}
            loading={isSubmitting}
            data-testid={TESTIDS.pictionaryDrawingSubmitButton}
          >
            {isReady ? '继续编辑' : '完成编辑'}
          </Button>
        </>
      }
    >
      <p className="pictionary-prompt-card">
        <span>{previousEntry.kind === 'text' ? '把这句话画出来' : '上一棒未完成'}</span>
        <strong>{previousEntry.kind === 'text' ? previousEntry.text : '请自由发挥'}</strong>
      </p>
      <PictionaryTaskMedia>
        <PictionaryDrawingCanvas
          elements={draft.elements}
          tool={tool}
          color={color}
          strokeWidth={strokeWidth}
          isEnabled={canEdit}
          onElementChange={persistElement}
          onElementComplete={addElement}
          onFill={fillDrawing}
        />
      </PictionaryTaskMedia>
    </RoomTaskFrame>
  );
}
