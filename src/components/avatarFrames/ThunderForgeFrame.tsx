import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ThunderForgeFrame — 雷锻
 *
 * 北欧锻造风 · 凯尔特结沿边 · 闪电锤/雷神锤角饰 · 符文刻痕 · 电弧高光。
 */
export const ThunderForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `tfM${userId}`;
  const arcG = `tfA${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5A5A68" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#38384A" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#28283A" stopOpacity={1} />
          <Stop offset="1" stopColor="#5A5A68" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={arcG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0.3} />
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
        stroke="#0A0A15"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Main anvil frame */}
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
      {/* Arc glow */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${arcG})`}
        strokeWidth={1.5}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#38384A"
        strokeWidth={0.7}
        opacity={0.4}
      />
      {/* Celtic knot pattern — top edge (interlocking loops) */}
      <G opacity={0.4} fill="none" stroke="#6A6A78" strokeWidth={0.7}>
        <Path d="M15,0 Q18,-3 21,0 Q24,3 27,0 Q30,-3 33,0" />
        <Path d="M40,0 Q43,-3 46,0 Q49,3 52,0 Q55,-3 58,0" />
        <Path d="M65,0 Q68,-3 71,0 Q74,3 77,0 Q80,-3 83,0" />
      </G>
      {/* Celtic knot — bottom edge */}
      <G opacity={0.4} fill="none" stroke="#6A6A78" strokeWidth={0.7}>
        <Path d="M15,100 Q18,103 21,100 Q24,97 27,100 Q30,103 33,100" />
        <Path d="M40,100 Q43,103 46,100 Q49,97 52,100 Q55,103 58,100" />
        <Path d="M65,100 Q68,103 71,100 Q74,97 77,100 Q80,103 83,100" />
      </G>
      {/* Hammer — top-left corner */}
      <G opacity={0.5}>
        {/* Handle */}
        <Line x1={-4} y1={-4} x2={3} y2={3} stroke="#8A8A98" strokeWidth={1} />
        {/* Head */}
        <Rect x={-7} y={-7} width={5} height={3} fill="#6A6A78" rx={0.5} />
      </G>
      {/* Hammer — bottom-right corner */}
      <G opacity={0.5}>
        <Line x1={104} y1={104} x2={97} y2={97} stroke="#8A8A98" strokeWidth={1} />
        <Rect x={102} y={104} width={5} height={3} fill="#6A6A78" rx={0.5} />
      </G>
      {/* Rune carvings along edges */}
      <G opacity={0.4} fill="none" stroke="#8A8A98" strokeWidth={0.5}>
        {/* Tiwaz-like (arrow up) */}
        <Path d="M-2,30 L0,26 L2,30 M0,26 L0,34" />
        {/* Ansuz-like */}
        <Path d="M-2,55 L0,52 L2,55 M-2,58 L0,55 L2,58" />
        {/* Thurisaz-like (thorn) */}
        <Path d="M98,30 L100,28 L102,30 Q104,32 102,34 L100,32 Z" />
        {/* Berkana-like */}
        <Path d="M100,55 L100,62 M100,55 Q103,57 100,59 M100,59 Q103,61 100,62" />
      </G>
      {/* Lightning arc — left to right across top */}
      <Path
        d="M8,-4 L12,-2 L10,0 L15,-1 L13,1 L18,0"
        fill="none"
        stroke="#FFD700"
        strokeWidth={0.6}
        opacity={0.45}
        strokeLinecap="round"
      />
      {/* Lightning spark — bottom */}
      <Path
        d="M82,103 L85,101 L83,100 L88,101"
        fill="none"
        stroke="#FFD700"
        strokeWidth={0.5}
        opacity={0.4}
      />
      {/* Electric spark dots */}
      <G opacity={0.55}>
        <Circle cx={-3} cy={15} r={0.6} fill="#FFD700" />
        <Circle cx={103} cy={85} r={0.6} fill="#FFD700" />
        <Circle cx={50} cy={-4} r={0.5} fill="#FFFFFF" />
        <Circle cx={50} cy={104} r={0.5} fill="#FFFFFF" />
      </G>
    </Svg>
  );
});
ThunderForgeFrame.displayName = 'ThunderForgeFrame';
