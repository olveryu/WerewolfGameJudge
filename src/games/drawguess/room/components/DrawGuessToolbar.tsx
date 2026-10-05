/**
 * 你画我猜工具栏：共用 DrawingToolbar 的薄封装（防 drift）。
 */

import type React from 'react';

import { DrawingToolbar } from '@/components/DrawingToolbar/DrawingToolbar';

import {
  DRAWGUESS_DRAWING_PALETTE,
  DRAWGUESS_DRAWING_WIDTHS,
  type DrawGuessDrawingColor,
  type DrawGuessDrawingTool,
  type DrawGuessDrawingWidth,
  isDrawGuessDrawingColor,
} from '../../model/drawGuessDrawing';

export interface DrawGuessToolbarProps {
  readonly tool: DrawGuessDrawingTool;
  readonly color: DrawGuessDrawingColor;
  readonly strokeWidth: DrawGuessDrawingWidth;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly disabled: boolean;
  readonly onToolChange: (tool: DrawGuessDrawingTool) => void;
  readonly onColorChange: (color: DrawGuessDrawingColor) => void;
  readonly onWidthChange: (width: DrawGuessDrawingWidth) => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onClear: () => void;
}

export const DrawGuessToolbar: React.FC<DrawGuessToolbarProps> = (props) => (
  <DrawingToolbar
    tool={props.tool}
    color={props.color}
    strokeWidth={props.strokeWidth}
    canUndo={props.canUndo}
    canRedo={props.canRedo}
    disabled={props.disabled}
    palette={DRAWGUESS_DRAWING_PALETTE}
    widths={[...DRAWGUESS_DRAWING_WIDTHS]}
    onToolChange={props.onToolChange}
    onColorChange={(color) => {
      if (isDrawGuessDrawingColor(color)) props.onColorChange(color);
    }}
    onWidthChange={(width) => {
      const valid = DRAWGUESS_DRAWING_WIDTHS.find((w) => w === width);
      if (valid !== undefined) props.onWidthChange(valid);
    }}
    onUndo={props.onUndo}
    onRedo={props.onRedo}
    onClear={props.onClear}
  />
);
