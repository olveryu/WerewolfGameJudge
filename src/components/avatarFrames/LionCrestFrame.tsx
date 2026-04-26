import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * LionCrestFrame — 狮纹
 *
 * 纹章盾牌风格。顶部三尖皇冠 · 对角绶带(sash path) ·
 * 四角盾牌 badge(多层 Path 不同于 WolfFang 的 claw Lines) ·
 * 底部垂幔横幅(banner scroll) · 交叉剑/标枪(背景纹) · 金红配色。
 * 与 WolfFang 完全不同: 无 triangle 阵列, 无 claw scratch, 采用 heraldic 纹章元素。
 */
export const LionCrestFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `lcM${userId}`;
  const goldG = `lcGo${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8B2020" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#5A1515" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#3A0D0D" stopOpacity={1} />
          <Stop offset="1" stopColor="#8B2020" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={goldG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.25} />
          <Stop offset="0.35" stopColor="#DAA520" stopOpacity={0.1} />
          <Stop offset="0.65" stopColor="#B8860B" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0.25} />
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
        stroke="#1A0505"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Royal red frame */}
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
      {/* Gold diagonal tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${goldG})`}
        strokeWidth={2}
      />
      {/* Inner border */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#5A1515"
        strokeWidth={0.7}
        opacity={0.4}
      />

      {/* ── Three-pointed crown — top center ── */}
      <G opacity={0.6}>
        <Path
          d="M40,-2 L42,-7 L45,-3 L50,-10 L55,-3 L58,-7 L60,-2 L55,0 L45,0 Z"
          fill="#DAA520"
          stroke="#B8860B"
          strokeWidth={0.4}
        />
        {/* Crown jewel */}
        <Circle cx={50} cy={-5} r={1} fill="#FF4040" stroke="#B8860B" strokeWidth={0.3} />
        {/* Side jewels */}
        <Circle cx={43} cy={-3.5} r={0.6} fill="#FF4040" opacity={0.7} />
        <Circle cx={57} cy={-3.5} r={0.6} fill="#FF4040" opacity={0.7} />
      </G>

      {/* ── Diagonal sash — top-right to bottom-left ── */}
      <Path
        d="M92,-4 L96,-2 L8,102 L4,100 Z"
        fill="#DAA520"
        fillOpacity={0.12}
        stroke="#B8860B"
        strokeWidth={0.3}
        opacity={0.4}
      />
      {/* Sash fringe details */}
      <G opacity={0.3} stroke="#DAA520" strokeWidth={0.3}>
        <Line x1={70} y1={18} x2={72} y2={16} />
        <Line x1={50} y1={40} x2={52} y2={38} />
        <Line x1={30} y1={62} x2={32} y2={60} />
      </G>

      {/* ── Shield badges at corners (heraldic escutcheon shape) ── */}
      {/* Top-left — full heraldic shield */}
      <G opacity={0.55}>
        <Path
          d="M-4,-4 L4,-4 L4,2 Q4,6 0,8 Q-4,6 -4,2 Z"
          fill="#5A1515"
          stroke="#DAA520"
          strokeWidth={0.6}
        />
        <Path d="M-1,-2 L1,-2 L1,1 L0,2.5 L-1,1 Z" fill="#DAA520" opacity={0.4} />
      </G>
      {/* Top-right */}
      <G opacity={0.55}>
        <Path
          d="M96,-4 L104,-4 L104,2 Q104,6 100,8 Q96,6 96,2 Z"
          fill="#5A1515"
          stroke="#DAA520"
          strokeWidth={0.6}
        />
        <Path d="M99,-2 L101,-2 L101,1 L100,2.5 L99,1 Z" fill="#DAA520" opacity={0.4} />
      </G>
      {/* Bottom-left */}
      <G opacity={0.5}>
        <Path
          d="M-4,96 L4,96 L4,102 Q4,106 0,108 Q-4,106 -4,102 Z"
          fill="#5A1515"
          stroke="#DAA520"
          strokeWidth={0.6}
        />
        <Circle cx={0} cy={100} r={1} fill="#DAA520" opacity={0.4} />
      </G>
      {/* Bottom-right */}
      <G opacity={0.5}>
        <Path
          d="M96,96 L104,96 L104,102 Q104,106 100,108 Q96,106 96,102 Z"
          fill="#5A1515"
          stroke="#DAA520"
          strokeWidth={0.6}
        />
        <Circle cx={100} cy={100} r={1} fill="#DAA520" opacity={0.4} />
      </G>

      {/* ── Banner scroll — bottom center ── */}
      <G opacity={0.5}>
        <Path
          d="M30,102 Q28,106 32,108 L68,108 Q72,106 70,102"
          fill="none"
          stroke="#DAA520"
          strokeWidth={0.7}
        />
        {/* Scroll curls */}
        <Path d="M32,108 Q28,110 26,107" fill="none" stroke="#B8860B" strokeWidth={0.5} />
        <Path d="M68,108 Q72,110 74,107" fill="none" stroke="#B8860B" strokeWidth={0.5} />
        {/* Banner text line (abstract) */}
        <Line x1={38} y1={105} x2={62} y2={105} stroke="#DAA520" strokeWidth={0.4} opacity={0.6} />
      </G>

      {/* ── Crossed lances behind frame (background heraldic motif) ── */}
      <G opacity={0.15} stroke="#DAA520" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={-6} y1={-6} x2={15} y2={15} />
        <Line x1={106} y1={-6} x2={85} y2={15} />
        <Line x1={-6} y1={106} x2={15} y2={85} />
        <Line x1={106} y1={106} x2={85} y2={85} />
      </G>

      {/* ── Edge ornaments — fleur-de-lis mid-points ── */}
      <G opacity={0.35} fill="#DAA520">
        {/* Left mid */}
        <Path d="M-3,48 Q-5,50 -3,52 Q-1,50 -3,48 Z" />
        {/* Right mid */}
        <Path d="M103,48 Q105,50 103,52 Q101,50 103,48 Z" />
      </G>
    </Svg>
  );
});
LionCrestFrame.displayName = 'LionCrestFrame';
