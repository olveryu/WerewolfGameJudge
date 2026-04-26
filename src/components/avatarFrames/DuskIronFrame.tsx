import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * DuskIronFrame — 暮铁
 *
 * 锻铁栅栏框 · 粗壮铆钉沿边 · 四角铁蝴蝶结锁扣（大三角对）· 铁锈色渐变。
 */
export const DuskIronFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `diM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6A6A70" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#3A3A40" stopOpacity={1} />
          <Stop offset="0.6" stopColor="#2A2A30" stopOpacity={1} />
          <Stop offset="1" stopColor="#6A6A70" stopOpacity={0.9} />
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
        stroke="#0A0A10"
        strokeWidth={6.5}
        opacity={0.18}
      />
      {/* Main iron frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={5.5}
      />
      {/* Inner rail */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#5A5A60"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Corner iron brackets — large, visible at thumbnail */}
      <Path
        d="M-4,-4 L8,-4 L-4,8 Z"
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Path
        d="M104,-4 L92,-4 L104,8 Z"
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Path
        d="M-4,104 L8,104 L-4,92 Z"
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Path
        d="M104,104 L92,104 L104,92 Z"
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.8}
        opacity={0.8}
      />
      {/* Large rivets along edges */}
      <Circle
        cx={25}
        cy={-1}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={50}
        cy={-1}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={75}
        cy={-1}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={25}
        cy={101}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={50}
        cy={101}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={75}
        cy={101}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={-1}
        cy={25}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={-1}
        cy={50}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={-1}
        cy={75}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={101}
        cy={25}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={101}
        cy={50}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Circle
        cx={101}
        cy={75}
        r={2.5}
        fill="#4A4A50"
        stroke="#7A7A80"
        strokeWidth={0.6}
        opacity={0.75}
      />
      {/* Rivet highlights */}
      <Circle cx={25} cy={-1.5} r={0.8} fill="#9A9AA0" opacity={0.6} />
      <Circle cx={50} cy={-1.5} r={0.8} fill="#9A9AA0" opacity={0.6} />
      <Circle cx={75} cy={-1.5} r={0.8} fill="#9A9AA0" opacity={0.6} />
      {/* Rust streaks */}
      <Path d="M10,0 L12,3" stroke="#8B5A2B" strokeWidth={1} opacity={0.35} strokeLinecap="round" />
      <Path
        d="M88,100 L90,97"
        stroke="#8B5A2B"
        strokeWidth={1}
        opacity={0.35}
        strokeLinecap="round"
      />
    </Svg>
  );
});
DuskIronFrame.displayName = 'DuskIronFrame';
