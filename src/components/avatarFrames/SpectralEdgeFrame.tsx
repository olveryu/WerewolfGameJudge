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
 * SpectralEdgeFrame — 幽灵之刃
 *
 * 半透明幽灵白。断裂 "碎片" 边框段(不连续的 Rect 段) + 游荡魂链(链环 Path) +
 * 以太涟漪(RadialGradient 扩散圈) + 锁魂符文 Line 符号 + 亡魂幽火 core/halo。
 */
export const SpectralEdgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `seM${userId}`;
  const ghostG = `seGh${userId}`;
  const etherR = `seEr${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E0E8F0" stopOpacity={0.5} />
          <Stop offset="0.4" stopColor="#A0B0C8" stopOpacity={0.7} />
          <Stop offset="0.7" stopColor="#8090A8" stopOpacity={0.8} />
          <Stop offset="1" stopColor="#E0E8F0" stopOpacity={0.5} />
        </LinearGradient>
        <LinearGradient id={ghostG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.15} />
          <Stop offset="0.5" stopColor="#C0D0E0" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.15} />
        </LinearGradient>
        <RadialGradient id={etherR} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
          <Stop offset="0.6" stopColor="#C0D0E0" stopOpacity={0.05} />
          <Stop offset="1" stopColor="#8090A8" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Ether ripple pulses — RadialGradient pools */}
      <Circle cx={-3} cy={40} r={12} fill={`url(#${etherR})`} />
      <Circle cx={50} cy={104} r={10} fill={`url(#${etherR})`} />
      <Circle cx={104} cy={60} r={11} fill={`url(#${etherR})`} />

      {/* Ghostly outer blur — wider, dimmer than main */}
      <Rect
        x={-1}
        y={-1}
        width={102}
        height={102}
        rx={rx}
        fill="none"
        stroke="#C0D0E0"
        strokeWidth={7}
        opacity={0.06}
      />
      {/* Main translucent frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={4}
      />
      {/* Ghost overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${ghostG})`}
        strokeWidth={1.5}
      />
      {/* Inner ring */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#C0D0E0"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* ── Broken border fragments — floating segments torn from frame ── */}
      <G opacity={0.3} fill="none" stroke="#D0E0F0" strokeWidth={2.5} strokeLinecap="round">
        <Line x1={15} y1={-5} x2={30} y2={-5} />
        <Line x1={70} y1={-5} x2={85} y2={-5} />
        <Line x1={-5} y1={20} x2={-5} y2={35} />
        <Line x1={105} y1={65} x2={105} y2={80} />
        <Line x1={40} y1={105} x2={60} y2={105} />
      </G>

      {/* ── Soul chain links — oval chain segments connecting corners ── */}
      <G opacity={0.25} fill="none" stroke="#B0C0D8" strokeWidth={0.6}>
        {/* Chain from top-left toward bottom-right, outside frame */}
        <Path d="M-3,-3 Q2,-6 5,-3 Q2,0 -3,-3" />
        <Path d="M5,-3 Q10,-7 14,-3 Q10,1 5,-3" />
        {/* Chain from top-right */}
        <Path d="M103,-3 Q98,-6 95,-3 Q98,0 103,-3" />
        <Path d="M95,-3 Q90,-7 86,-3 Q90,1 95,-3" />
        {/* Chain from bottom-left */}
        <Path d="M-3,103 Q2,106 5,103 Q2,100 -3,103" />
        <Path d="M5,103 Q10,107 15,103 Q10,99 5,103" />
        {/* Chain from bottom-right */}
        <Path d="M103,103 Q98,106 95,103 Q98,100 103,103" />
      </G>

      {/* ── Soul wisps — long organic beziers rising from edges ── */}
      <G opacity={0.2} fill="none" stroke="#D0E0F0" strokeLinecap="round">
        <Path d="M-4,15 C5,8 2,25 8,35 C14,45 5,48 -2,55" strokeWidth={1} />
        <Path d="M104,25 C95,20 98,40 92,48 C86,56 95,60 103,68" strokeWidth={0.9} />
        <Path d="M30,-4 C25,5 35,10 32,20 C29,30 20,25 18,15" strokeWidth={0.8} />
        <Path d="M65,104 C70,95 60,90 63,80" strokeWidth={0.8} />
      </G>

      {/* ── Lock runes — containment sigils (cross-hatch marks on edges) ── */}
      <G opacity={0.3} stroke="#A0B0C8" strokeWidth={0.5}>
        <Line x1={45} y1={-3} x2={47} y2={-1} />
        <Line x1={47} y1={-3} x2={45} y2={-1} />
        <Line x1={53} y1={-3} x2={55} y2={-1} />
        <Line x1={55} y1={-3} x2={53} y2={-1} />
        <Line x1={-3} y1={48} x2={-1} y2={50} />
        <Line x1={-1} y1={48} x2={-3} y2={50} />
        <Line x1={101} y1={48} x2={103} y2={50} />
        <Line x1={103} y1={48} x2={101} y2={50} />
      </G>

      {/* ── Ghost-fire orbs at corners — large halo + bright core ── */}
      <G opacity={0.4}>
        <Circle cx={0} cy={0} r={3.5} fill="#D0E0F0" opacity={0.12} />
        <Circle cx={0} cy={0} r={1.2} fill="#FFFFFF" opacity={0.35} />
        <Circle cx={100} cy={0} r={3} fill="#D0E0F0" opacity={0.1} />
        <Circle cx={100} cy={0} r={1} fill="#FFFFFF" opacity={0.3} />
        <Circle cx={0} cy={100} r={2.5} fill="#D0E0F0" opacity={0.1} />
        <Circle cx={0} cy={100} r={0.8} fill="#FFFFFF" opacity={0.25} />
        <Circle cx={100} cy={100} r={3.2} fill="#D0E0F0" opacity={0.12} />
        <Circle cx={100} cy={100} r={1.1} fill="#FFFFFF" opacity={0.3} />
      </G>
    </Svg>
  );
});
SpectralEdgeFrame.displayName = 'SpectralEdgeFrame';
