/**
 * BreathingBorder — 脉冲辉光边框（SVG + Reanimated）
 *
 * 翻牌揭示后在卡片周围渲染弥散的能量场光晕（而非简单边框线），
 * 使用 SVG RoundedRect stroke + feGaussianBlur + Reanimated useAnimatedProps 实现。
 * 4 颗光点沿矩形边缘缓慢移动。无限呼吸脉动保持视觉存在感。
 * `onComplete` 在 mount 后经过 `effectDisplayDuration` 延迟触发。
 * 不 import service，不含业务逻辑。
 */
import React, { useEffect, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Rect } from 'react-native-svg';

import { CONFIG } from '@/components/RoleRevealEffects/config';
import { borderRadius } from '@/theme';

const { common, alignmentEffects, skia: SK } = CONFIG;

// Number of runner light orbs along the border edge
const RUNNER_COUNT = 4;

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedFeGaussianBlur = Animated.createAnimatedComponent(FeGaussianBlur);

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

/** A single runner orb driven by shared runnerProgress */
const RunnerOrb: React.FC<{
  index: number;
  runnerProgress: SharedValue<number>;
  offsetX: number;
  offsetY: number;
  rectW: number;
  rectH: number;
  perimeter: number;
  color: string;
}> = React.memo(({ index, runnerProgress, offsetX, offsetY, rectW, rectH, perimeter, color }) => {
  const animatedProps = useAnimatedProps(() => {
    const phase = index / RUNNER_COUNT;
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
    return { cx, cy };
  });
  return <AnimatedCircle r={3} fill={color} opacity={0.7} animatedProps={animatedProps} />;
});
RunnerOrb.displayName = 'RunnerOrb';

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

  // ── Derived animated values ──
  const [blurMin, blurMax] = SK.breathingBlurRange;
  const [strokeMin, strokeMax] = SK.breathingStrokeRange;

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
      pointerEvents: 'none' as const,
    }),
    [canvasW, canvasH, glowPadding],
  );

  // Animated border stroke width
  const borderAnimatedProps = useAnimatedProps(() => {
    const sw = strokeMin + breathe.value * (strokeMax - strokeMin);
    return { strokeWidth: sw };
  });

  // Animated border group opacity
  const borderGroupProps = useAnimatedProps(() => {
    const opacity = 0.4 + breathe.value * 0.4;
    return { opacity };
  });

  // Animated blur for the breathing border
  const blurAnimatedProps = useAnimatedProps(() => {
    const blur = blurMin + breathe.value * (blurMax - blurMin);
    return { stdDeviation: blur };
  });

  const runnerIndices = useMemo(() => Array.from({ length: RUNNER_COUNT }, (_, i) => i), []);

  return (
    <Svg style={canvasStyle} width={canvasW} height={canvasH}>
      <Defs>
        <Filter id="breathing-blur" x="-50%" y="-50%" width="200%" height="200%">
          <AnimatedFeGaussianBlur
            in="SourceGraphic"
            stdDeviation={blurMin}
            animatedProps={blurAnimatedProps}
          />
        </Filter>
        <Filter id="runner-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation={6} />
        </Filter>
      </Defs>

      {/* Main breathing border — stroke + blur glow */}
      <AnimatedG animatedProps={borderGroupProps}>
        <AnimatedRect
          x={offsetX}
          y={offsetY}
          width={rectW}
          height={rectH}
          rx={rectR}
          ry={rectR}
          fill="none"
          stroke={color}
          filter="url(#breathing-blur)"
          animatedProps={borderAnimatedProps}
        />
      </AnimatedG>

      {/* Runner light orbs */}
      <G filter="url(#runner-blur)">
        {runnerIndices.map((i) => (
          <RunnerOrb
            key={i}
            index={i}
            runnerProgress={runnerProgress}
            offsetX={offsetX}
            offsetY={offsetY}
            rectW={rectW}
            rectH={rectH}
            perimeter={perimeter}
            color={glowColor}
          />
        ))}
      </G>
    </Svg>
  );
};
