/**
 * Pictionary drawing model — re-exports shared drawing model.
 *
 * @deprecated Import from '@/features/drawing/model/drawing' instead.
 * This file is kept for backward compatibility during migration.
 */

export type {
  DrawingColor as PictionaryDrawingColor,
  DrawingDraft as PictionaryDrawingDraft,
  DrawingDraftAction as PictionaryDrawingDraftAction,
  DrawingElement as PictionaryDrawingElement,
  DrawingFillElement as PictionaryDrawingFillElement,
  DrawingFillRectangle as PictionaryDrawingFillRectangle,
  DrawingFreehandElement as PictionaryDrawingFreehandElement,
  DrawingPoint as PictionaryDrawingPoint,
  DrawingShapeElement as PictionaryDrawingShapeElement,
  DrawingTool as PictionaryDrawingTool,
  DrawingWidth as PictionaryDrawingWidth,
} from '@/features/drawing/model/drawing';
export {
  EMPTY_DRAWING_DRAFT as EMPTY_PICTIONARY_DRAWING_DRAFT,
  isDrawingColor as isPictionaryDrawingColor,
  DRAWING_PALETTE as PICTIONARY_DRAWING_PALETTE,
  DRAWING_WIDTHS as PICTIONARY_DRAWING_WIDTHS,
  reduceDrawingDraft as reducePictionaryDrawingDraft,
} from '@/features/drawing/model/drawing';
