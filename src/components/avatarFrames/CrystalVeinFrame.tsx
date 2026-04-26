import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CrystalVeinFrame — 晶脉
 *
 * 透明晶棱 · 折射斜线 · 棱镜彩虹叠层 · 菱形角饰 · 中锋晶尖。
 */
export const CrystalVeinFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `cvM${userId}`;
  const prismG = `cvP${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E8F0FF" stopOpacity={0.85} />
          <Stop offset="0.3" stopColor="#A0C0E0" stopOpacity={1} />
          <Stop offset="0.6" stopColor="#7090B8" stopOpacity={1} />
          <Stop offset="1" stopColor="#E8F0FF" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={prismG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF6B6B" stopOpacity={0.3} />
          <Stop offset="0.33" stopColor="#6BFF6B" stopOpacity={0.3} />
          <Stop offset="0.66" stopColor="#6B6BFF" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FF6B6B" stopOpacity={0.3} />
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
        stroke="#304050"
        strokeWidth={6}
        opacity={0.12}
      />
      {/* Main crystal frame */}
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
      {/* Prism rainbow sheen */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${prismG})`}
        strokeWidth={1.5}
      />
      {/* Inner bevel */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#7090B8"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Diagonal refraction lines at corners */}
      <G opacity={0.45} stroke="#A0C0E0" strokeWidth={0.8}>
        <Line x1={-3} y1={8} x2={8} y2={-3} />
        <Line x1={92} y1={-3} x2={103} y2={8} />
        <Line x1={-3} y1={92} x2={8} y2={103} />
        <Line x1={92} y1={103} x2={103} y2={92} />
      </G>
      <G opacity={0.35} stroke="#B0D0F0" strokeWidth={0.6}>
        <Line x1={-3} y1={16} x2={16} y2={-3} />
        <Line x1={84} y1={-3} x2={103} y2={16} />
        <Line x1={-3} y1={84} x2={16} y2={103} />
        <Line x1={84} y1={103} x2={103} y2={84} />
      </G>
      {/* Diamond prisms at corners */}
      <Path
        d="M-3,0 L0,-5 L3,0 L0,5 Z"
        fill="#E8F0FF"
        stroke="#7090B8"
        strokeWidth={0.5}
        opacity={0.6}
      />
      <Path
        d="M100,-5 L103,0 L100,5 L97,0 Z"
        fill="#E8F0FF"
        stroke="#7090B8"
        strokeWidth={0.5}
        opacity={0.6}
      />
      <Path
        d="M-3,100 L0,95 L3,100 L0,105 Z"
        fill="#E8F0FF"
        stroke="#7090B8"
        strokeWidth={0.5}
        opacity={0.6}
      />
      <Path
        d="M100,105 L103,100 L100,95 L97,100 Z"
        fill="#E8F0FF"
        stroke="#7090B8"
        strokeWidth={0.5}
        opacity={0.6}
      />
      {/* Mid-edge crystal points */}
      <Path d="M48,-5 L50,-8 L52,-5" fill="none" stroke="#B0D0F0" strokeWidth={0.8} opacity={0.5} />
      <Path
        d="M48,105 L50,108 L52,105"
        fill="none"
        stroke="#B0D0F0"
        strokeWidth={0.8}
        opacity={0.5}
      />
      <Path d="M-5,48 L-8,50 L-5,52" fill="none" stroke="#B0D0F0" strokeWidth={0.8} opacity={0.5} />
      <Path
        d="M105,48 L108,50 L105,52"
        fill="none"
        stroke="#B0D0F0"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Refraction sparkles — different colors from prism */}
      <Circle cx={15} cy={-2} r={0.6} fill="#FF9090" opacity={0.4} />
      <Circle cx={30} cy={-3} r={0.5} fill="#90FF90" opacity={0.4} />
      <Circle cx={70} cy={-2} r={0.6} fill="#9090FF" opacity={0.4} />
      <Circle cx={85} cy={-3} r={0.5} fill="#FF9090" opacity={0.4} />
    </Svg>
  );
});
CrystalVeinFrame.displayName = 'CrystalVeinFrame';
