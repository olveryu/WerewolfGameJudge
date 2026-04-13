import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ShadowWeaveFrame — 影织
 *
 * 暗影编织 · 双层交错波纹 · 凯尔特角结 + 十字缝合。
 */
export const ShadowWeaveFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const shwGrad = `shwG${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={shwGrad} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#303030" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#1A1A1A" stopOpacity={1} />
          <Stop offset="1" stopColor="#303030" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Deep shadow */}
      <Rect
        x={2}
        y={2}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#000"
        strokeWidth={5}
        opacity={0.3}
      />
      {/* Main dark frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${shwGrad})`}
        strokeWidth={4.5}
      />
      {/* Inner frame */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#3A3A3A"
        strokeWidth={0.6}
        opacity={0.5}
      />
      {/* Woven pattern A (sine wave) — top */}
      <Path
        d="M15,1 Q20,-3 25,1 Q30,-3 35,1 Q40,-3 45,1 Q50,-3 55,1 Q60,-3 65,1 Q70,-3 75,1 Q80,-3 85,1"
        fill="none"
        stroke="#666"
        strokeWidth={1.2}
        opacity={0.55}
      />
      {/* Woven pattern B (inverse) — top */}
      <Path
        d="M15,1 Q20,5 25,1 Q30,5 35,1 Q40,5 45,1 Q50,5 55,1 Q60,5 65,1 Q70,5 75,1 Q80,5 85,1"
        fill="none"
        stroke="#444"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Bottom weave A + B */}
      <Path
        d="M15,99 Q20,103 25,99 Q30,103 35,99 Q40,103 45,99 Q50,103 55,99 Q60,103 65,99 Q70,103 75,99 Q80,103 85,99"
        fill="none"
        stroke="#666"
        strokeWidth={1.2}
        opacity={0.55}
      />
      <Path
        d="M15,99 Q20,95 25,99 Q30,95 35,99 Q40,95 45,99 Q50,95 55,99 Q60,95 65,99 Q70,95 75,99 Q80,95 85,99"
        fill="none"
        stroke="#444"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Left weave A + B */}
      <Path
        d="M1,15 Q-3,20 1,25 Q-3,30 1,35 Q-3,40 1,45 Q-3,50 1,55 Q-3,60 1,65 Q-3,70 1,75 Q-3,80 1,85"
        fill="none"
        stroke="#666"
        strokeWidth={1.2}
        opacity={0.55}
      />
      <Path
        d="M1,15 Q5,20 1,25 Q5,30 1,35 Q5,40 1,45 Q5,50 1,55 Q5,60 1,65 Q5,70 1,75 Q5,80 1,85"
        fill="none"
        stroke="#444"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Right weave A + B */}
      <Path
        d="M99,15 Q103,20 99,25 Q103,30 99,35 Q103,40 99,45 Q103,50 99,55 Q103,60 99,65 Q103,70 99,75 Q103,80 99,85"
        fill="none"
        stroke="#666"
        strokeWidth={1.2}
        opacity={0.55}
      />
      <Path
        d="M99,15 Q95,20 99,25 Q95,30 99,35 Q95,40 99,45 Q95,50 99,55 Q95,60 99,65 Q95,70 99,75 Q95,80 99,85"
        fill="none"
        stroke="#444"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Corner knots — celtic ring (3 concentric circles + core dot) */}
      <G opacity={0.6}>
        <Circle cx={0} cy={0} r={4} fill="none" stroke="#777" strokeWidth={1.2} />
        <Circle cx={0} cy={0} r={2} fill="none" stroke="#555" strokeWidth={0.8} />
        <Circle cx={0} cy={0} r={0.8} fill="#888" />
      </G>
      <G opacity={0.6}>
        <Circle cx={100} cy={0} r={4} fill="none" stroke="#777" strokeWidth={1.2} />
        <Circle cx={100} cy={0} r={2} fill="none" stroke="#555" strokeWidth={0.8} />
        <Circle cx={100} cy={0} r={0.8} fill="#888" />
      </G>
      <G opacity={0.6}>
        <Circle cx={0} cy={100} r={4} fill="none" stroke="#777" strokeWidth={1.2} />
        <Circle cx={0} cy={100} r={2} fill="none" stroke="#555" strokeWidth={0.8} />
        <Circle cx={0} cy={100} r={0.8} fill="#888" />
      </G>
      <G opacity={0.6}>
        <Circle cx={100} cy={100} r={4} fill="none" stroke="#777" strokeWidth={1.2} />
        <Circle cx={100} cy={100} r={2} fill="none" stroke="#555" strokeWidth={0.8} />
        <Circle cx={100} cy={100} r={0.8} fill="#888" />
      </G>
      {/* Mid-edge cross-stitch marks */}
      <G opacity={0.4} stroke="#888" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={48} y1={-1} x2={52} y2={3} />
        <Line x1={52} y1={-1} x2={48} y2={3} />
        <Line x1={48} y1={97} x2={52} y2={101} />
        <Line x1={52} y1={97} x2={48} y2={101} />
        <Line x1={-1} y1={48} x2={3} y2={52} />
        <Line x1={-1} y1={52} x2={3} y2={48} />
        <Line x1={97} y1={48} x2={101} y2={52} />
        <Line x1={97} y1={52} x2={101} y2={48} />
      </G>
    </Svg>
  );
});
ShadowWeaveFrame.displayName = 'ShadowWeaveFrame';
