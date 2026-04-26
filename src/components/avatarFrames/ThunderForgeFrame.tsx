import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ThunderForgeFrame — 雷锻
 *
 * 钴蓝雷电框 · Z字闪电从边缘劈出 · 电弧光球 · 金属蓝渐变。
 */
export const ThunderForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `tfM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#2980B9" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#1A5276" stopOpacity={1} />
          <Stop offset="1" stopColor="#2980B9" stopOpacity={0.9} />
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
        stroke="#0A1A30"
        strokeWidth={6}
        opacity={0.15}
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
      {/* Inner electric line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Z-bolt lightning — top left */}
      <Path
        d="M15,-5 L20,-1 L12,3 L22,0"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.8}
        opacity={0.85}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
      {/* Z-bolt — top right */}
      <Path
        d="M85,-5 L80,-1 L88,3 L78,0"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.8}
        opacity={0.85}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
      {/* Z-bolt — bottom left */}
      <Path
        d="M15,105 L20,101 L12,97 L22,100"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.8}
        opacity={0.85}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
      {/* Z-bolt — bottom right */}
      <Path
        d="M85,105 L80,101 L88,97 L78,100"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.8}
        opacity={0.85}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
      {/* Side lightning forks */}
      <Path
        d="M-4,35 L2,38 L-2,42 L4,40"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.3}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M-4,65 L2,62 L-2,58 L4,60"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.3}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M104,30 L98,33 L102,37 L96,35"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.3}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M104,70 L98,67 L102,63 L96,65"
        fill="none"
        stroke="#F4D03F"
        strokeWidth={1.3}
        opacity={0.7}
        strokeLinecap="round"
      />
      {/* Lightning glow echo */}
      <Path d="M15,-5 L20,-1 L12,3" fill="none" stroke="#FDEBD0" strokeWidth={0.5} opacity={0.4} />
      <Path d="M85,-5 L80,-1 L88,3" fill="none" stroke="#FDEBD0" strokeWidth={0.5} opacity={0.4} />
      {/* Arc orbs */}
      <Circle
        cx={50}
        cy={-3}
        r={2.5}
        fill="#1A5276"
        stroke="#5DADE2"
        strokeWidth={1}
        opacity={0.7}
      />
      <Circle cx={50} cy={-3} r={1} fill="#AED6F1" opacity={0.8} />
      <Circle
        cx={50}
        cy={103}
        r={2.5}
        fill="#1A5276"
        stroke="#5DADE2"
        strokeWidth={1}
        opacity={0.7}
      />
      <Circle cx={50} cy={103} r={1} fill="#AED6F1" opacity={0.8} />
      <Circle
        cx={-3}
        cy={50}
        r={2}
        fill="#1A5276"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <Circle
        cx={103}
        cy={50}
        r={2}
        fill="#1A5276"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
    </Svg>
  );
});
ThunderForgeFrame.displayName = 'ThunderForgeFrame';
