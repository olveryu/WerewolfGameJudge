/**
 * BreathingBorder — Skia 脉冲辉光边框
 *
 * 翻牌揭示后在卡片周围渲染弥散的能量场光晕（而非简单边框线），
 * 使用 Skia RoundedRect stroke + Blur + blendMode 实现。
 * 4 颗光点沿矩形边缘缓慢移动。无限呼吸脉动保持视觉存在感。
 * `onComplete` 在 mount 后经过 `effectDisplayDuration` 延迟触发。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Group, Paint, Picture, RoundedRect, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const { common, alignmentEffects, skia: SK } = CONFIG;

// Number of runner light orbs along the border edge
const RUNNER_COUNT = 4;

// ── Immediate-mode Skia resources (reused across frames) ──
const runnerRecorder = Skia.PictureRecorder();
const runnerPaint = Skia.Paint();

interface BreathingBorderProps {
  /** Border color */
  color: string;
  /** Glow spread color (lighter variant) */
  glowColor: string;
  /** Card content width */
  cardWidth: number;
  /** Card content height */
  cardHeight: number;
  /** Whether to start animation */
  animate: boolean;
  /** Breathing cycle duration (ms). Per-alignment values from config. */
  breathingDuration?: number;
  /** Fired shortly after mount (game state progression) */
  onComplete?: () => void;
}

export const BreathingBorder: React.FC<BreathingBorderProps> = ({
  color,
  glowColor,
  cardWidth,
  cardHeight,
  animate,
  breathingDuration: breathingDurationProp,
  onComplete,
}) => {
  const glowPadding = common.glowPadding;
  const duration = breathingDurationProp ?? 2500;

  // ── Shared values ──
  const breathe = useSharedValue(1);
  const runnerProgress = useSharedValue(0);

  // Fire onComplete after alignment effects have displayed
  useEffect(() => {
    if (!animate || !onComplete) return;
    const timer = setTimeout(onComplete, alignmentEffects.effectDisplayDuration);
    return () => clearTimeout(timer);
  }, [animate, onComplete]);

  // Breathing loop — stroke width and blur pulsation
  useEffect(() => {
    if (!animate) {
      breathe.value = 1;
      return;
    }
    const breathHalf = duration / 2;
    const breathEasing = Easing.inOut(Easing.sin);
    breathe.value = withSequence(
      withTiming(0, { duration: breathHalf, easing: breathEasing }),
      withRepeat(
        withSequence(
          withTiming(1, { duration: breathHalf, easing: breathEasing }),
          withTiming(0, { duration: breathHalf, easing: breathEasing }),
        ),
        -1,
      ),
    );
  }, [animate, duration, breathe]);

  // Runner light — continuous loop along border perimeter
  useEffect(() => {
    if (!animate) return;
    runnerProgress.value = withRepeat(
      withTiming(1, { duration: duration * 2, easing: Easing.linear }),
      -1,
    );
  }, [animate, duration, runnerProgress]);

  // ── Derived Skia values ──
  const [blurMin, blurMax] = SK.breathingBlurRange;
  const [strokeMin, strokeMax] = SK.breathingStrokeRange;

  const blurVal = useDerivedValue(() => blurMin + breathe.value * (blurMax - blurMin));
  const strokeW = useDerivedValue(() => strokeMin + breathe.value * (strokeMax - strokeMin));
  const borderOpacity = useDerivedValue(() => 0.4 + breathe.value * 0.4);

  // Canvas dimensions (includes padding for glow overflow)
  const canvasW = cardWidth + glowPadding * 3;
  const canvasH = cardHeight + glowPadding * 3;
  const offsetX = glowPadding;
  const offsetY = glowPadding;
  const rectR = borderRadius.xlarge;

  // Perimeter for runner positions
  const rectW = cardWidth + glowPadding;
  const rectH = cardHeight + glowPadding;
  const perimeter = useMemo(() => 2 * rectW + 2 * rectH, [rectW, rectH]);

  const canvasStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      width: canvasW,
      height: canvasH,
      top: -glowPadding,
      left: -glowPadding,
    }),
    [canvasW, canvasH, glowPadding],
  );

  // ── Runner orbs: Immediate Mode via Picture API ──
  // Replaces 4 RunnerOrb components (8 useDerivedValue per frame) with 1.
  const runnerPicture = useDerivedValue(() => {
    'worklet';
    const c = runnerRecorder.beginRecording(Skia.XYWHRect(0, 0, canvasW, canvasH));
    const skColor = Skia.Color(glowColor);
    runnerPaint.setColor(skColor);
    runnerPaint.setAlphaf(0.7);
    for (let i = 0; i < RUNNER_COUNT; i++) {
      const phase = i / RUNNER_COUNT;
      const t = ((runnerProgress.value + phase) % 1) * perimeter;
      let cx: number;
      let cy: number;
      if (t < rectW) {
        cx = offsetX + t;
        cy = offsetY;
      } else if (t < rectW + rectH) {
        cx = offsetX + rectW;
        cy = offsetY + (t - rectW);
      } else if (t < 2 * rectW + rectH) {
        cx = offsetX + rectW - (t - rectW - rectH);
        cy = offsetY + rectH;
      } else {
        cx = offsetX;
        cy = offsetY + rectH - (t - 2 * rectW - rectH);
      }
      c.drawCircle(cx, cy, 3, runnerPaint);
    }
    return runnerRecorder.finishRecordingAsPicture();
  });

  return (
    <Canvas style={canvasStyle} pointerEvents="none">
      {/* Main breathing border — stroke + blur glow */}
      <Group opacity={borderOpacity} blendMode="screen">
        <RoundedRect
          x={offsetX}
          y={offsetY}
          width={cardWidth + glowPadding}
          height={cardHeight + glowPadding}
          r={rectR}
          color={color}
          style="stroke"
          strokeWidth={strokeW}
        >
          <Blur blur={blurVal} />
        </RoundedRect>
      </Group>

      {/* Runner light orbs — Picture API with group-level blur */}
      <Group
        blendMode="screen"
        layer={
          <Paint>
            <Blur blur={6} />
          </Paint>
        }
      >
        <Picture picture={runnerPicture} />
      </Group>
    </Canvas>
  );
};
