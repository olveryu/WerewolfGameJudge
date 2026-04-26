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
 * FlameThornFrame — 火棘
 *
 * 从底部升起的烈焰浪潮边框。底边 = 大型火焰波浪 Path (3 层: 外焰/中焰/芯)。
 * 侧边 = 渐弱火舌 Path。顶边 = 热浪扭曲 + 灰烬。
 * RadialGradient 热源中心在底部。灰烬微粒在上方飘散。
 * 与 ThornCrown 完全不同: 无 vine, 无 thorn Q-hook, 采用火焰波浪+热源+灰烬。
 */
export const FlameThornFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ftM${userId}`;
  const fireG = `ftF${userId}`;
  const heatR = `ftHt${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FF6600" stopOpacity={0.6} />
          <Stop offset="0.3" stopColor="#8B2500" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#3A1000" stopOpacity={1} />
          <Stop offset="1" stopColor="#2A0800" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={fireG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FFCC00" stopOpacity={0.4} />
          <Stop offset="0.2" stopColor="#FF6600" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#CC2200" stopOpacity={0} />
        </LinearGradient>
        {/* Heat source radial from bottom center */}
        <RadialGradient id={heatR} cx="0.5" cy="1" r="0.6">
          <Stop offset="0" stopColor="#FF6600" stopOpacity={0.35} />
          <Stop offset="0.4" stopColor="#CC3300" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#3A1000" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Heat source glow — bottom center */}
      <Rect x={-8} y={-8} width={116} height={116} fill={`url(#${heatR})`} rx={rx} />

      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#1A0500"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Main frame — hot gradient */}
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
      {/* Fire glow overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${fireG})`}
        strokeWidth={2.5}
      />
      {/* Charred inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#2A0800"
        strokeWidth={0.7}
        opacity={0.3}
      />

      {/* ── Bottom flame wave — 3-layer fire tongues (outer/mid/core) ── */}
      {/* Outer flame (orange-red, widest) */}
      <Path
        d="M-4,102 C5,96 10,108 20,95 C28,85 32,98 42,92 C50,85 55,100 62,90 C70,82 75,96 82,88 C88,80 95,95 104,102"
        fill="none"
        stroke="#CC3300"
        strokeWidth={2}
        opacity={0.4}
        strokeLinecap="round"
      />
      {/* Mid flame (bright orange) */}
      <Path
        d="M0,102 C8,98 14,106 22,97 C30,88 35,100 44,93 C52,86 56,98 64,91 C72,84 77,97 84,90 C90,84 96,96 100,102"
        fill="none"
        stroke="#FF6600"
        strokeWidth={1.2}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Core flame (yellow-white, thinnest) */}
      <Path
        d="M5,102 C12,99 16,105 24,98 C32,92 38,101 46,95 C54,90 58,99 66,94 C74,88 78,98 86,93 C92,88 96,97 95,102"
        fill="none"
        stroke="#FFCC00"
        strokeWidth={0.6}
        opacity={0.55}
        strokeLinecap="round"
      />

      {/* ── Side fire tongues — diminishing upward ── */}
      {/* Left side — 3 ascending flame licks */}
      <G opacity={0.4} fill="none" strokeLinecap="round">
        <Path d="M-3,90 C-8,82 2,78 -2,70" stroke="#CC3300" strokeWidth={1.5} />
        <Path d="M-2,65 C-6,58 1,55 -1,48" stroke="#8B2500" strokeWidth={1} />
        <Path d="M-1,42 C-4,36 0,33 -1,28" stroke="#5A1800" strokeWidth={0.7} />
      </G>
      {/* Right side — 3 ascending flame licks */}
      <G opacity={0.4} fill="none" strokeLinecap="round">
        <Path d="M103,88 C108,80 98,76 102,68" stroke="#CC3300" strokeWidth={1.5} />
        <Path d="M102,62 C106,55 99,52 101,45" stroke="#8B2500" strokeWidth={1} />
        <Path d="M101,38 C104,32 100,28 101,22" stroke="#5A1800" strokeWidth={0.7} />
      </G>

      {/* ── Top edge — heat shimmer wavy lines ── */}
      <G opacity={0.15} fill="none" stroke="#FF6600" strokeWidth={0.5}>
        <Path d="M10,-2 Q20,-5 30,-2 Q40,-4 50,-2 Q60,-5 70,-2 Q80,-4 90,-2" />
        <Path d="M15,-4 Q25,-7 35,-4 Q45,-6 55,-4 Q65,-7 75,-4 Q85,-6 90,-4" />
      </G>

      {/* ── Ash / ember particles — floating above flame ── */}
      <G opacity={0.55}>
        <Circle cx={15} cy={-4} r={0.6} fill="#FF9900" />
        <Circle cx={38} cy={-6} r={0.5} fill="#FFCC00" />
        <Circle cx={62} cy={-5} r={0.7} fill="#FF6600" />
        <Circle cx={85} cy={-4} r={0.4} fill="#FFCC00" />
      </G>
      {/* Grey ash (cooled) */}
      <G opacity={0.3}>
        <Circle cx={25} cy={-7} r={0.4} fill="#808080" />
        <Circle cx={50} cy={-7.5} r={0.3} fill="#A0A0A0" />
        <Circle cx={75} cy={-7} r={0.35} fill="#909090" />
      </G>

      {/* ── Crack lines in charred frame edges (heat stress) ── */}
      <G opacity={0.25} stroke="#5A1800" strokeWidth={0.4} strokeLinecap="round">
        <Line x1={-2} y1={85} x2={-4} y2={90} />
        <Line x1={-3} y1={90} x2={-1} y2={95} />
        <Line x1={102} y1={82} x2={104} y2={88} />
        <Line x1={103} y1={88} x2={101} y2={94} />
      </G>
    </Svg>
  );
});
FlameThornFrame.displayName = 'FlameThornFrame';
