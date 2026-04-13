import { memo, useId } from 'react';
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * JadeSealFrame — 玉印
 *
 * 温润古玉 · 如意云纹角饰 · 厚实翠框 + 篆刻印章 + 玉光泽。
 */
export const JadeSealFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const jadeGrad = `jadeG${uid}`;
  const sheenGrad = `jadeSh${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={jadeGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6BC087" stopOpacity={0.85} />
          <Stop offset="0.35" stopColor="#388E4E" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#2D7A42" stopOpacity={1} />
          <Stop offset="1" stopColor="#6BC087" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={sheenGrad} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#A8D8B7" stopOpacity={0} />
          <Stop offset="0.3" stopColor="#C8ECD5" stopOpacity={0.4} />
          <Stop offset="0.5" stopColor="#A8D8B7" stopOpacity={0} />
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
        stroke="#0A2010"
        strokeWidth={6.5}
        opacity={0.15}
      />
      {/* Thick jade frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${jadeGrad})`}
        strokeWidth={5.5}
      />
      {/* Sheen highlight */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sheenGrad})`}
        strokeWidth={2}
      />
      {/* Inner carving groove */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#2D7A42"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Ruyi cloud corners — top-left */}
      <Path
        d="M8,0 Q-2,-4 -4,0 Q-2,2 0,0 Q2,-2 8,0"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      <Path
        d="M0,8 Q-4,-2 0,-4 Q2,-2 0,0 Q-2,2 0,8"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      {/* Ruyi — top-right */}
      <Path
        d="M92,0 Q102,-4 104,0 Q102,2 100,0 Q98,-2 92,0"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      <Path
        d="M100,8 Q104,-2 100,-4 Q98,-2 100,0 Q102,2 100,8"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      {/* Ruyi — bottom-left */}
      <Path
        d="M8,100 Q-2,104 -4,100 Q-2,98 0,100 Q2,102 8,100"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      <Path
        d="M0,92 Q-4,102 0,104 Q2,102 0,100 Q-2,98 0,92"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      {/* Ruyi — bottom-right */}
      <Path
        d="M92,100 Q102,104 104,100 Q102,98 100,100 Q98,102 92,100"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      <Path
        d="M100,92 Q104,102 100,104 Q98,102 100,100 Q102,98 100,92"
        fill="#4AAE6A"
        opacity={0.45}
        stroke="#2D7A42"
        strokeWidth={0.4}
      />
      {/* Top seal stamp */}
      <Rect
        x={36}
        y={-4}
        width={28}
        height={7}
        rx={1.5}
        fill="none"
        stroke="#2D7A42"
        strokeWidth={0.7}
        opacity={0.5}
      />
      <G opacity={0.5} stroke="#1A5A2A" strokeWidth={0.5}>
        <Line x1={40} y1={-2} x2={40} y2={1} />
        <Line x1={44} y1={-2} x2={44} y2={1} />
        <Line x1={48} y1={-2} x2={48} y2={1} />
        <Line x1={52} y1={-2} x2={52} y2={1} />
        <Line x1={56} y1={-2} x2={56} y2={1} />
        <Line x1={60} y1={-2} x2={60} y2={1} />
      </G>
      {/* Bottom seal stamp */}
      <Rect
        x={36}
        y={97}
        width={28}
        height={7}
        rx={1.5}
        fill="none"
        stroke="#2D7A42"
        strokeWidth={0.7}
        opacity={0.5}
      />
      <G opacity={0.5} stroke="#1A5A2A" strokeWidth={0.5}>
        <Line x1={40} y1={99} x2={40} y2={102} />
        <Line x1={44} y1={99} x2={44} y2={102} />
        <Line x1={48} y1={99} x2={48} y2={102} />
        <Line x1={52} y1={99} x2={52} y2={102} />
        <Line x1={56} y1={99} x2={56} y2={102} />
        <Line x1={60} y1={99} x2={60} y2={102} />
      </G>
      {/* Jade sheen highlights */}
      <Line
        x1={12}
        y1={2}
        x2={35}
        y2={2}
        stroke="#C8ECD5"
        strokeWidth={0.7}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Line
        x1={65}
        y1={98}
        x2={88}
        y2={98}
        stroke="#C8ECD5"
        strokeWidth={0.7}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Line
        x1={2}
        y1={30}
        x2={2}
        y2={50}
        stroke="#C8ECD5"
        strokeWidth={0.5}
        opacity={0.2}
        strokeLinecap="round"
      />
      {/* Meander accents on sides */}
      <Path
        d="M0,30 L-2,30 L-2,34 L0,34"
        fill="none"
        stroke="#388E4E"
        strokeWidth={0.5}
        opacity={0.3}
      />
      <Path
        d="M0,42 L-2,42 L-2,46 L0,46"
        fill="none"
        stroke="#388E4E"
        strokeWidth={0.5}
        opacity={0.3}
      />
      <Path
        d="M100,54 L102,54 L102,58 L100,58"
        fill="none"
        stroke="#388E4E"
        strokeWidth={0.5}
        opacity={0.3}
      />
      <Path
        d="M100,66 L102,66 L102,70 L100,70"
        fill="none"
        stroke="#388E4E"
        strokeWidth={0.5}
        opacity={0.3}
      />
    </Svg>
  );
});
JadeSealFrame.displayName = 'JadeSealFrame';
