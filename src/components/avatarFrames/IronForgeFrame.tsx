import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const IronForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const ironGrad = `ironGrad${uid}`;
  const glowGrad = `forgeGlow${uid}`;
  const c = rx * 0.29;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={ironGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B7355" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#5A4A38" stopOpacity={1} />
          <Stop offset="1" stopColor="#3A3028" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={glowGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF8C00" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#FF4500" stopOpacity={0.2} />
        </LinearGradient>
      </Defs>
      {/* Forge glow arcs at corners */}
      <Path
        d={`M0,${rx} Q0,0 ${rx},0`}
        fill="none"
        stroke={`url(#${glowGrad})`}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d={`M${100 - rx},0 Q100,0 100,${rx}`}
        fill="none"
        stroke={`url(#${glowGrad})`}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d={`M0,${100 - rx} Q0,100 ${rx},100`}
        fill="none"
        stroke={`url(#${glowGrad})`}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.4}
      />
      <Path
        d={`M${100 - rx},100 Q100,100 100,${100 - rx}`}
        fill="none"
        stroke={`url(#${glowGrad})`}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* Outer thick border — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${ironGrad})`}
        strokeWidth={4}
      />
      {/* Inner thin border */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#5A4A38"
        strokeWidth={1.5}
        opacity={0.85}
      />
      {/* Corner brackets — curved to follow rx, thicker */}
      <Path
        d={`M0,${rx} Q0,0 ${rx},0`}
        fill="none"
        stroke="#A08A68"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M${100 - rx},0 Q100,0 100,${rx}`}
        fill="none"
        stroke="#A08A68"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M0,${100 - rx} Q0,100 ${rx},100`}
        fill="none"
        stroke="#A08A68"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M${100 - rx},100 Q100,100 100,${100 - rx}`}
        fill="none"
        stroke="#A08A68"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Hammer scratch marks along edges */}
      <G opacity={0.35} stroke="#A08A68" strokeWidth={0.8} strokeLinecap="round">
        <Line x1={30} y1={1} x2={34} y2={-1} />
        <Line x1={66} y1={1} x2={70} y2={-1} />
        <Line x1={30} y1={99} x2={34} y2={101} />
        <Line x1={66} y1={99} x2={70} y2={101} />
        <Line x1={1} y1={30} x2={-1} y2={34} />
        <Line x1={1} y1={66} x2={-1} y2={70} />
        <Line x1={99} y1={30} x2={101} y2={34} />
        <Line x1={99} y1={66} x2={101} y2={70} />
      </G>
      {/* 4 large corner rivets — on corner arc */}
      <Circle cx={c - 1} cy={c - 1} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={101 - c} cy={c - 1} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={c - 1} cy={101 - c} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={101 - c} cy={101 - c} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      {/* Rivet highlights */}
      <Circle cx={c - 2} cy={c - 2} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={102 - c} cy={c - 2} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={c - 2} cy={102 - c} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={102 - c} cy={102 - c} r={1} fill="#B8A080" opacity={0.6} />
      {/* Edge mid-rivets */}
      <Circle cx={50} cy={-1} r={2.2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={50} cy={101} r={2.2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={-1} cy={50} r={2.2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={101} cy={50} r={2.2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      {/* Quarter-edge rivets */}
      <Circle cx={25} cy={-1} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={75} cy={-1} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={25} cy={101} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={75} cy={101} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={-1} cy={25} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={-1} cy={75} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={101} cy={25} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
      <Circle cx={101} cy={75} r={1.5} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.5} />
    </Svg>
  );
});
IronForgeFrame.displayName = 'IronForgeFrame';
