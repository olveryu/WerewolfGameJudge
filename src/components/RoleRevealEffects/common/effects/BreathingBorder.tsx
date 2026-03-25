/**
 * BreathingBorder — Skia 脉冲辉光边框
 *
 * 翻牌揭示后在卡片周围渲染弥散的能量场光晕（而非简单边框线），
 * 使用 Skia RoundedRect stroke + Blur + blendMode 实现。
 * 4 颗光点沿矩形边缘缓慢移动。无限呼吸脉动保持视觉存在感。
 * `onComplete` 在 mount 后经过 `effectDisplayDuration` 延迟触发。
 * 不 import service，不含业务逻辑。
 */
import { Blur, Canvas, Circle, Group, RoundedRect } from '@shopify/react-native-skia';
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
  const perimeter = useMemo(
    () => 2 * (cardWidth + glowPadding) + 2 * (cardHeight + glowPadding),
    [cardWidth, cardHeight, glowPadding],
  );

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

      {/* Runner light orbs — 4 points gliding along border */}
      <Group blendMode="screen">
        {Array.from({ length: RUNNER_COUNT }, (_, i) => (
          <RunnerOrb
            key={i}
            index={i}
            progress={runnerProgress}
            perimeter={perimeter}
            offsetX={offsetX}
            offsetY={offsetY}
            rectW={cardWidth + glowPadding}
            rectH={cardHeight + glowPadding}
            color={glowColor}
          />
        ))}
      </Group>
    </Canvas>
  );
};

/** Light orb moving along the rectangular border perimeter */
const RunnerOrb = React.memo(function RunnerOrb({
  index,
  progress,
  perimeter,
  offsetX,
  offsetY,
  rectW,
  rectH,
  color,
}: {
  index: number;
  progress: { value: number };
  perimeter: number;
  offsetX: number;
  offsetY: number;
  rectW: number;
  rectH: number;
  color: string;
}) {
  const phase = index / RUNNER_COUNT;

  const cx = useDerivedValue(() => {
    const t = ((progress.value + phase) % 1) * perimeter;
    if (t < rectW) return offsetX + t;
    if (t < rectW + rectH) return offsetX + rectW;
    if (t < 2 * rectW + rectH) return offsetX + rectW - (t - rectW - rectH);
    return offsetX;
  });

  const cy = useDerivedValue(() => {
    const t = ((progress.value + phase) % 1) * perimeter;
    if (t < rectW) return offsetY;
    if (t < rectW + rectH) return offsetY + (t - rectW);
    if (t < 2 * rectW + rectH) return offsetY + rectH;
    return offsetY + rectH - (t - 2 * rectW - rectH);
  });

  return (
    <Circle cx={cx} cy={cy} r={3} color={color} opacity={0.7}>
      <Blur blur={6} />
    </Circle>
  );
});
