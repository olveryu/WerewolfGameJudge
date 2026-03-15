import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const RunicSealFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const runicGrad = `runicGrad${uid}`;
  const c = rx * 0.29;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={runicGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7B5FBF" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#4B3F8F" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Main frame — thicker */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${runicGrad})`}
        strokeWidth={3.5}
      />
      {/* Inner frame */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#5B4FA0"
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Corner arcane arcs — glow behind glyphs */}
      <Path
        d={`M0,${rx} Q0,0 ${rx},0`}
        fill="none"
        stroke="#9B8BFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
      />
      <Path
        d={`M${100 - rx},0 Q100,0 100,${rx}`}
        fill="none"
        stroke="#9B8BFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
      />
      <Path
        d={`M0,${100 - rx} Q0,100 ${rx},100`}
        fill="none"
        stroke="#9B8BFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
      />
      <Path
        d={`M${100 - rx},100 Q100,100 100,${100 - rx}`}
        fill="none"
        stroke="#9B8BFF"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.25}
      />
      {/* Top rune marks — 5 marks with cross-bars */}
      <G opacity={0.75}>
        <Line x1={18} y1={-2} x2={18} y2={4} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={16} y1={1} x2={20} y2={1} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={35} y1={-2} x2={35} y2={4} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={33} y1={1} x2={37} y2={1} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={50} y1={-2} x2={50} y2={4} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={48} y1={1} x2={52} y2={1} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={65} y1={-2} x2={65} y2={4} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={63} y1={1} x2={67} y2={1} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={82} y1={-2} x2={82} y2={4} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={80} y1={1} x2={84} y2={1} stroke="#9B8BFF" strokeWidth={0.8} />
      </G>
      {/* Bottom rune marks */}
      <G opacity={0.75}>
        <Line x1={18} y1={96} x2={18} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={16} y1={99} x2={20} y2={99} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={35} y1={96} x2={35} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={50} y1={96} x2={50} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={65} y1={96} x2={65} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={82} y1={96} x2={82} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={80} y1={99} x2={84} y2={99} stroke="#9B8BFF" strokeWidth={0.8} />
      </G>
      {/* Left rune marks */}
      <G opacity={0.75}>
        <Line x1={-2} y1={18} x2={4} y2={18} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={1} y1={16} x2={1} y2={20} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={-2} y1={35} x2={4} y2={35} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={-2} y1={50} x2={4} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={-2} y1={65} x2={4} y2={65} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={-2} y1={82} x2={4} y2={82} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={1} y1={80} x2={1} y2={84} stroke="#9B8BFF" strokeWidth={0.8} />
      </G>
      {/* Right rune marks */}
      <G opacity={0.75}>
        <Line x1={96} y1={18} x2={102} y2={18} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={99} y1={16} x2={99} y2={20} stroke="#9B8BFF" strokeWidth={0.8} />
        <Line x1={96} y1={35} x2={102} y2={35} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={96} y1={50} x2={102} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={96} y1={65} x2={102} y2={65} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={96} y1={82} x2={102} y2={82} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={99} y1={80} x2={99} y2={84} stroke="#9B8BFF" strokeWidth={0.8} />
      </G>
      {/* Corner glyphs — larger diamonds with outer ring */}
      <Circle cx={c} cy={c} r={5} fill="none" stroke="#A78BFA" strokeWidth={0.8} opacity={0.35} />
      <Path
        d={`M${c - 4},${c} L${c},${c - 4} L${c + 4},${c} L${c},${c + 4} Z`}
        fill="#A78BFA"
        opacity={0.9}
      />
      <Circle
        cx={100 - c}
        cy={c}
        r={5}
        fill="none"
        stroke="#A78BFA"
        strokeWidth={0.8}
        opacity={0.35}
      />
      <Path
        d={`M${100 - c - 4},${c} L${100 - c},${c - 4} L${100 - c + 4},${c} L${100 - c},${c + 4} Z`}
        fill="#A78BFA"
        opacity={0.9}
      />
      <Circle
        cx={c}
        cy={100 - c}
        r={5}
        fill="none"
        stroke="#A78BFA"
        strokeWidth={0.8}
        opacity={0.35}
      />
      <Path
        d={`M${c - 4},${100 - c} L${c},${100 - c - 4} L${c + 4},${100 - c} L${c},${100 - c + 4} Z`}
        fill="#A78BFA"
        opacity={0.9}
      />
      <Circle
        cx={100 - c}
        cy={100 - c}
        r={5}
        fill="none"
        stroke="#A78BFA"
        strokeWidth={0.8}
        opacity={0.35}
      />
      <Path
        d={`M${100 - c - 4},${100 - c} L${100 - c},${100 - c - 4} L${100 - c + 4},${100 - c} L${100 - c},${100 - c + 4} Z`}
        fill="#A78BFA"
        opacity={0.9}
      />
      {/* Glow dots — larger */}
      <Circle cx={c} cy={c} r={2} fill="#BBA0FF" opacity={0.5} />
      <Circle cx={100 - c} cy={c} r={2} fill="#BBA0FF" opacity={0.5} />
      <Circle cx={c} cy={100 - c} r={2} fill="#BBA0FF" opacity={0.5} />
      <Circle cx={100 - c} cy={100 - c} r={2} fill="#BBA0FF" opacity={0.5} />
      {/* Mid-edge seal diamonds */}
      <Path d="M50,-3 L52.5,0 L50,3 L47.5,0 Z" fill="#A78BFA" opacity={0.6} />
      <Path d="M50,97 L52.5,100 L50,103 L47.5,100 Z" fill="#A78BFA" opacity={0.6} />
      <Path d="M-3,50 L0,47.5 L3,50 L0,52.5 Z" fill="#A78BFA" opacity={0.6} />
      <Path d="M97,50 L100,47.5 L103,50 L100,52.5 Z" fill="#A78BFA" opacity={0.6} />
    </Svg>
  );
});
RunicSealFrame.displayName = 'RunicSealFrame';
