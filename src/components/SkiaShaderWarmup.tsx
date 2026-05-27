/**
 * SkiaShaderWarmup — Offscreen Texture GPU shader precompilation
 *
 * Uses Skia.Surface.MakeOffscreen() + runOnUI on the UI thread to pre-draw
 * every Skia primitive combo used by role reveal animations (Circle/RoundedRect/Path + Blur/RadialGradient).
 * GPU compiles the shader pipeline on first encounter of each primitive+filter combo;
 * pre-drawing ensures subsequent reveal animations hit the compiled cache, eliminating first-frame jank.
 * See https://shopify.github.io/react-native-skia/docs/animations/textures
 * Renders no visible UI. No service imports, no business logic.
 */
import { Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { runOnUI } from 'react-native-reanimated';

const SIZE = 4; // minimum valid size

/**
 * Worklet: on the UI thread, pre-draw every Skia primitive combo via Offscreen Surface
 * to trigger GPU shader pipeline compilation cache.
 */
function warmupShaders() {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(SIZE, SIZE);
  if (!surface) return;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  // ── 1. Circle fill — basic particle ──
  paint.setColor(Skia.Color('#ff0000'));
  canvas.drawCircle(2, 2, 2, paint);

  // ── 2. Circle fill + ImageFilter blur — blurred particle ──
  const blurFilter = Skia.ImageFilter.MakeBlur(3, 3, 0, null);
  paint.setImageFilter(blurFilter);
  canvas.drawCircle(2, 2, 2, paint);
  paint.setImageFilter(null);

  // ── 3. Circle stroke + blur — halo/ripple ──
  paint.setStyle(1); // PaintStyle.Stroke
  paint.setStrokeWidth(1);
  paint.setImageFilter(blurFilter);
  canvas.drawCircle(2, 2, 1, paint);
  paint.setImageFilter(null);
  paint.setStyle(0); // PaintStyle.Fill

  // ── 4. RoundedRect stroke + blur — breathing border ──
  const rrect = Skia.RRectXY(Skia.XYWHRect(0, 0, SIZE, SIZE), 1, 1);
  paint.setStyle(1);
  paint.setImageFilter(blurFilter);
  canvas.drawRRect(rrect, paint);
  paint.setImageFilter(null);
  paint.setStyle(0);

  // ── 5. Path stroke — crack / lightning arc / rune ──
  const path = Skia.Path.Make();
  path.moveTo(0, 0);
  path.lineTo(SIZE, SIZE);
  paint.setStyle(1);
  canvas.drawPath(path, paint);
  paint.setStyle(0);

  // ── 6. Heavy blur — center glow ──
  const heavyBlur = Skia.ImageFilter.MakeBlur(30, 30, 0, null);
  paint.setImageFilter(heavyBlur);
  canvas.drawCircle(2, 2, 2, paint);
  paint.setImageFilter(null);

  // Flush GPU pipeline
  surface.flush();
}

/** Runs Skia shader pre-compilation at app startup. Renders no UI. */
export function useSkiaShaderWarmup(): void {
  useEffect(() => {
    runOnUI(warmupShaders)();
  }, []);
}
