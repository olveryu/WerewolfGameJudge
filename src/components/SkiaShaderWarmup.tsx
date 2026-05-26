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

  // ── 7. PictureRecorder -> Picture -> drawPicture — flair/animation worklet pattern ──
  const rec = Skia.PictureRecorder();
  const pc = rec.beginRecording(Skia.XYWHRect(0, 0, SIZE, SIZE));
  pc.drawCircle(2, 2, 1, paint);
  const pic = rec.finishRecordingAsPicture();
  canvas.drawPicture(pic);

  // ── 8. Path quadTo + close — FlameEnvelope flame bezier ──
  path.reset();
  path.moveTo(0, 0);
  path.quadTo(2, 0, SIZE, SIZE);
  path.close();
  canvas.drawPath(path, paint);

  // ── 9. Dynamic Skia.Color() construction — for hue cycling in flair ──
  paint.setColor(Skia.Color('rgb(128,128,128)'));
  canvas.drawCircle(2, 2, 1, paint);

  // ── 10. drawLine — ShadowClaw/ThunderBolt 线段 ──
  paint.setStrokeCap(1); // Round cap
  paint.setStyle(1);
  paint.setStrokeWidth(2);
  canvas.drawLine(0, 0, SIZE, SIZE, paint);
  paint.setStrokeCap(0);
  paint.setStyle(0);

  // ── 11. drawRRect fill — LegendaryShimmer 圆角矩形 ──
  paint.setColor(Skia.Color('#FFD700'));
  canvas.drawRRect(rrect, paint);

  // ── 12. RadialGradient shader — WolfReveal fog 雾气 ──
  const shader = Skia.Shader.MakeRadialGradient(
    { x: 2, y: 2 },
    2,
    [Skia.Color('#ff000090'), Skia.Color('#ff000000')],
    [0, 1],
    0,
  );
  paint.setShader(shader);
  canvas.drawCircle(2, 2, 2, paint);
  paint.setShader(null);

  // Flush GPU pipeline
  surface.flush();
}

/** 在 app 启动时执行 Skia shader 预编译。不渲染任何 UI。 */
export function useSkiaShaderWarmup(): void {
  useEffect(() => {
    runOnUI(warmupShaders)();
  }, []);
}
