/**
 * DrawGuess drawing model — re-exports shared drawing model.
 *
 * @deprecated Import from '@/features/drawing/model/drawing' instead.
 * This file is kept for backward compatibility during migration.
 */

export type {
  DrawingColor as DrawGuessDrawingColor,
  DrawingDraft as DrawGuessDrawingDraft,
  DrawingDraftAction as DrawGuessDrawingDraftAction,
  DrawingElement as DrawGuessDrawingElement,
  DrawingFillElement as DrawGuessDrawingFillElement,
  DrawingFillRectangle as DrawGuessDrawingFillRectangle,
  DrawingFreehandElement as DrawGuessDrawingFreehandElement,
  DrawingPoint as DrawGuessDrawingPoint,
  DrawingShapeElement as DrawGuessDrawingShapeElement,
  DrawingTool as DrawGuessDrawingTool,
  DrawingWidth as DrawGuessDrawingWidth,
} from '@/features/drawing/model/drawing';
export {
  DRAWING_PALETTE as DRAWGUESS_DRAWING_PALETTE,
  DRAWING_WIDTHS as DRAWGUESS_DRAWING_WIDTHS,
  isDrawingColor as isDrawGuessDrawingColor,
} from '@/features/drawing/model/drawing';
