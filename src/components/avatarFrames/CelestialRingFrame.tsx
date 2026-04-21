import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CelestialRingFrame — 天环
 *
 * 神圣天界之环 · 径向光晕 · 8方向光线 + 菱形宝石 + 圆宝石。
 */
export const CelestialRingFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const celGrad = `celG${userId}`;
  const celHalo = `celH${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={celGrad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#FFA500" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0.95} />
        </LinearGradient>
        <RadialGradient id={celHalo} cx="50%" cy="50%" r="58%">
          <Stop offset="0.55" stopColor="#FFD700" stopOpacity={0} />
          <Stop offset="0.75" stopColor="#FFD700" stopOpacity={0.08} />
          <Stop offset="0.9" stopColor="#FFD700" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Divine halo */}
      <Circle cx={50} cy={50} r={62} fill={`url(#${celHalo})`} />
      {/* Outer glow ring */}
      <Rect
        x={-3}
        y={-3}
        width={106}
        height={106}
        rx={rx + 3}
        fill="none"
        stroke="#FFD700"
        strokeWidth={0.8}
        opacity={0.35}
      />
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#6B4E00"
        strokeWidth={4}
        opacity={0.2}
      />
      {/* Main gold frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${celGrad})`}
        strokeWidth={3}
      />
      {/* Inner ring */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#FFA500"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Light rays — 4 diagonal directions */}
      <G stroke="#FFD700" strokeLinecap="round" opacity={0.5}>
        <Line x1={-1} y1={-1} x2={-7} y2={-7} strokeWidth={1.2} />
        <Line x1={101} y1={-1} x2={107} y2={-7} strokeWidth={1.2} />
        <Line x1={-1} y1={101} x2={-7} y2={107} strokeWidth={1.2} />
        <Line x1={101} y1={101} x2={107} y2={107} strokeWidth={1.2} />
      </G>
      {/* Light rays — 4 cardinal directions */}
      <G stroke="#FFD700" strokeLinecap="round" opacity={0.4}>
        <Line x1={50} y1={-1} x2={50} y2={-8} strokeWidth={1} />
        <Line x1={50} y1={101} x2={50} y2={108} strokeWidth={1} />
        <Line x1={-1} y1={50} x2={-8} y2={50} strokeWidth={1} />
        <Line x1={101} y1={50} x2={108} y2={50} strokeWidth={1} />
      </G>
      {/* Secondary short rays */}
      <G stroke="#FFAA00" strokeLinecap="round" opacity={0.3}>
        <Line x1={25} y1={0} x2={24} y2={-4} />
        <Line x1={75} y1={0} x2={76} y2={-4} />
        <Line x1={25} y1={100} x2={24} y2={104} />
        <Line x1={75} y1={100} x2={76} y2={104} />
        <Line x1={0} y1={25} x2={-4} y2={24} />
        <Line x1={0} y1={75} x2={-4} y2={76} />
        <Line x1={100} y1={25} x2={104} y2={24} />
        <Line x1={100} y1={75} x2={104} y2={76} />
      </G>
      {/* Corner diamond gems with facet line */}
      <G>
        <Path
          d="M0,-1 L-3,-5 L0,-9 L3,-5 Z"
          fill="#FFE066"
          opacity={0.7}
          stroke="#D4AA30"
          strokeWidth={0.5}
        />
        <Line x1={0} y1={-3} x2={0} y2={-7} stroke="#FFF" strokeWidth={0.3} opacity={0.5} />
      </G>
      <G>
        <Path
          d="M100,-1 L97,-5 L100,-9 L103,-5 Z"
          fill="#FFE066"
          opacity={0.7}
          stroke="#D4AA30"
          strokeWidth={0.5}
        />
        <Line x1={100} y1={-3} x2={100} y2={-7} stroke="#FFF" strokeWidth={0.3} opacity={0.5} />
      </G>
      <G>
        <Path
          d="M0,101 L-3,105 L0,109 L3,105 Z"
          fill="#FFE066"
          opacity={0.7}
          stroke="#D4AA30"
          strokeWidth={0.5}
        />
        <Line x1={0} y1={103} x2={0} y2={107} stroke="#FFF" strokeWidth={0.3} opacity={0.5} />
      </G>
      <G>
        <Path
          d="M100,101 L97,105 L100,109 L103,105 Z"
          fill="#FFE066"
          opacity={0.7}
          stroke="#D4AA30"
          strokeWidth={0.5}
        />
        <Line x1={100} y1={103} x2={100} y2={107} stroke="#FFF" strokeWidth={0.3} opacity={0.5} />
      </G>
      {/* Mid-edge round gems */}
      <Circle
        cx={50}
        cy={-3}
        r={2}
        fill="#FFE066"
        stroke="#D4AA30"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Circle cx={50} cy={-3} r={0.7} fill="#FFF" opacity={0.5} />
      <Circle
        cx={50}
        cy={103}
        r={2}
        fill="#FFE066"
        stroke="#D4AA30"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Circle cx={50} cy={103} r={0.7} fill="#FFF" opacity={0.5} />
      <Circle
        cx={-3}
        cy={50}
        r={2}
        fill="#FFE066"
        stroke="#D4AA30"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Circle cx={-3} cy={50} r={0.7} fill="#FFF" opacity={0.5} />
      <Circle
        cx={103}
        cy={50}
        r={2}
        fill="#FFE066"
        stroke="#D4AA30"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Circle cx={103} cy={50} r={0.7} fill="#FFF" opacity={0.5} />
      {/* Corner arc glow */}
      <Path
        d={`M0,${rx} Q0,0 ${rx},0`}
        fill="none"
        stroke="#FFD700"
        strokeWidth={6}
        opacity={0.1}
      />
      <Path
        d={`M${100 - rx},0 Q100,0 100,${rx}`}
        fill="none"
        stroke="#FFD700"
        strokeWidth={6}
        opacity={0.1}
      />
      <Path
        d={`M0,${100 - rx} Q0,100 ${rx},100`}
        fill="none"
        stroke="#FFD700"
        strokeWidth={6}
        opacity={0.1}
      />
      <Path
        d={`M${100 - rx},100 Q100,100 100,${100 - rx}`}
        fill="none"
        stroke="#FFD700"
        strokeWidth={6}
        opacity={0.1}
      />
    </Svg>
  );
});
CelestialRingFrame.displayName = 'CelestialRingFrame';
