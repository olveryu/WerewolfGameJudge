/**
 * Shared drawing model for pictionary/drawguess (and future drawing games).
 *
 * Extracted from duplicated pictionary/drawguess implementations (2026-10-08).
 * Games must not copy this file; import from here instead.
 */

export { PICTIONARY_DRAWING_PALETTE as DRAWING_PALETTE } from '@/theme/colors';

export const DRAWING_WIDTHS = [5, 14, 30] as const;

export type DrawingColor = `#${string}`;

/** Validate opaque six-digit hex colors at picker and storage boundaries. */
export function isDrawingColor(value: unknown): value is DrawingColor {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export type DrawingWidth = (typeof DRAWING_WIDTHS)[number];
export type DrawingTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'fill';

export interface DrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawingFreehandElement {
  readonly id: string;
  readonly kind: 'brush' | 'eraser';
  readonly color: DrawingColor;
  readonly width: DrawingWidth;
  readonly points: readonly DrawingPoint[];
}

export interface DrawingShapeElement {
  readonly id: string;
  readonly kind: 'line' | 'rectangle' | 'ellipse';
  readonly color: DrawingColor;
  readonly width: DrawingWidth;
  readonly start: DrawingPoint;
  readonly end: DrawingPoint;
}

export interface DrawingFillRectangle {
  /** Integer coordinates in the canonical 1024x768 export canvas. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DrawingFillElement {
  readonly id: string;
  readonly kind: 'fill';
  readonly color: DrawingColor;
  /** 笔宽（填充渲染不用，服务端笔画模型要求携带）。 */
  readonly width: DrawingWidth;
  readonly rectangles: readonly DrawingFillRectangle[];
}

/**
 * 填充元素的占位笔宽。
 *
 * 填充渲染不使用 width，服务端笔画模型要求携带。此常量明确该值无实际意义，
 * 两游戏统一使用，避免误以为与画笔宽度有关。
 */
export const FILL_STROKE_WIDTH: DrawingWidth = 5;

export type DrawingElement = DrawingFreehandElement | DrawingShapeElement | DrawingFillElement;

export interface DrawingDraft {
  readonly elements: readonly DrawingElement[];
  readonly redoElements: readonly DrawingElement[];
}

export type DrawingDraftAction =
  | { readonly type: 'element.add'; readonly element: DrawingElement }
  | { readonly type: 'element.undo' }
  | { readonly type: 'element.redo' }
  | { readonly type: 'drawing.clear' };

export const EMPTY_DRAWING_DRAFT: DrawingDraft = {
  elements: [],
  redoElements: [],
};

export function reduceDrawingDraft(draft: DrawingDraft, action: DrawingDraftAction): DrawingDraft {
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
      return EMPTY_DRAWING_DRAFT;
  }
  const exhaustive: never = action;
  return exhaustive;
}
