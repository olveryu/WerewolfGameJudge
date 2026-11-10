/** Shared Pictionary task layout pieces: heading, 4:3 media fit, and the game's drawing canvas. */

import type {
  PictionaryPublicCommand,
  PictionaryState,
  PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import type { ReactNode } from 'react';

import {
  DrawingCanvas,
  type DrawingCanvasGameProps,
} from '@/features/drawing/components/DrawingCanvas';
import type { ReadyRoomSession } from '@/features/room/controllers/useReadyRoomSession';
import { pictionaryDrawingPainter } from '@/games/pictionary/services/renderPictionaryDrawing';
import { TESTIDS } from '@/testids';

import type { PictionaryTaskInput } from '../hooks/usePictionaryAutoSubmission';

/** Phone-sized stage column shared by every Pictionary task and waiting surface. */
export const PICTIONARY_STAGE_MAX_WIDTH = 430;

/** Props shared by the text and drawing task views. */
export interface PictionaryTaskViewProps {
  readonly inputs: Map<number, PictionaryTaskInput>;
  readonly state: PictionaryState;
  readonly task: PictionaryTask;
  readonly effectiveSeat: number;
  readonly submit: ReadyRoomSession<PictionaryState, PictionaryPublicCommand>['submit'];
  readonly isSubmitting: boolean;
  readonly controlledSeat: number | null;
  readonly isExpired: boolean;
}

/** Task heading; the room information bar owns the relay step and the countdown. */
export function PictionaryTaskHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="pictionary-heading">
      <h2 className="pictionary-title" data-testid={TESTIDS.pictionaryTaskTitle}>
        {title}
      </h2>
      <p className="pictionary-description" data-testid={TESTIDS.pictionaryTaskDescription}>
        {description}
      </p>
    </div>
  );
}

/** Centers a 4:3 child inside the remaining task area without cropping. */
export function PictionaryTaskMedia({ children }: { readonly children: ReactNode }) {
  return (
    <div className="pictionary-task-media">
      <div className="pictionary-task-media-fit">{children}</div>
    </div>
  );
}

/** The shared drawing canvas bound to Pictionary's painter, test id and label. */
export function PictionaryDrawingCanvas(props: DrawingCanvasGameProps) {
  return (
    <DrawingCanvas
      {...props}
      painter={pictionaryDrawingPainter}
      testId={TESTIDS.pictionaryDrawingCanvas}
      ariaLabel="绘画画布"
    />
  );
}
