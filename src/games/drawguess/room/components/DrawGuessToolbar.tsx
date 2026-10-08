/**
 * 你画我猜工具栏：共用 DrawingToolbar 的薄封装（防 drift）。
 */

import type React from 'react';

import { DrawingToolbar } from '@/components/DrawingToolbar/DrawingToolbar';
import {
  DRAWING_PALETTE,
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingTool,
  type DrawingWidth,
  isDrawingColor,
} from '@/features/drawing/model/drawing';

export interface DrawGuessToolbarProps {
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly strokeWidth: DrawingWidth;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly disabled: boolean;
  readonly onToolChange: (tool: DrawingTool) => void;
  readonly onColorChange: (color: DrawingColor) => void;
  readonly onWidthChange: (width: DrawingWidth) => void;
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
    palette={DRAWING_PALETTE}
    widths={[...DRAWING_WIDTHS]}
    onToolChange={props.onToolChange}
    onColorChange={(color) => {
      if (isDrawingColor(color)) props.onColorChange(color);
    }}
    onWidthChange={(width) => {
      const valid = DRAWING_WIDTHS.find((w) => w === width);
      if (valid !== undefined) props.onWidthChange(valid);
    }}
    onUndo={props.onUndo}
    onRedo={props.onRedo}
    onClear={props.onClear}
  />
);
