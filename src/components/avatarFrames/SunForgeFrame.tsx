import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SunForgeFrame — 日锻
 *
 * 灼金锻造 · 放射角棘 · 锤纹肌理 · 太阳核心中锋点。
 */
export const SunForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `sfM${userId}`;
  const glowG = `sfGl${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.9} />
          <Stop offset="0.35" stopColor="#B8860B" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#8B6914" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={glowG} x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FFF8DC" stopOpacity={0.4} />
          <Stop offset="0.5" stopColor="#FFD700" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFF8DC" stopOpacity={0.4} />
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
        stroke="#3A2800"
        strokeWidth={6.5}
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
        strokeWidth={5}
      />
      {/* Top glow */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${glowG})`}
        strokeWidth={1.8}
      />
      {/* Inner border */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#B8860B"
        strokeWidth={0.8}
        opacity={0.45}
      />
      {/* Corner sun spokes — top-left */}
      <G opacity={0.6} stroke="#FFD700" strokeLinecap="round">
        <Line x1={-4} y1={-4} x2={3} y2={3} strokeWidth={1.2} />
        <Line x1={-5} y1={2} x2={2} y2={-1} strokeWidth={0.9} opacity={0.75} />
        <Line x1={2} y1={-5} x2={-1} y2={2} strokeWidth={0.9} opacity={0.75} />
      </G>
      {/* Corner sun spokes — top-right */}
      <G opacity={0.6} stroke="#FFD700" strokeLinecap="round">
        <Line x1={104} y1={-4} x2={97} y2={3} strokeWidth={1.2} />
        <Line x1={105} y1={2} x2={98} y2={-1} strokeWidth={0.9} opacity={0.75} />
        <Line x1={98} y1={-5} x2={101} y2={2} strokeWidth={0.9} opacity={0.75} />
      </G>
      {/* Corner sun spokes — bottom-left */}
      <G opacity={0.6} stroke="#FFD700" strokeLinecap="round">
        <Line x1={-4} y1={104} x2={3} y2={97} strokeWidth={1.2} />
        <Line x1={-5} y1={98} x2={2} y2={101} strokeWidth={0.9} opacity={0.75} />
        <Line x1={2} y1={105} x2={-1} y2={98} strokeWidth={0.9} opacity={0.75} />
      </G>
      {/* Corner sun spokes — bottom-right */}
      <G opacity={0.6} stroke="#FFD700" strokeLinecap="round">
        <Line x1={104} y1={104} x2={97} y2={97} strokeWidth={1.2} />
        <Line x1={105} y1={98} x2={98} y2={101} strokeWidth={0.9} opacity={0.75} />
        <Line x1={98} y1={105} x2={101} y2={98} strokeWidth={0.9} opacity={0.75} />
      </G>
      {/* Hammered texture — top edge */}
      <G opacity={0.3} stroke="#B8860B" strokeLinecap="round">
        <Line x1={15} y1={-1} x2={18} y2={1} strokeWidth={0.6} />
        <Line x1={28} y1={0.5} x2={31} y2={-1} strokeWidth={0.5} />
        <Line x1={42} y1={-1} x2={44} y2={0.5} strokeWidth={0.6} />
        <Line x1={58} y1={0.5} x2={60} y2={-1} strokeWidth={0.5} />
        <Line x1={72} y1={-0.5} x2={74} y2={1} strokeWidth={0.6} />
        <Line x1={85} y1={0} x2={87} y2={-1} strokeWidth={0.5} />
      </G>
      {/* Hammered texture — bottom edge */}
      <G opacity={0.3} stroke="#B8860B" strokeLinecap="round">
        <Line x1={15} y1={101} x2={18} y2={99} strokeWidth={0.6} />
        <Line x1={28} y1={99.5} x2={31} y2={101} strokeWidth={0.5} />
        <Line x1={42} y1={101} x2={44} y2={99.5} strokeWidth={0.6} />
        <Line x1={58} y1={99.5} x2={60} y2={101} strokeWidth={0.5} />
        <Line x1={72} y1={100.5} x2={74} y2={99} strokeWidth={0.6} />
        <Line x1={85} y1={100} x2={87} y2={101} strokeWidth={0.5} />
      </G>
      {/* Sun discs — mid-edges (halo + core) */}
      <Circle cx={50} cy={-3} r={2.5} fill="#FFD700" opacity={0.35} />
      <Circle cx={50} cy={-3} r={1.2} fill="#FFF8DC" opacity={0.5} />
      <Circle cx={50} cy={103} r={2.5} fill="#FFD700" opacity={0.35} />
      <Circle cx={50} cy={103} r={1.2} fill="#FFF8DC" opacity={0.5} />
      <Circle cx={-3} cy={50} r={2.5} fill="#FFD700" opacity={0.35} />
      <Circle cx={-3} cy={50} r={1.2} fill="#FFF8DC" opacity={0.5} />
      <Circle cx={103} cy={50} r={2.5} fill="#FFD700" opacity={0.35} />
      <Circle cx={103} cy={50} r={1.2} fill="#FFF8DC" opacity={0.5} />
    </Svg>
  );
});
SunForgeFrame.displayName = 'SunForgeFrame';
