/** Interactive 4:3 Skia canvas that records portable normalized Pictionary strokes. */

import { Canvas, Path, Skia, type SkPathBuilder } from '@shopify/react-native-skia';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, PICTIONARY_CANVAS_BACKGROUND } from '@/theme';

import type {
  PictionaryDrawingColor,
  PictionaryDrawingPoint,
  PictionaryDrawingStroke,
  PictionaryDrawingTool,
  PictionaryDrawingWidth,
} from '../../model/pictionaryDrawing';
import { createPictionaryStrokePath } from '../../services/renderPictionaryDrawing';

const CANONICAL_CANVAS_WIDTH = 1024;
const MIN_POINT_DISTANCE_SQUARED = 0.000_001;

interface PictionaryDrawingCanvasProps {
  readonly strokes: readonly PictionaryDrawingStroke[];
  readonly tool: PictionaryDrawingTool;
  readonly color: PictionaryDrawingColor;
  readonly strokeWidth: PictionaryDrawingWidth;
  readonly isEnabled: boolean;
  readonly onStrokeComplete: (stroke: PictionaryDrawingStroke) => void;
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isDistinctPoint(
  previous: PictionaryDrawingPoint | undefined,
  next: PictionaryDrawingPoint,
): boolean {
  if (previous === undefined) return true;
  const deltaX = next.x - previous.x;
  const deltaY = next.y - previous.y;
  return deltaX * deltaX + deltaY * deltaY >= MIN_POINT_DISTANCE_SQUARED;
}

export const PictionaryDrawingCanvas: React.FC<PictionaryDrawingCanvasProps> = ({
  strokes,
  tool,
  color,
  strokeWidth,
  isEnabled,
  onStrokeComplete,
}) => {
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const activePath = useSharedValue(Skia.Path.Make());
  const activeBuilder = useRef<SkPathBuilder | null>(null);
  const activePoints = useRef<PictionaryDrawingPoint[]>([]);

  const normalizedPoint = useCallback(
    (x: number, y: number): PictionaryDrawingPoint => {
      if (canvasSize.width <= 0 || canvasSize.height <= 0) {
        throw new Error('[FAIL-FAST] Pictionary canvas gesture started before layout');
      }
      return {
        x: clampUnit(x / canvasSize.width),
        y: clampUnit(y / canvasSize.height),
      };
    },
    [canvasSize.height, canvasSize.width],
  );

  const beginStroke = useCallback(
    (x: number, y: number): void => {
      const point = normalizedPoint(x, y);
      const builder = Skia.PathBuilder.Make();
      builder.moveTo(point.x * canvasSize.width, point.y * canvasSize.height);
      activeBuilder.current = builder;
      activePoints.current = [point];
      activePath.value = builder.build();
    },
    [activePath, canvasSize.height, canvasSize.width, normalizedPoint],
  );

  const continueStroke = useCallback(
    (x: number, y: number): void => {
      const builder = activeBuilder.current;
      if (builder === null) return;
      const point = normalizedPoint(x, y);
      if (!isDistinctPoint(activePoints.current.at(-1), point)) return;
      activePoints.current.push(point);
      builder.lineTo(point.x * canvasSize.width, point.y * canvasSize.height);
      activePath.value = builder.build();
    },
    [activePath, canvasSize.height, canvasSize.width, normalizedPoint],
  );

  const finishStroke = useCallback((): void => {
    if (activeBuilder.current === null || activePoints.current.length === 0) return;
    onStrokeComplete({
      id: crypto.randomUUID(),
      tool,
      color,
      width: strokeWidth,
      points: activePoints.current,
    });
  }, [color, onStrokeComplete, strokeWidth, tool]);

  const clearActiveStroke = useCallback((): void => {
    activeBuilder.current = null;
    activePoints.current = [];
    activePath.value = Skia.Path.Make();
  }, [activePath]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isEnabled)
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => beginStroke(event.x, event.y))
        .onUpdate((event) => continueStroke(event.x, event.y))
        .onEnd(finishStroke)
        .onFinalize(clearActiveStroke),
    [beginStroke, clearActiveStroke, continueStroke, finishStroke, isEnabled],
  );

  const renderedStrokes = useMemo(
    () =>
      canvasSize.width === 0
        ? []
        : strokes.map((stroke) => ({
            stroke,
            path: createPictionaryStrokePath(stroke.points, canvasSize.width, canvasSize.height),
          })),
    [canvasSize.height, canvasSize.width, strokes],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  const displayScale = canvasSize.width / CANONICAL_CANVAS_WIDTH;
  const activeColor = tool === 'eraser' ? PICTIONARY_CANVAS_BACKGROUND : color;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.frame}
        onLayout={handleLayout}
        accessibilityLabel="绘画画布"
        testID={TESTIDS.pictionaryDrawingCanvas}
      >
        <Canvas style={styles.canvas}>
          {renderedStrokes.map(({ stroke, path }) => (
            <Path
              key={stroke.id}
              path={path}
              color={stroke.tool === 'eraser' ? PICTIONARY_CANVAS_BACKGROUND : stroke.color}
              style="stroke"
              strokeWidth={stroke.width * displayScale}
              strokeCap="round"
              strokeJoin="round"
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
    backgroundColor: PICTIONARY_CANVAS_BACKGROUND,
  },
  canvas: { flex: 1 },
});
