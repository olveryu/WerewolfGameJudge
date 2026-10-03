/**
 * 4:3 Skia 交互画布：归一化手写、图形与填充操作。
 *
 * 从接龙版 `src/games/pictionary/room/components/PictionaryDrawingCanvas.tsx` 复制并改名
 *（游戏间禁止互相 import）。
 */

import { Canvas, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { borderRadius, colors, fixed } from '@/theme';

import type {
  DrawGuessDrawingColor,
  DrawGuessDrawingElement,
  DrawGuessDrawingPoint,
  DrawGuessDrawingShapeElement,
  DrawGuessDrawingTool,
  DrawGuessDrawingWidth,
} from '../../model/drawGuessDrawing';
import {
  createDrawGuessElementPath,
  DRAWGUESS_CANVAS_BACKGROUND,
} from '../../services/drawGuessMediaApi';

const CANONICAL_CANVAS_WIDTH = 1024;
const MIN_POINT_DISTANCE_SQUARED = 0.000_001;

interface DrawGuessDrawingCanvasProps {
  readonly elements: readonly DrawGuessDrawingElement[];
  readonly tool: DrawGuessDrawingTool;
  readonly color: DrawGuessDrawingColor;
  readonly strokeWidth: DrawGuessDrawingWidth;
  readonly isEnabled: boolean;
  readonly onElementChange: (element: DrawGuessDrawingElement) => void;
  readonly onElementComplete: (element: DrawGuessDrawingElement) => void;
  readonly onFill: (point: DrawGuessDrawingPoint) => void;
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isDistinctPoint(
  previous: DrawGuessDrawingPoint | undefined,
  next: DrawGuessDrawingPoint,
): boolean {
  if (previous === undefined) return true;
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  return deltaX * deltaX + deltaY * deltaY >= MIN_POINT_DISTANCE_SQUARED;
}

export const DrawGuessDrawingCanvas: React.FC<DrawGuessDrawingCanvasProps> = ({
  elements,
  tool,
  color,
  strokeWidth,
  isEnabled,
  onElementChange,
  onElementComplete,
  onFill,
}) => {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const activePath = useSharedValue(Skia.Path.Make());
  const activeBuilder = useRef<SkPathBuilder | null>(null);
  const activeElementId = useRef('');
  const activePoints = useRef<DrawGuessDrawingPoint[]>([]);
  const activeShapeStart = useRef<DrawGuessDrawingPoint | null>(null);
  const activeShapeEnd = useRef<DrawGuessDrawingPoint | null>(null);

  const normalizedPoint = useCallback(
    (x: number, y: number): DrawGuessDrawingPoint => {
      if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        throw new Error('[FAIL-FAST] DrawGuess canvas gesture started before layout');
      }
      return {
        x: clampUnit(x / canvasSize.width),
        y: clampUnit(y / canvasSize.height),
      };
    },
    [canvasSize.height, canvasSize.width],
  );

  const beginElement = useCallback(
    (x: number, y: number): void => {
      const point = normalizedPoint(x, y);
      if (tool === 'fill') {
        onFill(point);
        return;
      }
      activeElementId.current = crypto.randomUUID();
      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        activeShapeStart.current = point;
        activeShapeEnd.current = point;
        activePath.value = createDrawGuessElementPath(
          {
            id: activeElementId.current,
            kind: tool,
            color,
            width: strokeWidth,
            start: point,
            end: point,
          },
          canvasSize.width,
          canvasSize.height,
        );
        onElementChange({
          id: activeElementId.current,
          kind: tool,
          color,
          width: strokeWidth,
          start: point,
          end: point,
        });
        return;
      }
      const builder = Skia.PathBuilder.Make();
      builder.moveTo(point.x * canvasSize.width, point.y * canvasSize.height);
      activeBuilder.current = builder;
      activePoints.current = [point];
      activePath.value = builder.build();
      onElementChange({
        id: activeElementId.current,
        kind: tool,
        color,
        width: strokeWidth,
        points: [point],
      });
    },
    [
      activePath,
      canvasSize.height,
      canvasSize.width,
      color,
      normalizedPoint,
      onElementChange,
      onFill,
      strokeWidth,
      tool,
    ],
  );

  const continueElement = useCallback(
    (x: number, y: number): void => {
      if (tool === 'fill') return;
      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        const start = activeShapeStart.current;
        if (start === null) return;
        const end = normalizedPoint(x, y);
        activeShapeEnd.current = end;
        activePath.value = createDrawGuessElementPath(
          {
            id: activeElementId.current,
            kind: tool,
            color,
            width: strokeWidth,
            start,
            end,
          },
          canvasSize.width,
          canvasSize.height,
        );
        onElementChange({
          id: activeElementId.current,
          kind: tool,
          color,
          width: strokeWidth,
          start,
          end,
        });
        return;
      }
      const builder = activeBuilder.current;
      if (builder === null) return;
      const point = normalizedPoint(x, y);
      if (!isDistinctPoint(activePoints.current.at(-1), point)) return;
      activePoints.current.push(point);
      builder.lineTo(point.x * canvasSize.width, point.y * canvasSize.height);
      activePath.value = builder.build();
      onElementChange({
        id: activeElementId.current,
        kind: tool,
        color,
        width: strokeWidth,
        points: [...activePoints.current],
      });
    },
    [
      activePath,
      canvasSize.height,
      canvasSize.width,
      color,
      normalizedPoint,
      onElementChange,
      strokeWidth,
      tool,
    ],
  );

  const finishElement = useCallback((): void => {
    if (tool === 'fill') return;
    if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
      const start = activeShapeStart.current;
      const end = activeShapeEnd.current;
      if (start === null || end === null) return;
      const element: DrawGuessDrawingShapeElement = {
        id: activeElementId.current,
        kind: tool,
        color,
        width: strokeWidth,
        start,
        end,
      };
      onElementComplete(element);
      return;
    }
    if (activeBuilder.current === null || activePoints.current.length === 0) return;
    onElementComplete({
      id: activeElementId.current,
      kind: tool,
      color,
      width: strokeWidth,
      points: [...activePoints.current],
    });
  }, [color, onElementComplete, strokeWidth, tool]);

  const clearActiveElement = useCallback((): void => {
    activeBuilder.current = null;
    activePoints.current = [];
    activeShapeStart.current = null;
    activeShapeEnd.current = null;
    activePath.value = Skia.Path.Make();
  }, [activePath]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isEnabled)
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => beginElement(event.x, event.y))
        .onUpdate((event) => continueElement(event.x, event.y))
        .onEnd(finishElement)
        .onFinalize(clearActiveElement),
    [beginElement, clearActiveElement, continueElement, finishElement, isEnabled],
  );

  const renderedElements = useMemo(
    () =>
      canvasSize.width === 0
        ? []
        : elements.map((element) => ({
            element,
            path: createDrawGuessElementPath(element, canvasSize.width, canvasSize.height),
          })),
    [canvasSize.height, canvasSize.width, elements],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  const displayScale = canvasSize.width / CANONICAL_CANVAS_WIDTH;
  const activeColor = tool === 'eraser' ? DRAWGUESS_CANVAS_BACKGROUND : color;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.frame}
        onLayout={handleLayout}
        accessibilityLabel="绘画画布"
        testID="drawguess-drawing-canvas"
      >
        <Canvas style={styles.canvas}>
          {renderedElements.map(({ element, path }) => (
            <Path
              key={element.id}
              path={path}
              color={element.kind === 'eraser' ? DRAWGUESS_CANVAS_BACKGROUND : element.color}
              style={element.kind === 'fill' ? 'fill' : 'stroke'}
              strokeWidth={element.kind === 'fill' ? undefined : element.width * displayScale}
              strokeCap="round"
              strokeJoin="round"
              antiAlias={element.kind !== 'fill'}
            />
          ))}
          <Path
            path={activePath}
            color={activeColor}
            style="stroke"
            strokeWidth={strokeWidth * displayScale}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: DRAWGUESS_CANVAS_BACKGROUND,
  },
  canvas: { flex: 1 },
});
