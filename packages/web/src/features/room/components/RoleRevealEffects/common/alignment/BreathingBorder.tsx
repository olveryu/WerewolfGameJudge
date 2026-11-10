import { useEffect, useMemo } from 'react';

import { Easing, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { CONFIG } from '../../config';
import { blurFilter, graphicsLayer, setBlurSigma } from '../../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../../pixiLayer';
import { useSharedValue } from '../../runtime';
import type { ViewRect } from '../useAnchorRect';

const { common, alignmentEffects, skia: SK } = CONFIG;

const RUNNER_COUNT = 4;
/** `--radius-xlarge`, the card's corner radius. */
const CARD_RADIUS = 28;

interface BreathingBorderProps {
  readonly rect: ViewRect;
  readonly zIndex: number;
  readonly color: string;
  readonly glowColor: string;
  readonly breathingDuration: number;
  readonly onComplete: () => void;
}

/**
 * A breathing glow stroke around the card with four light orbs running along it; reports the
 * reveal complete after the alignment effects' display time.
 */
export function BreathingBorder({
  rect,
  zIndex,
  color,
  glowColor,
  breathingDuration,
  onComplete,
}: BreathingBorderProps) {
  const padding = common.glowPadding;
  const canvasRect = useMemo(
    () => ({
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 3,
      height: rect.height + padding * 3,
    }),
    [rect, padding],
  );
  const breathe = useSharedValue(1);
  const runner = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(onComplete, alignmentEffects.effectDisplayDuration);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    const half = breathingDuration / 2;
    const easing = Easing.inOut(Easing.sin);
    breathe.animate(
      withSequence(
        withTiming(0, { duration: half, easing }),
        withRepeat(
          withSequence(
            withTiming(1, { duration: half, easing }),
            withTiming(0, { duration: half, easing }),
          ),
        ),
      ),
    );
    runner.animate(
      withRepeat(withTiming(1, { duration: breathingDuration * 2, easing: Easing.linear })),
    );
  }, [breathe, runner, breathingDuration]);

  const build: ArtBuilder = (root) => {
    const [blurMin, blurMax] = SK.breathingBlurRange;
    const [strokeMin, strokeMax] = SK.breathingStrokeRange;
    const borderBlur = blurFilter(blurMin);
    const border = graphicsLayer(root, { blur: borderBlur, screen: true });
    const runners = graphicsLayer(root, { blur: 6, screen: true });
    const width = rect.width + padding;
    const height = rect.height + padding;
    const perimeter = 2 * width + 2 * height;
    return () => {
      const b = breathe.get();
      setBlurSigma(borderBlur, blurMin + b * (blurMax - blurMin));
      border.alpha = 0.4 + b * 0.4;
      border
        .clear()
        .roundRect(padding, padding, width, height, CARD_RADIUS)
        .stroke({ color, width: strokeMin + b * (strokeMax - strokeMin) });
      runners.clear();
      for (let i = 0; i < RUNNER_COUNT; i++) {
        const t = ((runner.get() + i / RUNNER_COUNT) % 1) * perimeter;
        let x: number;
        let y: number;
        if (t < width) {
          x = padding + t;
          y = padding;
        } else if (t < width + height) {
          x = padding + width;
          y = padding + (t - width);
        } else if (t < 2 * width + height) {
          x = padding + width - (t - width - height);
          y = padding + height;
        } else {
          x = padding;
          y = padding + height - (t - 2 * width - height);
        }
        runners.circle(x, y, 3).fill({ color: glowColor, alpha: 0.7 });
      }
    };
  };
  useFrameArt({ zIndex, rect: canvasRect }, build);
  return null;
}
