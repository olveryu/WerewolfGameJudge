/**
 * SkiaShaderWarmup — Offscreen Texture GPU shader 预编译
 *
 * 利用 Skia.Surface.MakeOffscreen() + runOnUI 在 UI 线程上预绘制
 * 角色揭示动画使用的全部 Skia 原语组合（Circle/RoundedRect/Path + Blur/RadialGradient）。
 * GPU 在首次遇到每种原语+滤镜组合时编译 shader pipeline，预绘制确保后续
 * 揭示动画命中已编译缓存，消除首帧卡顿。
 * 参见 https://shopify.github.io/react-native-skia/docs/animations/textures
 * 不渲染任何可见 UI。不 import service，不含业务逻辑。
 */
import { Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { runOnUI } from 'react-native-reanimated';

const SIZE = 4; // 最小有效尺寸

/**
 * Worklet: 在 UI 线程上通过 Offscreen Surface 预绘制所有 Skia 原语组合，
 * 触发 GPU shader pipeline 编译缓存。
 */
function warmupShaders() {
  'worklet';
  const surface = Skia.Surface.MakeOffscreen(SIZE, SIZE);
  if (!surface) return;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  // ── 1. Circle fill — 基础粒子 ──
  paint.setColor(Skia.Color('#ff0000'));
  canvas.drawCircle(2, 2, 2, paint);

  // ── 2. Circle fill + ImageFilter blur — 带模糊的粒子 ──
  const blurFilter = Skia.ImageFilter.MakeBlur(3, 3, 0, null);
  paint.setImageFilter(blurFilter);
  canvas.drawCircle(2, 2, 2, paint);
  paint.setImageFilter(null);

  // ── 3. Circle stroke + blur — 光环/波纹 ──
  paint.setStyle(1); // PaintStyle.Stroke
  paint.setStrokeWidth(1);
  paint.setImageFilter(blurFilter);
  canvas.drawCircle(2, 2, 1, paint);
  paint.setImageFilter(null);
  paint.setStyle(0); // PaintStyle.Fill

  // ── 4. RoundedRect stroke + blur — 呼吸边框 ──
  const rrect = Skia.RRectXY(Skia.XYWHRect(0, 0, SIZE, SIZE), 1, 1);
  paint.setStyle(1);
  paint.setImageFilter(blurFilter);
  canvas.drawRRect(rrect, paint);
  paint.setImageFilter(null);
  paint.setStyle(0);

  // ── 5. Path stroke — 裂痕/闪电弧/符文 ──
  const path = Skia.Path.Make();
  path.moveTo(0, 0);
  path.lineTo(SIZE, SIZE);
  paint.setStyle(1);
  canvas.drawPath(path, paint);
  paint.setStyle(0);

  // ── 6. 大范围 blur — 中心辉光 ──
  const heavyBlur = Skia.ImageFilter.MakeBlur(30, 30, 0, null);
  paint.setImageFilter(heavyBlur);
  canvas.drawCircle(2, 2, 2, paint);
  paint.setImageFilter(null);

  // Flush GPU pipeline
  surface.flush();
}

/** 在 app 启动时执行 Skia shader 预编译。不渲染任何 UI。 */
export function useSkiaShaderWarmup(): void {
  useEffect(() => {
    runOnUI(warmupShaders)();
  }, []);
}
