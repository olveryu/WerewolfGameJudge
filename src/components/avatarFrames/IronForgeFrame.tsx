import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const IronForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const ironGrad = `ironGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={ironGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B7355" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#5A4A38" stopOpacity={1} />
          <Stop offset="1" stopColor="#3A3028" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
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
        opacity={0.7}
      />
      {/* Corner L-brackets */}
      <Path
        d="M0,15 L0,0 L15,0"
        fill="none"
        stroke="#A08A68"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M85,0 L100,0 L100,15"
        fill="none"
        stroke="#A08A68"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M0,85 L0,100 L15,100"
        fill="none"
        stroke="#A08A68"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M85,100 L100,100 L100,85"
        fill="none"
        stroke="#A08A68"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* 4 large corner rivets — overflow */}
      <Circle cx={-1} cy={-1} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={101} cy={-1} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={-1} cy={101} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      <Circle cx={101} cy={101} r={3.5} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
      {/* Rivet highlights */}
      <Circle cx={-2} cy={-2} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={102} cy={-2} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={-2} cy={102} r={1} fill="#B8A080" opacity={0.6} />
      <Circle cx={102} cy={102} r={1} fill="#B8A080" opacity={0.6} />
      {/* Edge mid-rivets */}
      <Circle cx={50} cy={-1} r={2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={50} cy={101} r={2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={-1} cy={50} r={2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
      <Circle cx={101} cy={50} r={2} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
    </Svg>
  );
});
IronForgeFrame.displayName = 'IronForgeFrame';
