import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WitchMarkFrame — 巫印
 *
 * 巫术符号/五芒星框内 · 药草枝条沿边 · 蜡烛滴蜡角饰 · 月牙+星辰散布。
 */
export const WitchMarkFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wmM${userId}`;
  const hexG = `wmH${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A2050" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#251538" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#1A0D28" stopOpacity={1} />
          <Stop offset="1" stopColor="#3A2050" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={hexG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B6BB0" stopOpacity={0.25} />
          <Stop offset="0.5" stopColor="#5A3878" stopOpacity={0} />
          <Stop offset="1" stopColor="#8B6BB0" stopOpacity={0.25} />
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
        stroke="#0A0510"
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
      {/* Hex overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${hexG})`}
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
        stroke="#251538"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Pentacle — top center */}
      <G opacity={0.35} fill="none" stroke="#8B6BB0" strokeWidth={0.6}>
        <Circle cx={50} cy={-2} r={4} />
        <Path d="M50,-6 L48.5,-0.5 L53,1 L47,1 L51.5,-0.5 Z" />
      </G>
      {/* Herb sprigs — top edge (small paired leaves) */}
      <G opacity={0.4} fill="none" stroke="#4A6030" strokeWidth={0.5} strokeLinecap="round">
        <Path d="M15,-1 L18,-3 M18,-3 Q20,-5 22,-3 M18,-3 Q16,-5 14,-3" />
        <Path d="M30,-1 L33,-3 M33,-3 Q35,-5 37,-3 M33,-3 Q31,-5 29,-3" />
        <Path d="M70,-1 L73,-3 M73,-3 Q75,-5 77,-3 M73,-3 Q71,-5 69,-3" />
      </G>
      {/* Herb sprigs — bottom */}
      <G opacity={0.4} fill="none" stroke="#4A6030" strokeWidth={0.5} strokeLinecap="round">
        <Path d="M25,101 L28,103 M28,103 Q30,105 32,103 M28,103 Q26,105 24,103" />
        <Path d="M60,101 L63,103 M63,103 Q65,105 67,103 M63,103 Q61,105 59,103" />
      </G>
      {/* Candle + wax drip — top-left corner */}
      <G opacity={0.55}>
        <Rect x={-3} y={-6} width={2} height={5} fill="#D4A060" rx={0.5} />
        {/* Flame */}
        <Path d="M-2,-6 Q-1,-9 -2,-7 Q-3,-9 -2,-6" fill="#FFAA30" />
        {/* Wax drip */}
        <Path
          d="M-3,-1 Q-4,2 -3,4"
          stroke="#D4A060"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={-3} cy={4} r={0.6} fill="#D4A060" />
      </G>
      {/* Candle — bottom-right corner */}
      <G opacity={0.55}>
        <Rect x={101} y={101} width={2} height={5} fill="#D4A060" rx={0.5} />
        <Path d="M102,101 Q103,98 102,100 Q101,98 102,101" fill="#FFAA30" />
        <Path
          d="M103,106 Q104,108 103,110"
          stroke="#D4A060"
          strokeWidth={0.8}
          fill="none"
          strokeLinecap="round"
        />
      </G>
      {/* Crescent moon — right edge */}
      <G opacity={0.4}>
        <Path
          d="M104,40 Q108,45 104,50 Q106,45 104,40"
          fill="#C0B0D0"
          stroke="#8B6BB0"
          strokeWidth={0.3}
        />
      </G>
      {/* Stars scattered */}
      <G opacity={0.5}>
        <Circle cx={-4} cy={40} r={0.6} fill="#C0B0D0" />
        <Circle cx={-3} cy={65} r={0.5} fill="#D0C0E0" />
        <Circle cx={40} cy={104} r={0.5} fill="#C0B0D0" />
        <Circle cx={80} cy={-3} r={0.6} fill="#D0C0E0" />
      </G>
      {/* Cross marks (X) — sigils */}
      <G opacity={0.3} stroke="#8B6BB0" strokeWidth={0.4}>
        <Line x1={-4} y1={18} x2={-2} y2={22} />
        <Line x1={-2} y1={18} x2={-4} y2={22} />
        <Line x1={102} y1={78} x2={104} y2={82} />
        <Line x1={104} y1={78} x2={102} y2={82} />
      </G>
    </Svg>
  );
});
WitchMarkFrame.displayName = 'WitchMarkFrame';
