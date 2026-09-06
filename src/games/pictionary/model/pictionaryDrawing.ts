/** Pure local drawing model for Pictionary strokes, tools, and undo history. */

import type { PICTIONARY_DRAWING_PALETTE } from '@/theme';

export { PICTIONARY_DRAWING_PALETTE } from '@/theme';

export const PICTIONARY_DRAWING_WIDTHS = [5, 14, 30] as const;

export type PictionaryDrawingColor = (typeof PICTIONARY_DRAWING_PALETTE)[number]['value'];
export type PictionaryDrawingWidth = (typeof PICTIONARY_DRAWING_WIDTHS)[number];
export type PictionaryDrawingTool = 'brush' | 'eraser';

export interface PictionaryDrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface PictionaryDrawingStroke {
  readonly id: string;
  readonly tool: PictionaryDrawingTool;
  readonly color: PictionaryDrawingColor;
  readonly width: PictionaryDrawingWidth;
  readonly points: readonly PictionaryDrawingPoint[];
}

export interface PictionaryDrawingDraft {
  readonly strokes: readonly PictionaryDrawingStroke[];
  readonly redoStrokes: readonly PictionaryDrawingStroke[];
}

export type PictionaryDrawingDraftAction =
  | { readonly type: 'stroke.add'; readonly stroke: PictionaryDrawingStroke }
  | { readonly type: 'stroke.undo' }
  | { readonly type: 'stroke.redo' }
  | { readonly type: 'drawing.clear' };

export const EMPTY_PICTIONARY_DRAWING_DRAFT: PictionaryDrawingDraft = {
  strokes: [],
  redoStrokes: [],
};

export function reducePictionaryDrawingDraft(
  draft: PictionaryDrawingDraft,
  action: PictionaryDrawingDraftAction,
): PictionaryDrawingDraft {
  switch (action.type) {
    case 'stroke.add':
      return { strokes: [...draft.strokes, action.stroke], redoStrokes: [] };
    case 'stroke.undo': {
      const stroke = draft.strokes.at(-1);
      return stroke === undefined
        ? draft
        : {
            strokes: draft.strokes.slice(0, -1),
            redoStrokes: [...draft.redoStrokes, stroke],
          };
    }
    case 'stroke.redo': {
      const stroke = draft.redoStrokes.at(-1);
      return stroke === undefined
        ? draft
        : {
            strokes: [...draft.strokes, stroke],
            redoStrokes: draft.redoStrokes.slice(0, -1),
          };
    }
    case 'drawing.clear':
      return EMPTY_PICTIONARY_DRAWING_DRAFT;
  }
  const exhaustive: never = action;
  return exhaustive;
}
