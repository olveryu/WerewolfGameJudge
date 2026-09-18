/** Legendary frame highlight; one slow edge sweep without changing the frame silhouette. */
import { memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { useLoopProgress } from '@/features/product/hooks/useLoopProgress';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const ORBIT_DURATION = 7000;
const FRAME_SIDE = 100;
const HIGHLIGHT_LENGTH = 12;

interface LegendaryShimmerProps {
  /** SVG total size (with viewBox expansion, = avatar size * 116/100) */
  size: number;
  /** Main border corner radius (viewBox units) */
  rx: number;
}

/** Adds a single restrained highlight to a legendary frame's rounded perimeter. */
export const LegendaryShimmer = memo<LegendaryShimmerProps>(({ size, rx }) => {
  const progress = useLoopProgress(ORBIT_DURATION);
  const cornerRadius = Math.min(rx, FRAME_SIDE / 2);
  const perimeter = FRAME_SIDE * 4 - (8 - 2 * Math.PI) * cornerRadius;
  const highlightProps = useAnimatedProps(() => ({
    strokeDashoffset: -progress.value * perimeter,
  }));

  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <AnimatedRect
        x={0}
        y={0}
        width={FRAME_SIDE}
        height={FRAME_SIDE}
        rx={cornerRadius}
        fill="none"
        stroke="#FFFDE8"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeDasharray={`${HIGHLIGHT_LENGTH} ${perimeter - HIGHLIGHT_LENGTH}`}
        opacity={0.45}
        animatedProps={highlightProps}
      />
    </Svg>
  );
});
LegendaryShimmer.displayName = 'LegendaryShimmer';
