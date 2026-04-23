/**
 * Jest mock for @shopify/react-native-skia
 *
 * Provides no-op stub components and factory functions for unit tests.
 * Skia Canvas renders nothing in JSDOM; this mock prevents import errors.
 */
import React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

// ── Stub component factory ──
const createMockComponent = (name: string): React.FC<ViewProps & Record<string, unknown>> => {
  const MockComponent: React.FC<ViewProps & Record<string, unknown>> = ({
    children,
    testID,
    ...rest
  }) => (
    <View testID={testID} {...(rest as ViewProps)}>
      {children}
    </View>
  );
  MockComponent.displayName = `Mock${name}`;
  return MockComponent;
};

// ── Drawing primitives ──
export const Canvas = createMockComponent('Canvas');
export const Circle = createMockComponent('Circle');
export const Rect = createMockComponent('Rect');
export const RoundedRect = createMockComponent('RoundedRect');
export const Path = createMockComponent('Path');
export const Line = createMockComponent('Line');
export const Fill = createMockComponent('Fill');
export const Group = createMockComponent('Group');
export const Paint = createMockComponent('Paint');
export const Blur = createMockComponent('Blur');
export const BlurMask = createMockComponent('BlurMask');
export const Shadow = createMockComponent('Shadow');
export const ColorMatrix = createMockComponent('ColorMatrix');

// ── Shaders / Gradients ──
export const LinearGradient = createMockComponent('LinearGradient');
export const RadialGradient = createMockComponent('RadialGradient');
export const SweepGradient = createMockComponent('SweepGradient');

// ── Text ──
export const SkiaText = createMockComponent('SkiaText');
export const Glyphs = createMockComponent('Glyphs');

// ── Image ──
export const Image = createMockComponent('Image');
export const SkiaImage = createMockComponent('SkiaImage');

// ── Utility ──
export const vec = (x: number, y: number) => ({ x, y });
export const Picture = createMockComponent('Picture');

const noopCanvas = {
  drawCircle: () => {},
  drawRRect: () => {},
  drawRect: () => {},
  drawPath: () => {},
  drawColor: () => {},
  drawLine: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: () => {},
};

const noopPaint = {
  setColor: () => {},
  setAlphaf: () => {},
  setStyle: () => {},
  setStrokeWidth: () => {},
  setStrokeCap: () => {},
  setShader: () => {},
  setImageFilter: () => {},
  setBlendMode: () => {},
  copy: () => noopPaint,
};

export const Skia = {
  Path: {
    Make: () => ({
      moveTo: () => {},
      lineTo: () => {},
      cubicTo: () => {},
      quadTo: () => {},
      close: () => {},
      addCircle: () => {},
      addRRect: () => {},
      addRect: () => {},
      transform: () => {},
      reset: () => {},
      toSVGString: () => '',
      copy: () => Skia.Path.Make(),
    }),
    MakeFromSVGString: () => Skia.Path.Make(),
  },
  Paint: () => ({ ...noopPaint }),
  PictureRecorder: () => ({
    beginRecording: () => noopCanvas,
    finishRecordingAsPicture: () => ({}),
  }),
  Surface: {
    MakeOffscreen: () => ({
      getCanvas: () => noopCanvas,
      flush: () => {},
      makeImageSnapshot: () => ({}),
    }),
  },
  ImageFilter: {
    MakeBlur: () => ({}),
  },
  Shader: {
    MakeLinearGradient: () => ({}),
    MakeRadialGradient: () => ({}),
  },
  RRectXY: () => ({}),
  XYWHRect: () => ({}),
  Color: (c: string) => c,
  RuntimeEffect: {
    Make: () => ({
      makeShader: () => ({}),
      makeShaderWithChildren: () => ({}),
    }),
  },
};

export const processTransform3d = (transforms: unknown[]) => transforms;
export const interpolateColors = (_value: number, _inputRange: number[], _colors: string[]) =>
  'rgba(0,0,0,1)';

// ── Hooks ──
export const usePathValue = (fn: unknown, defaultPath?: unknown) => defaultPath ?? null;
export const useFont = () => null;
export const useImage = () => null;
export const useTexture = () => ({ value: null });
export const useRuntimeShaderBuilder = () => ({});
