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
 * NightShadeFrame — 夜影
 *
 * 深紫星空夜幕。RadialGradient 月晕角饰 · 星座连线 · 流星划痕 · 星云雾气 Path。
 * 结构：3 gradient (2 linear + 1 radial) · 4 moon-halo radial spots ·
 *   constellation lines · shooting star paths · nebula fog curves。
 */
export const NightShadeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `nsM${userId}`;
  const sheenG = `nsS${userId}`;
  const moonR = `nsMn${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A1B5E" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#2A1040" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#1A0828" stopOpacity={1} />
          <Stop offset="1" stopColor="#3A1B5E" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={sheenG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7B52AB" stopOpacity={0} />
          <Stop offset="0.45" stopColor="#9B72CB" stopOpacity={0.35} />
          <Stop offset="0.55" stopColor="#7B52AB" stopOpacity={0} />
        </LinearGradient>
        {/* Moon halo radial — unique to this frame */}
        <RadialGradient id={moonR} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#E0C8FF" stopOpacity={0.5} />
          <Stop offset="0.5" stopColor="#9B72CB" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#3A1B5E" stopOpacity={0} />
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
        stroke="#0A0515"
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
      {/* Sheen highlight */}
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
      {/* Inner groove */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#3A1B5E"
        strokeWidth={0.7}
        opacity={0.5}
      />

      {/* ── Moon halo spots at corners (RadialGradient circles) ── */}
      <Circle cx={0} cy={0} r={10} fill={`url(#${moonR})`} />
      <Circle cx={100} cy={0} r={8} fill={`url(#${moonR})`} opacity={0.7} />
      <Circle cx={0} cy={100} r={7} fill={`url(#${moonR})`} opacity={0.6} />
      <Circle cx={100} cy={100} r={9} fill={`url(#${moonR})`} opacity={0.8} />

      {/* ── Crescent moons inside halo (double-arc pairs) ── */}
      <G opacity={0.55}>
        <Path d="M-1,2 A5,5 0 0,1 2,-1" fill="none" stroke="#C8A2F0" strokeWidth={1.2} />
        <Path d="M0,3 A4,4 0 0,1 3,0" fill="none" stroke="#E0C8FF" strokeWidth={0.5} />
      </G>
      <G opacity={0.45}>
        <Path d="M98,-1 A5,5 0 0,1 101,2" fill="none" stroke="#C8A2F0" strokeWidth={1.2} />
        <Path d="M99,0 A3.5,3.5 0 0,1 102,3" fill="none" stroke="#E0C8FF" strokeWidth={0.5} />
      </G>

      {/* ── Constellation lines — top edge (Ursa Minor pattern) ── */}
      <G opacity={0.35} stroke="#B892E0" strokeWidth={0.4} strokeLinecap="round">
        <Line x1={18} y1={-3} x2={28} y2={-4} />
        <Line x1={28} y1={-4} x2={35} y2={-2} />
        <Line x1={35} y1={-2} x2={40} y2={-5} />
        <Line x1={40} y1={-5} x2={48} y2={-3} />
      </G>
      {/* Constellation stars (dots at vertices) */}
      <G opacity={0.55}>
        <Circle cx={18} cy={-3} r={1} fill="#E0C8FF" />
        <Circle cx={28} cy={-4} r={0.8} fill="#C8A2F0" />
        <Circle cx={35} cy={-2} r={1.2} fill="#E0C8FF" />
        <Circle cx={40} cy={-5} r={0.7} fill="#D8B8F0" />
        <Circle cx={48} cy={-3} r={0.9} fill="#E0C8FF" />
      </G>

      {/* ── Constellation — right edge (Cassiopeia W) ── */}
      <G opacity={0.3} stroke="#B892E0" strokeWidth={0.4} strokeLinecap="round">
        <Line x1={103} y1={20} x2={104} y2={30} />
        <Line x1={104} y1={30} x2={102} y2={38} />
        <Line x1={102} y1={38} x2={104} y2={48} />
        <Line x1={104} y1={48} x2={103} y2={55} />
      </G>
      <G opacity={0.45}>
        <Circle cx={103} cy={20} r={0.8} fill="#E0C8FF" />
        <Circle cx={104} cy={30} r={0.7} fill="#C8A2F0" />
        <Circle cx={102} cy={38} r={1} fill="#E0C8FF" />
        <Circle cx={104} cy={48} r={0.6} fill="#D8B8F0" />
        <Circle cx={103} cy={55} r={0.9} fill="#E0C8FF" />
      </G>

      {/* ── Shooting star — bottom-left to mid (streak + fading tail) ── */}
      <G opacity={0.4}>
        <Line
          x1={10}
          y1={104}
          x2={30}
          y2={100}
          stroke="#E0C8FF"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
        <Line
          x1={30}
          y1={100}
          x2={38}
          y2={101}
          stroke="#C8A2F0"
          strokeWidth={0.5}
          strokeLinecap="round"
        />
        <Circle cx={10} cy={104} r={1.2} fill="#E0C8FF" />
      </G>

      {/* ── Nebula fog wisps (organic bezier — NOT repeated arcs) ── */}
      <G opacity={0.18} fill="none" strokeLinecap="round">
        <Path d="M-4,60 C5,55 10,70 0,75" stroke="#9B72CB" strokeWidth={3} />
        <Path d="M55,103 C60,108 75,106 80,102" stroke="#7B52AB" strokeWidth={2.5} />
      </G>

      {/* ── Scattered dim stars — bottom + left edges ── */}
      <G opacity={0.4}>
        <Circle cx={60} cy={103} r={0.6} fill="#D8B8F0" />
        <Circle cx={-3} cy={45} r={0.5} fill="#E0C8FF" />
        <Circle cx={85} cy={-3} r={0.7} fill="#C8A2F0" />
      </G>
    </Svg>
  );
});
NightShadeFrame.displayName = 'NightShadeFrame';
