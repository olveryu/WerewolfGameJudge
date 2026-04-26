import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WildBriarFrame — 野荆
 *
 * 缠绕式荆棘: 一条连续的粗干从左下角起步，沿四边缠绕一周（每段不同弯曲）。
 * 四角 = 荆棘打结(tangle knot loop path)。每边有倒钩刺(closed triangle fills)。
 * 浆果簇(3-berry closed-path 填充) + 叶片(tear-drop closed path)。
 * 与 ThornCrown 完全不同: 无 Q-wave vine, 无 rose accent, 采用连续缠绕+结+填充刺。
 */
export const WildBriarFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wbM${userId}`;
  const briarG = `wbBr${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5A4030" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#3A2818" stopOpacity={1} />
          <Stop offset="1" stopColor="#5A4030" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={briarG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6A4830" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#3A2818" stopOpacity={0} />
          <Stop offset="1" stopColor="#6A4830" stopOpacity={0.3} />
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
        stroke="#150A05"
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
        strokeWidth={5}
      />
      {/* Bark tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${briarG})`}
        strokeWidth={1.8}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#3A2818"
        strokeWidth={0.6}
        opacity={0.4}
      />

      {/* ── Continuous wrapping briar stem — starts bottom-left, wraps clockwise ── */}
      {/* Bottom edge — undulating thick branch */}
      <Path
        d="M-4,100 C8,108 18,96 30,102 C42,108 55,95 68,102 C78,107 90,97 104,100"
        fill="none"
        stroke="#4A3420"
        strokeWidth={2}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Right edge — climbing with different curvature */}
      <Path
        d="M104,100 C108,88 96,78 103,65 C110,52 96,42 103,30 C108,20 98,10 104,0"
        fill="none"
        stroke="#4A3420"
        strokeWidth={1.8}
        opacity={0.55}
        strokeLinecap="round"
      />
      {/* Top edge */}
      <Path
        d="M104,0 C92,-6 82,4 70,-2 C58,-8 48,2 38,-3 C28,-8 15,2 -4,0"
        fill="none"
        stroke="#4A3420"
        strokeWidth={2}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Left edge — descending */}
      <Path
        d="M-4,0 C-8,12 4,22 -3,35 C-10,48 4,58 -3,70 C-8,80 2,90 -4,100"
        fill="none"
        stroke="#4A3420"
        strokeWidth={1.8}
        opacity={0.55}
        strokeLinecap="round"
      />

      {/* ── Corner knots — looping tangles (closed irregular loops) ── */}
      {/* Top-left knot */}
      <Path
        d="M-2,-2 C-5,-6 3,-8 5,-4 C7,0 -1,3 -3,0 C-5,-3 1,-5 -2,-2 Z"
        fill="#3A2818"
        fillOpacity={0.25}
        stroke="#5A4030"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Top-right knot */}
      <Path
        d="M102,-2 C105,-6 97,-8 95,-4 C93,0 101,3 103,0 C105,-3 99,-5 102,-2 Z"
        fill="#3A2818"
        fillOpacity={0.25}
        stroke="#5A4030"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Bottom-left knot */}
      <Path
        d="M-2,102 C-5,106 3,108 5,104 C7,100 -1,97 -3,100 C-5,103 1,105 -2,102 Z"
        fill="#3A2818"
        fillOpacity={0.25}
        stroke="#5A4030"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Bottom-right knot */}
      <Path
        d="M102,102 C105,106 97,108 95,104 C93,100 101,97 103,100 C105,103 99,105 102,102 Z"
        fill="#3A2818"
        fillOpacity={0.25}
        stroke="#5A4030"
        strokeWidth={0.8}
        opacity={0.5}
      />

      {/* ── Barbed thorns — filled triangles (not open Q-hooks) ── */}
      <G opacity={0.6} fill="#5A3820" stroke="#3A2010" strokeWidth={0.3}>
        {/* Top edge thorns */}
        <Path d="M20,-4 L22,-8 L24,-3 Z" />
        <Path d="M42,-1 L44,-6 L46,-1 Z" />
        <Path d="M62,-3 L64,-8 L66,-2 Z" />
        <Path d="M82,-1 L84,-5 L86,-1 Z" />
        {/* Bottom edge thorns */}
        <Path d="M25,104 L27,108 L29,103 Z" />
        <Path d="M50,102 L52,107 L54,101 Z" />
        <Path d="M75,104 L77,108 L79,103 Z" />
        {/* Left edge thorns */}
        <Path d="M-4,28 L-8,30 L-3,32 Z" />
        <Path d="M-2,58 L-7,60 L-2,62 Z" />
        {/* Right edge thorns */}
        <Path d="M104,35 L108,37 L103,39 Z" />
        <Path d="M103,72 L107,74 L102,76 Z" />
      </G>

      {/* ── Berry clusters — groups of 3, filled circles with seed dots ── */}
      <G opacity={0.6}>
        {/* Cluster on top edge */}
        <Circle cx={52} cy={-4} r={2.2} fill="#8B2252" />
        <Circle cx={55} cy={-5.5} r={1.8} fill="#9B3262" />
        <Circle cx={49} cy={-5} r={1.5} fill="#7B1242" />
        <Circle cx={52} cy={-4.5} r={0.5} fill="#BB5588" />
        <Circle cx={55} cy={-5.8} r={0.4} fill="#BB5588" />
      </G>
      <G opacity={0.55}>
        {/* Cluster on left edge */}
        <Circle cx={-4.5} cy={45} r={2} fill="#8B2252" />
        <Circle cx={-6} cy={48} r={1.6} fill="#7B1242" />
        <Circle cx={-3.5} cy={48.5} r={1.4} fill="#9B3262" />
        <Circle cx={-4.8} cy={45.5} r={0.4} fill="#BB5588" />
      </G>
      <G opacity={0.55}>
        {/* Cluster on right edge */}
        <Circle cx={104} cy={55} r={2} fill="#8B2252" />
        <Circle cx={106} cy={52} r={1.7} fill="#9B3262" />
        <Circle cx={104.5} cy={55.5} r={0.4} fill="#BB5588" />
      </G>

      {/* ── Leaf sprigs — tear-drop closed paths ── */}
      <G opacity={0.45} fill="#3A5520" stroke="#2A4010" strokeWidth={0.3}>
        <Path d="M32,-5 Q34,-8 36,-5 Q34,-3 32,-5 Z" />
        <Path d="M-5,72 Q-8,74 -5,76 Q-3,74 -5,72 Z" />
        <Path d="M106,42 Q108,44 106,46 Q104,44 106,42 Z" />
        <Path d="M68,105 Q70,108 72,105 Q70,103 68,105 Z" />
      </G>
    </Svg>
  );
});
WildBriarFrame.displayName = 'WildBriarFrame';
