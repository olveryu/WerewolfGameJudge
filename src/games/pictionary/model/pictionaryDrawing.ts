/** Pure local drawing model for Pictionary elements, tools, and undo history. */

import { PICTIONARY_DRAWING_PALETTE } from '@/theme/colors';

export { PICTIONARY_DRAWING_PALETTE };

export const PICTIONARY_DRAWING_WIDTHS = [5, 14, 30] as const;

export type PictionaryDrawingColor = (typeof PICTIONARY_DRAWING_PALETTE)[number]['value'];
export type PictionaryDrawingWidth = (typeof PICTIONARY_DRAWING_WIDTHS)[number];
export type PictionaryDrawingTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'fill';

export interface PictionaryDrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface PictionaryDrawingFreehandElement {
  readonly id: string;
  readonly kind: 'brush' | 'eraser';
  readonly color: PictionaryDrawingColor;
  readonly width: PictionaryDrawingWidth;
  readonly points: readonly PictionaryDrawingPoint[];
}

export interface PictionaryDrawingShapeElement {
  readonly id: string;
  readonly kind: 'line' | 'rectangle' | 'ellipse';
  readonly color: PictionaryDrawingColor;
  readonly width: PictionaryDrawingWidth;
  readonly start: PictionaryDrawingPoint;
  readonly end: PictionaryDrawingPoint;
}

export interface PictionaryDrawingFillRectangle {
  /** Integer coordinates in the canonical 1024x768 export canvas. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PictionaryDrawingFillElement {
  readonly id: string;
  readonly kind: 'fill';
  readonly color: PictionaryDrawingColor;
  readonly rectangles: readonly PictionaryDrawingFillRectangle[];
}

export type PictionaryDrawingElement =
  | PictionaryDrawingFreehandElement
  | PictionaryDrawingShapeElement
  | PictionaryDrawingFillElement;

export interface PictionaryDrawingDraft {
  readonly elements: readonly PictionaryDrawingElement[];
  readonly redoElements: readonly PictionaryDrawingElement[];
}

export type PictionaryDrawingDraftAction =
  | { readonly type: 'element.add'; readonly element: PictionaryDrawingElement }
  | { readonly type: 'element.undo' }
  | { readonly type: 'element.redo' }
  | { readonly type: 'drawing.clear' };

export const EMPTY_PICTIONARY_DRAWING_DRAFT: PictionaryDrawingDraft = {
  elements: [],
  redoElements: [],
};

export function reducePictionaryDrawingDraft(
  draft: PictionaryDrawingDraft,
  action: PictionaryDrawingDraftAction,
): PictionaryDrawingDraft {
  switch (action.type) {
    case 'element.add':
      return {
        elements: [
          ...draft.elements.filter((element) => element.id !== action.element.id),
          action.element,
        ],
        redoElements: [],
      };
    case 'element.undo': {
      const element = draft.elements.at(-1);
      return element === undefined
        ? draft
        : {
            elements: draft.elements.slice(0, -1),
            redoElements: [...draft.redoElements, element],
          };
    }
    case 'element.redo': {
      const element = draft.redoElements.at(-1);
      return element === undefined
        ? draft
        : {
            elements: [...draft.elements, element],
            redoElements: draft.redoElements.slice(0, -1),
          };
    }
    case 'drawing.clear':
      return EMPTY_PICTIONARY_DRAWING_DRAFT;
  }
  const exhaustive: never = action;
  return exhaustive;
}
