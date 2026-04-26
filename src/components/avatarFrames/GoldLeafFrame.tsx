import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * GoldLeafFrame — 金箔
 *
 * 锤揲金属(hammered gold)边框。表面布满锤痕凹坑(dimple RadialGradient circles)。
 * 四角 = 精细 filigree 卷须(scrollwork = 多段 C-bezier)。
 * 边缘 = 不规则撕裂金箔(torn leaf edge jagged Paths)。浮雕双层内框。
 * 与原版完全不同: 原版是 crackle 折线+单圈卷轴, 新版是 dimple 纹+filigree 多层卷须+撕裂边。
 */
export const GoldLeafFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `glM${userId}`;
  const sheenG = `glSh${userId}`;
  const dimpleR = `glDm${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.85} />
          <Stop offset="0.3" stopColor="#DAA520" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#B8860B" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#DAA520" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={sheenG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF8DC" stopOpacity={0.3} />
          <Stop offset="0.3" stopColor="#FFD700" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#FFD700" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFF8DC" stopOpacity={0.3} />
        </LinearGradient>
        {/* Hammer dimple — depressed circle highlight/shadow */}
        <RadialGradient id={dimpleR} cx="0.4" cy="0.4" r="0.5">
          <Stop offset="0" stopColor="#FFF8DC" stopOpacity={0.5} />
          <Stop offset="0.6" stopColor="#B8860B" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#8B6914" stopOpacity={0} />
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
        stroke="#3A2800"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Gold foil frame */}
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
      {/* Sheen */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sheenG})`}
        strokeWidth={2}
      />
      {/* Relief double inner frame */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#B8860B"
        strokeWidth={0.8}
        opacity={0.4}
      />
      <Rect
        x={8}
        y={8}
        width={84}
        height={84}
        rx={Math.max(rx - 7, 0)}
        fill="none"
        stroke="#DAA520"
        strokeWidth={0.4}
        opacity={0.25}
      />

      {/* ── Hammer dimples — scattered raised/depressed circles ── */}
      <G>
        {/* Top edge dimples */}
        <Circle cx={15} cy={-1} r={2} fill={`url(#${dimpleR})`} />
        <Circle cx={32} cy={-2} r={1.5} fill={`url(#${dimpleR})`} />
        <Circle cx={50} cy={-1} r={2.2} fill={`url(#${dimpleR})`} />
        <Circle cx={68} cy={-2} r={1.8} fill={`url(#${dimpleR})`} />
        <Circle cx={85} cy={-1} r={1.6} fill={`url(#${dimpleR})`} />
        {/* Bottom edge */}
        <Circle cx={20} cy={101} r={1.8} fill={`url(#${dimpleR})`} />
        <Circle cx={42} cy={102} r={2} fill={`url(#${dimpleR})`} />
        <Circle cx={62} cy={101} r={1.5} fill={`url(#${dimpleR})`} />
        <Circle cx={80} cy={102} r={2} fill={`url(#${dimpleR})`} />
        {/* Left edge */}
        <Circle cx={-1} cy={18} r={1.5} fill={`url(#${dimpleR})`} />
        <Circle cx={-2} cy={40} r={2} fill={`url(#${dimpleR})`} />
        <Circle cx={-1} cy={62} r={1.8} fill={`url(#${dimpleR})`} />
        <Circle cx={-2} cy={82} r={1.5} fill={`url(#${dimpleR})`} />
        {/* Right edge */}
        <Circle cx={101} cy={22} r={1.8} fill={`url(#${dimpleR})`} />
        <Circle cx={102} cy={48} r={2} fill={`url(#${dimpleR})`} />
        <Circle cx={101} cy={72} r={1.6} fill={`url(#${dimpleR})`} />
        <Circle cx={102} cy={88} r={1.8} fill={`url(#${dimpleR})`} />
      </G>

      {/* ── Filigree scrollwork — top-left corner (multi-segment) ── */}
      <G opacity={0.55} fill="none" stroke="#B8860B" strokeWidth={0.7} strokeLinecap="round">
        <Path d="M-4,-2 C-2,-8 4,-6 6,-2 C8,2 4,6 0,4" />
        <Path d="M0,4 C-2,2 -4,4 -4,6" />
        <Path d="M6,-2 C8,-4 10,-2 8,0" />
      </G>
      {/* Filigree — top-right */}
      <G opacity={0.55} fill="none" stroke="#B8860B" strokeWidth={0.7} strokeLinecap="round">
        <Path d="M104,-2 C102,-8 96,-6 94,-2 C92,2 96,6 100,4" />
        <Path d="M100,4 C102,2 104,4 104,6" />
        <Path d="M94,-2 C92,-4 90,-2 92,0" />
      </G>
      {/* Filigree — bottom-left */}
      <G opacity={0.5} fill="none" stroke="#B8860B" strokeWidth={0.7} strokeLinecap="round">
        <Path d="M-4,102 C-2,108 4,106 6,102 C8,98 4,94 0,96" />
        <Path d="M0,96 C-2,98 -4,96 -4,94" />
        <Path d="M6,102 C8,104 10,102 8,100" />
      </G>
      {/* Filigree — bottom-right */}
      <G opacity={0.5} fill="none" stroke="#B8860B" strokeWidth={0.7} strokeLinecap="round">
        <Path d="M104,102 C102,108 96,106 94,102 C92,98 96,94 100,96" />
        <Path d="M100,96 C102,98 104,96 104,94" />
        <Path d="M94,102 C92,104 90,102 92,100" />
      </G>

      {/* ── Torn leaf edge — irregular jagged outer Paths ── */}
      <G opacity={0.2} fill="none" stroke="#8B6914" strokeWidth={0.5}>
        {/* Top torn edge */}
        <Path d="M10,-5 L13,-4 L14,-6 L18,-4 L20,-5.5 L25,-4 L28,-6 L32,-4 L35,-5" />
        <Path d="M60,-5 L63,-4 L65,-6 L68,-4 L72,-5.5 L75,-4 L78,-6 L82,-4 L85,-5" />
        {/* Bottom torn edge */}
        <Path d="M15,105 L18,104 L20,106 L24,104 L28,106 L32,104 L35,105.5" />
        <Path d="M65,105 L68,104 L70,106 L75,104 L78,106 L82,104.5" />
      </G>

      {/* ── Leaf vein — subtle gold lines across surface ── */}
      <G opacity={0.12} stroke="#DAA520" strokeWidth={0.3}>
        <Line x1={-3} y1={50} x2={103} y2={50} />
        <Line x1={50} y1={-3} x2={50} y2={103} />
      </G>

      {/* ── Gold flake dust ── */}
      <G opacity={0.4}>
        <Circle cx={25} cy={-4} r={0.4} fill="#FFD700" />
        <Circle cx={75} cy={-4} r={0.35} fill="#FFF8DC" />
        <Circle cx={-4} cy={30} r={0.4} fill="#FFD700" />
        <Circle cx={-4} cy={70} r={0.35} fill="#FFF8DC" />
        <Circle cx={104} cy={35} r={0.4} fill="#FFD700" />
        <Circle cx={104} cy={65} r={0.35} fill="#FFF8DC" />
        <Circle cx={30} cy={104} r={0.4} fill="#FFD700" />
        <Circle cx={70} cy={104} r={0.35} fill="#FFF8DC" />
      </G>
    </Svg>
  );
});
GoldLeafFrame.displayName = 'GoldLeafFrame';
