import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * NightBloomFrame — 夜花
 *
 * 四角各一朵完整盛开花(6-8 petal closed paths)，每朵不同花型(旋转/大小不同)。
 * 花芯 = RadialGradient 暖光 stamen。花瓣散落在边缘(drift petals)。
 * 纤细藤蔓(single thin line)沿四边连接花朵。花粉微粒(biolight dots)。
 * 与原版完全不同: 原版只有 3-4 个 bezier petal + Circle, 新版是完整盛开花。
 */
export const NightBloomFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `nbM${userId}`;
  const stamenR = `nbSt${userId}`;
  const stamen2R = `nbS2${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1A1A40" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#0D0D25" stopOpacity={1} />
          <Stop offset="1" stopColor="#1A1A40" stopOpacity={0.95} />
        </LinearGradient>
        {/* Warm stamen glow (pink flowers) */}
        <RadialGradient id={stamenR} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFE0A0" stopOpacity={0.8} />
          <Stop offset="0.4" stopColor="#FFAA60" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#FF60A0" stopOpacity={0} />
        </RadialGradient>
        {/* Cool stamen glow (blue flowers) */}
        <RadialGradient id={stamen2R} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#E0F0FF" stopOpacity={0.8} />
          <Stop offset="0.4" stopColor="#60A0FF" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#2040A0" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#050510"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Main midnight frame */}
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
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#1A1A40"
        strokeWidth={0.6}
        opacity={0.4}
      />

      {/* ── Full bloom #1 — top-left, pink, 6 petals ── */}
      <G opacity={0.55}>
        <Path d="M-2,-2 Q-8,-8 -2,-8 Q-2,-8 -2,-2 Z" fill="#FF60A0" fillOpacity={0.4} />
        <Path d="M-2,-2 Q-8,-2 -8,2 Q-4,2 -2,-2 Z" fill="#FF80C0" fillOpacity={0.35} />
        <Path d="M-2,-2 Q-4,4 -8,2 Q-6,-2 -2,-2 Z" fill="#E060A0" fillOpacity={0.3} />
        <Path d="M-2,-2 Q4,-8 2,-4 Q0,-2 -2,-2 Z" fill="#FF60A0" fillOpacity={0.4} />
        <Path d="M-2,-2 Q2,2 -2,4 Q-4,0 -2,-2 Z" fill="#FF80C0" fillOpacity={0.3} />
        <Path d="M-2,-2 Q-6,-6 -4,0 Q-2,0 -2,-2 Z" fill="#E060A0" fillOpacity={0.25} />
        {/* Stamen */}
        <Circle cx={-2} cy={-2} r={2.5} fill={`url(#${stamenR})`} />
        <Circle cx={-2} cy={-2} r={0.8} fill="#FFE0A0" opacity={0.7} />
      </G>

      {/* ── Full bloom #2 — top-right, blue, 5 petals (different shape) ── */}
      <G opacity={0.5}>
        <Path d="M102,-2 Q108,-8 106,-2 Q106,0 102,-2 Z" fill="#60A0FF" fillOpacity={0.4} />
        <Path d="M102,-2 Q96,-8 98,-4 Q100,-2 102,-2 Z" fill="#80C0FF" fillOpacity={0.35} />
        <Path d="M102,-2 Q108,0 106,4 Q104,0 102,-2 Z" fill="#60A0FF" fillOpacity={0.3} />
        <Path d="M102,-2 Q98,2 100,4 Q102,0 102,-2 Z" fill="#80C0FF" fillOpacity={0.3} />
        <Path d="M102,-2 Q104,-6 106,-4 Q104,-2 102,-2 Z" fill="#6080FF" fillOpacity={0.25} />
        {/* Stamen */}
        <Circle cx={102} cy={-2} r={2.2} fill={`url(#${stamen2R})`} />
        <Circle cx={102} cy={-2} r={0.7} fill="#E0F0FF" opacity={0.7} />
      </G>

      {/* ── Full bloom #3 — bottom-left, pink-purple, 7 petals (larger) ── */}
      <G opacity={0.5}>
        <Path d="M-2,102 Q-8,96 -6,100 Q-4,102 -2,102 Z" fill="#C060A0" fillOpacity={0.4} />
        <Path d="M-2,102 Q-8,106 -6,104 Q-4,102 -2,102 Z" fill="#FF60A0" fillOpacity={0.35} />
        <Path d="M-2,102 Q2,96 0,100 Q0,102 -2,102 Z" fill="#E060A0" fillOpacity={0.3} />
        <Path d="M-2,102 Q4,104 2,108 Q0,104 -2,102 Z" fill="#C060C0" fillOpacity={0.3} />
        <Path d="M-2,102 Q-6,108 -4,106 Q-2,104 -2,102 Z" fill="#FF60A0" fillOpacity={0.25} />
        <Path d="M-2,102 Q-8,100 -6,98 Q-4,100 -2,102 Z" fill="#C080C0" fillOpacity={0.25} />
        <Path d="M-2,102 Q0,108 2,106 Q0,104 -2,102 Z" fill="#E060A0" fillOpacity={0.2} />
        {/* Stamen */}
        <Circle cx={-2} cy={102} r={2.8} fill={`url(#${stamenR})`} />
        <Circle cx={-2} cy={102} r={0.9} fill="#FFE0A0" opacity={0.6} />
      </G>

      {/* ── Full bloom #4 — bottom-right, blue, 6 petals ── */}
      <G opacity={0.45}>
        <Path d="M102,102 Q108,96 106,100 Q104,102 102,102 Z" fill="#60A0FF" fillOpacity={0.4} />
        <Path d="M102,102 Q108,106 106,104 Q104,102 102,102 Z" fill="#80C0FF" fillOpacity={0.35} />
        <Path d="M102,102 Q96,96 98,100 Q100,102 102,102 Z" fill="#60A0FF" fillOpacity={0.3} />
        <Path d="M102,102 Q96,106 98,104 Q100,102 102,102 Z" fill="#80C0FF" fillOpacity={0.3} />
        <Path d="M102,102 Q106,100 108,102 Q104,104 102,102 Z" fill="#6080FF" fillOpacity={0.25} />
        <Path d="M102,102 Q100,108 102,106 Q104,104 102,102 Z" fill="#80C0FF" fillOpacity={0.2} />
        {/* Stamen */}
        <Circle cx={102} cy={102} r={2.4} fill={`url(#${stamen2R})`} />
        <Circle cx={102} cy={102} r={0.7} fill="#E0F0FF" opacity={0.6} />
      </G>

      {/* ── Connecting vine tendrils ── */}
      <G opacity={0.3} fill="none" stroke="#2A4030" strokeWidth={0.5} strokeLinecap="round">
        <Path d="M5,-2 Q20,-5 40,-2 Q60,-4 95,-2" />
        <Path d="M-2,5 Q-4,25 -2,50 Q-4,75 -2,95" />
        <Path d="M5,102 Q25,105 50,102 Q75,104 95,102" />
        <Path d="M102,5 Q104,25 102,50 Q104,75 102,95" />
      </G>

      {/* ── Drift petals (fallen petals along edges) ── */}
      <G opacity={0.3}>
        <Path d="M30,-4 Q32,-6 34,-3 Q32,-2 30,-4 Z" fill="#FF80C0" />
        <Path d="M70,-3 Q72,-5 74,-2 Q72,-1 70,-3 Z" fill="#80C0FF" />
        <Path d="M-4,40 Q-6,42 -3,44 Q-2,42 -4,40 Z" fill="#FF60A0" />
        <Path d="M104,65 Q106,67 103,69 Q102,67 104,65 Z" fill="#60A0FF" />
        <Path d="M40,104 Q42,106 44,103 Q42,102 40,104 Z" fill="#C060C0" />
      </G>

      {/* ── Pollen / biolight particles ── */}
      <G opacity={0.5}>
        <Circle cx={20} cy={-3} r={0.5} fill="#FFB0D0" />
        <Circle cx={50} cy={-4} r={0.4} fill="#B0D0FF" />
        <Circle cx={80} cy={-3} r={0.5} fill="#FFB0D0" />
        <Circle cx={-3} cy={30} r={0.4} fill="#FF80C0" />
        <Circle cx={-3} cy={70} r={0.5} fill="#80C0FF" />
        <Circle cx={103} cy={20} r={0.4} fill="#80C0FF" />
        <Circle cx={103} cy={80} r={0.5} fill="#FFB0D0" />
        <Circle cx={30} cy={104} r={0.4} fill="#FF80C0" />
        <Circle cx={70} cy={104} r={0.5} fill="#B0D0FF" />
      </G>
    </Svg>
  );
});
NightBloomFrame.displayName = 'NightBloomFrame';
