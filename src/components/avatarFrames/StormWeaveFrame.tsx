import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * StormWeaveFrame — 风暴织
 *
 * 暴风蓝灰框 · 闪电从四角劈出 · 风旋涡纹 · 电弧节点。
 */
export const StormWeaveFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `swM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5D6D7E" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#2C3E50" stopOpacity={1} />
          <Stop offset="1" stopColor="#5D6D7E" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#0A1520"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Main frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={4.5}
      />
      {/* Lightning bolts from corners */}
      <Path
        d="M-2,-2 L4,-6 L2,2 L8,-3 L5,5"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinejoin="bevel"
      />
      <Path
        d="M102,-2 L96,-6 L98,2 L92,-3 L95,5"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinejoin="bevel"
      />
      <Path
        d="M-2,102 L4,106 L2,98 L8,103 L5,95"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinejoin="bevel"
      />
      <Path
        d="M102,102 L96,106 L98,98 L92,103 L95,95"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinejoin="bevel"
      />
      {/* Secondary lightning glow */}
      <Path d="M-2,-2 L4,-6 L2,2" fill="none" stroke="#FDEBD0" strokeWidth={0.5} opacity={0.5} />
      <Path d="M102,-2 L96,-6 L98,2" fill="none" stroke="#FDEBD0" strokeWidth={0.5} opacity={0.5} />
      {/* Wind spiral arcs — top */}
      <Path
        d="M20,0 Q25,-4 30,-2 Q35,-5 40,0"
        fill="none"
        stroke="#85929E"
        strokeWidth={1.2}
        opacity={0.6}
      />
      <Path
        d="M55,0 Q60,-4 65,-2 Q70,-5 75,0"
        fill="none"
        stroke="#85929E"
        strokeWidth={1.2}
        opacity={0.6}
      />
      {/* Wind spiral arcs — bottom */}
      <Path
        d="M25,100 Q30,104 35,102 Q40,105 45,100"
        fill="none"
        stroke="#85929E"
        strokeWidth={1.2}
        opacity={0.6}
      />
      <Path
        d="M60,100 Q65,104 70,102 Q75,105 80,100"
        fill="none"
        stroke="#85929E"
        strokeWidth={1.2}
        opacity={0.6}
      />
      {/* Side wind marks */}
      <Path d="M0,25 Q-3,30 0,35" fill="none" stroke="#85929E" strokeWidth={1} opacity={0.5} />
      <Path d="M0,60 Q-3,65 0,70" fill="none" stroke="#85929E" strokeWidth={1} opacity={0.5} />
      <Path d="M100,30 Q103,35 100,40" fill="none" stroke="#85929E" strokeWidth={1} opacity={0.5} />
      <Path d="M100,65 Q103,70 100,75" fill="none" stroke="#85929E" strokeWidth={1} opacity={0.5} />
      {/* Arc nodes */}
      <Circle cx={0} cy={0} r={2} fill="#F4D03F" opacity={0.6} />
      <Circle cx={100} cy={0} r={2} fill="#F4D03F" opacity={0.6} />
      <Circle cx={0} cy={100} r={2} fill="#F4D03F" opacity={0.6} />
      <Circle cx={100} cy={100} r={2} fill="#F4D03F" opacity={0.6} />
    </Svg>
  );
});
StormWeaveFrame.displayName = 'StormWeaveFrame';
