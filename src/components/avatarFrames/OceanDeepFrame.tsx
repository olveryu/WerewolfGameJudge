import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * OceanDeepFrame — 深海
 *
 * 深海蓝框 · 触手从四角和边缘向外蜷曲 · 气泡链 · 深渊发光点。
 */
export const OceanDeepFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `odM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A5276" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#0E3651" stopOpacity={1} />
          <Stop offset="1" stopColor="#1A5276" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Base frame */}
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
      {/* Inner bioluminescent line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#2E86C1"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Tentacles from corners — bold, curling outward */}
      <Path
        d="M-2,-2 Q-8,5 -6,12 Q-4,8 -1,5"
        fill="none"
        stroke="#1A5276"
        strokeWidth={2.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M-2,0 Q-10,8 -7,15"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,-2 Q108,5 106,12 Q104,8 101,5"
        fill="none"
        stroke="#1A5276"
        strokeWidth={2.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M102,0 Q110,8 107,15"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M-2,102 Q-8,95 -6,88 Q-4,92 -1,95"
        fill="none"
        stroke="#1A5276"
        strokeWidth={2.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M-2,100 Q-10,92 -7,85"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,102 Q108,95 106,88 Q104,92 101,95"
        fill="none"
        stroke="#1A5276"
        strokeWidth={2.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      {/* Wave tentacles along top */}
      <Path
        d="M25,-1 Q30,-6 35,-1"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.5}
        opacity={0.65}
        strokeLinecap="round"
      />
      <Path
        d="M55,-1 Q60,-5 65,-1"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.5}
        opacity={0.65}
        strokeLinecap="round"
      />
      {/* Wave tentacles along bottom */}
      <Path
        d="M30,101 Q35,106 40,101"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.5}
        opacity={0.65}
        strokeLinecap="round"
      />
      <Path
        d="M60,101 Q65,105 70,101"
        fill="none"
        stroke="#2E86C1"
        strokeWidth={1.5}
        opacity={0.65}
        strokeLinecap="round"
      />
      {/* Bubble chains */}
      <Circle cx={-4} cy={30} r={2} fill="none" stroke="#5DADE2" strokeWidth={0.7} opacity={0.6} />
      <Circle
        cx={-5}
        cy={25}
        r={1.5}
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.6}
        opacity={0.5}
      />
      <Circle cx={-6} cy={21} r={1} fill="none" stroke="#5DADE2" strokeWidth={0.5} opacity={0.4} />
      <Circle cx={104} cy={70} r={2} fill="none" stroke="#5DADE2" strokeWidth={0.7} opacity={0.6} />
      <Circle
        cx={105}
        cy={75}
        r={1.5}
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.6}
        opacity={0.5}
      />
      <Circle cx={106} cy={79} r={1} fill="none" stroke="#5DADE2" strokeWidth={0.5} opacity={0.4} />
      {/* Bioluminescent glow dots */}
      <Circle cx={15} cy={-3} r={1.2} fill="#5DADE2" opacity={0.7} />
      <Circle cx={85} cy={103} r={1.2} fill="#5DADE2" opacity={0.7} />
      <Circle cx={50} cy={-3} r={1.5} fill="#AED6F1" opacity={0.6} />
      <Circle cx={50} cy={103} r={1.5} fill="#AED6F1" opacity={0.6} />
    </Svg>
  );
});
OceanDeepFrame.displayName = 'OceanDeepFrame';
