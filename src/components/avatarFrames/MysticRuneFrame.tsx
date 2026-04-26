import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * MysticRuneFrame — 神秘符文
 *
 * 双圆法阵角饰 · 正弦能量脉络沿边 · 十字符文中锋 · 蓝紫光芒粒子。
 */
export const MysticRuneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `mrM${userId}`;
  const glowG = `mrGl${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#2A3B6B" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#1A2545" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#101830" stopOpacity={1} />
          <Stop offset="1" stopColor="#2A3B6B" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={glowG} x1="0.5" y1="0.5" x2="1" y2="1">
          <Stop offset="0" stopColor="#5588FF" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#3355CC" stopOpacity={0} />
          <Stop offset="1" stopColor="#5588FF" stopOpacity={0.3} />
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
        stroke="#080D1A"
        strokeWidth={6}
        opacity={0.2}
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
      {/* Glow overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${glowG})`}
        strokeWidth={2}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#2A3B6B"
        strokeWidth={0.7}
        opacity={0.45}
      />
      {/* Arcane circles at corners — double ring */}
      <G opacity={0.4} fill="none" stroke="#5588FF">
        <Circle cx={0} cy={0} r={5} strokeWidth={0.7} />
        <Circle cx={0} cy={0} r={3} strokeWidth={0.4} />
        <Circle cx={100} cy={0} r={5} strokeWidth={0.7} />
        <Circle cx={100} cy={0} r={3} strokeWidth={0.4} />
        <Circle cx={0} cy={100} r={5} strokeWidth={0.7} />
        <Circle cx={0} cy={100} r={3} strokeWidth={0.4} />
        <Circle cx={100} cy={100} r={5} strokeWidth={0.7} />
        <Circle cx={100} cy={100} r={3} strokeWidth={0.4} />
      </G>
      {/* Sigil X marks inside corner circles */}
      <G opacity={0.5} stroke="#88BBFF" strokeWidth={0.5}>
        <Path d="M-2,-2 L2,2 M2,-2 L-2,2" />
        <Path d="M98,-2 L102,2 M102,-2 L98,2" />
        <Path d="M-2,98 L2,102 M2,98 L-2,102" />
        <Path d="M98,98 L102,102 M102,98 L98,102" />
      </G>
      {/* Energy vein — sinusoidal waves along top edge */}
      <G opacity={0.35} fill="none" stroke="#5588FF" strokeWidth={0.6}>
        <Path d="M12,0 Q16,-2 20,0 Q24,2 28,0" />
        <Path d="M38,0 Q42,-2 46,0 Q50,2 54,0" />
        <Path d="M60,0 Q64,-2 68,0 Q72,2 76,0" />
      </G>
      {/* Energy vein — bottom edge */}
      <G opacity={0.35} fill="none" stroke="#5588FF" strokeWidth={0.6}>
        <Path d="M12,100 Q16,102 20,100 Q24,98 28,100" />
        <Path d="M38,100 Q42,102 46,100 Q50,98 54,100" />
        <Path d="M60,100 Q64,102 68,100 Q72,98 76,100" />
      </G>
      {/* Rune cross marks — mid-edges */}
      <G opacity={0.5} stroke="#88BBFF" strokeWidth={0.5}>
        <Line x1={50} y1={-5} x2={50} y2={-2} />
        <Line x1={48} y1={-4} x2={52} y2={-4} />
      </G>
      <G opacity={0.5} stroke="#88BBFF" strokeWidth={0.5}>
        <Line x1={50} y1={102} x2={50} y2={105} />
        <Line x1={48} y1={104} x2={52} y2={104} />
      </G>
      <G opacity={0.5} stroke="#88BBFF" strokeWidth={0.5}>
        <Line x1={-5} y1={50} x2={-2} y2={50} />
        <Line x1={-4} y1={48} x2={-4} y2={52} />
      </G>
      <G opacity={0.5} stroke="#88BBFF" strokeWidth={0.5}>
        <Line x1={102} y1={50} x2={105} y2={50} />
        <Line x1={104} y1={48} x2={104} y2={52} />
      </G>
      {/* Glow dots along edges */}
      <Circle cx={20} cy={-3} r={0.8} fill="#5588FF" opacity={0.45} />
      <Circle cx={80} cy={-3} r={0.8} fill="#5588FF" opacity={0.45} />
      <Circle cx={-3} cy={30} r={0.7} fill="#5588FF" opacity={0.4} />
      <Circle cx={-3} cy={70} r={0.7} fill="#5588FF" opacity={0.4} />
      <Circle cx={103} cy={30} r={0.7} fill="#5588FF" opacity={0.4} />
      <Circle cx={103} cy={70} r={0.7} fill="#5588FF" opacity={0.4} />
      <Circle cx={20} cy={103} r={0.8} fill="#5588FF" opacity={0.45} />
      <Circle cx={80} cy={103} r={0.8} fill="#5588FF" opacity={0.45} />
    </Svg>
  );
});
MysticRuneFrame.displayName = 'MysticRuneFrame';
