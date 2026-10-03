/**
 * 纯本地绘画数据模型：工具、颜色、笔宽与笔画元素。
 *
 * 从接龙版 `src/games/pictionary/model/pictionaryDrawing.ts` 复制并改名（游戏间禁止互相 import）。
 * 坐标归一化到 0–1；导出/渲染时映射到 1024×768。
 */

export { PICTIONARY_DRAWING_PALETTE as DRAWGUESS_DRAWING_PALETTE } from '@/theme/colors';

export const DRAWGUESS_DRAWING_WIDTHS = [5, 14, 30] as const;

export type DrawGuessDrawingColor = `#${string}`;

/** 在取色器与存储边界校验不透明六位十六进制颜色。 */
export function isDrawGuessDrawingColor(value: unknown): value is DrawGuessDrawingColor {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export type DrawGuessDrawingWidth = (typeof DRAWGUESS_DRAWING_WIDTHS)[number];
export type DrawGuessDrawingTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'fill';

export interface DrawGuessDrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawGuessDrawingFreehandElement {
  readonly id: string;
  readonly kind: 'brush' | 'eraser';
  readonly color: DrawGuessDrawingColor;
  readonly width: DrawGuessDrawingWidth;
  readonly points: readonly DrawGuessDrawingPoint[];
}

export interface DrawGuessDrawingShapeElement {
  readonly id: string;
  readonly kind: 'line' | 'rectangle' | 'ellipse';
  readonly color: DrawGuessDrawingColor;
  readonly width: DrawGuessDrawingWidth;
  readonly start: DrawGuessDrawingPoint;
  readonly end: DrawGuessDrawingPoint;
}

export interface DrawGuessDrawingFillRectangle {
  /** 1024x768 标准导出画布上的整数坐标。 */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DrawGuessDrawingFillElement {
  readonly id: string;
  readonly kind: 'fill';
  readonly color: DrawGuessDrawingColor;
  /** 笔宽（填充渲染不用，服务端笔画模型要求携带）。 */
  readonly width: DrawGuessDrawingWidth;
  readonly rectangles: readonly DrawGuessDrawingFillRectangle[];
}

export type DrawGuessDrawingElement =
  | DrawGuessDrawingFreehandElement
  | DrawGuessDrawingShapeElement
  | DrawGuessDrawingFillElement;
