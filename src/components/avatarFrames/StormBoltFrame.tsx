import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * StormBoltFrame — 雷暴
 *
 * 深蓝钢框 + 金色闪电锯齿 + 角落多级放电 + 边缘电弧。
 * 阴影层 → 主渐变框 → 内环虚线 → 闪电/电弧 → 火花粒子 → 角落辉光弧。
 */
export const StormBoltFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const stormGrad = `stormG${uid}`;
  const boltGrad = `boltG${uid}`;
  const innerGrad = `stormIn${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={stormGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A90D9" stopOpacity={0.95} />
          <Stop offset="0.4" stopColor="#2C3E6B" stopOpacity={1} />
          <Stop offset="1" stopColor="#1A2744" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={boltGrad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE066" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#FF8C00" stopOpacity={0.7} />
        </LinearGradient>
        <LinearGradient id={innerGrad} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6AA8E8" stopOpacity={0.4} />
          <Stop offset="0.5" stopColor="#4A90D9" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#6AA8E8" stopOpacity={0.4} />
        </LinearGradient>
      </Defs>
      {/* Shadow frame */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#0A1020"
        strokeWidth={5}
        opacity={0.3}
      />
      {/* Main border */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${stormGrad})`}
        strokeWidth={3.5}
      />
      {/* Inner dashed ring */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke={`url(#${innerGrad})`}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      {/* Electric arcs — top */}
      <Path
        d="M18,0 L20,-2 L22,0 L25,-3 L28,0 L30,-2 L33,0"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        opacity={0.5}
      />
      <Path
        d="M67,0 L70,-2 L72,0 L75,-3 L78,0 L80,-2 L82,0"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Electric arcs — bottom */}
      <Path
        d="M18,100 L20,102 L22,100 L25,103 L28,100 L30,102 L33,100"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        opacity={0.5}
      />
      <Path
        d="M67,100 L70,102 L72,100 L75,103 L78,100 L80,102 L82,100"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Corner bolts — top-left (detailed zigzag) */}
      <Path
        d="M10,-1 L7,-5 L12,-4 L9,-9 L14,-7 L11,-12"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M14,-1 L16,-6 L13,-5 L15,-10"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Top-right bolt */}
      <Path
        d="M90,-1 L93,-5 L88,-4 L91,-9 L86,-7 L89,-12"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M86,-1 L84,-6 L87,-5 L85,-10"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Bottom-left bolt */}
      <Path
        d="M10,101 L7,105 L12,104 L9,109 L14,107 L11,112"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Bottom-right bolt */}
      <Path
        d="M90,101 L93,105 L88,104 L91,109 L86,107 L89,112"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Side bolts */}
      <Path
        d="M-1,35 L-5,32 L-4,37 L-9,34 L-7,39"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M-1,65 L-4,62 L-3,67 L-7,65"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.5}
      />
      <Path
        d="M101,35 L105,32 L104,37 L109,34 L107,39"
        fill="none"
        stroke={`url(#${boltGrad})`}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.7}
      />
      <Path
        d="M101,65 L104,62 L103,67 L107,65"
        fill="none"
        stroke="#FFE066"
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Spark dots */}
      <Circle cx={50} cy={-5} r={1.8} fill="#FFE066" opacity={0.7} />
      <Circle cx={50} cy={105} r={1.8} fill="#FFE066" opacity={0.7} />
      <Circle cx={-5} cy={50} r={1.5} fill="#FFE066" opacity={0.6} />
      <Circle cx={105} cy={50} r={1.5} fill="#FFE066" opacity={0.6} />
      {/* Small sparks */}
      <Circle cx={25} cy={-3} r={0.8} fill="#FFD040" opacity={0.5} />
      <Circle cx={75} cy={-3} r={0.8} fill="#FFD040" opacity={0.5} />
      <Circle cx={25} cy={103} r={0.8} fill="#FFD040" opacity={0.5} />
      <Circle cx={75} cy={103} r={0.8} fill="#FFD040" opacity={0.5} />
      {/* Corner glow arcs */}
      <Path
        d={`M0,${rx} Q0,0 ${rx},0`}
        fill="none"
        stroke="#4A90D9"
        strokeWidth={5}
        opacity={0.15}
      />
      <Path
        d={`M${100 - rx},0 Q100,0 100,${rx}`}
        fill="none"
        stroke="#4A90D9"
        strokeWidth={5}
        opacity={0.15}
      />
      <Path
        d={`M0,${100 - rx} Q0,100 ${rx},100`}
        fill="none"
        stroke="#4A90D9"
        strokeWidth={5}
        opacity={0.15}
      />
      <Path
        d={`M${100 - rx},100 Q100,100 100,${100 - rx}`}
        fill="none"
        stroke="#4A90D9"
        strokeWidth={5}
        opacity={0.15}
      />
    </Svg>
  );
});
StormBoltFrame.displayName = 'StormBoltFrame';
