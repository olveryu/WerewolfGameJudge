import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const FrostCrystalFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const frostGrad = `frostGrad${uid}`;
  const c = rx * 0.29;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={frostGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A0D8F0" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#5090C0" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#203850" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      {/* Rounded frame — thicker */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${frostGrad})`}
        strokeWidth={3.5}
      />
      {/* Inner rounded line */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#5090C0"
        strokeWidth={1.2}
        opacity={0.5}
      />
      {/* Crystal spikes at corners — larger with dark outline */}
      <Path
        d={`M${c + 9},${c} L${c},${c - 9} L${c - 9},${c} L${c},${c + 9} Z`}
        fill="none"
        stroke="#3070A0"
        strokeWidth={1}
        opacity={0.4}
      />
      <Path
        d={`M${c + 7},${c} L${c},${c - 7} L${c - 7},${c} L${c},${c + 7} Z`}
        fill="#A0D8F0"
        opacity={0.6}
      />
      <Path
        d={`M${100 - c + 9},${c} L${100 - c},${c - 9} L${100 - c - 9},${c} L${100 - c},${c + 9} Z`}
        fill="none"
        stroke="#3070A0"
        strokeWidth={1}
        opacity={0.4}
      />
      <Path
        d={`M${100 - c + 7},${c} L${100 - c},${c - 7} L${100 - c - 7},${c} L${100 - c},${c + 7} Z`}
        fill="#A0D8F0"
        opacity={0.6}
      />
      <Path
        d={`M${c + 9},${100 - c} L${c},${100 - c - 9} L${c - 9},${100 - c} L${c},${100 - c + 9} Z`}
        fill="none"
        stroke="#3070A0"
        strokeWidth={1}
        opacity={0.4}
      />
      <Path
        d={`M${c + 7},${100 - c} L${c},${100 - c - 7} L${c - 7},${100 - c} L${c},${100 - c + 7} Z`}
        fill="#A0D8F0"
        opacity={0.6}
      />
      <Path
        d={`M${100 - c + 9},${100 - c} L${100 - c},${100 - c - 9} L${100 - c - 9},${100 - c} L${100 - c},${100 - c + 9} Z`}
        fill="none"
        stroke="#3070A0"
        strokeWidth={1}
        opacity={0.4}
      />
      <Path
        d={`M${100 - c + 7},${100 - c} L${100 - c},${100 - c - 7} L${100 - c - 7},${100 - c} L${100 - c},${100 - c + 7} Z`}
        fill="#A0D8F0"
        opacity={0.6}
      />
      {/* Crystal center dots */}
      <Circle cx={c} cy={c} r={1.5} fill="#E0F4FF" opacity={0.8} />
      <Circle cx={100 - c} cy={c} r={1.5} fill="#E0F4FF" opacity={0.8} />
      <Circle cx={c} cy={100 - c} r={1.5} fill="#E0F4FF" opacity={0.8} />
      <Circle cx={100 - c} cy={100 - c} r={1.5} fill="#E0F4FF" opacity={0.8} />
      {/* Frost lines — thicker, more prominent */}
      <G opacity={0.6} stroke="#A0D8F0" strokeWidth={1.2} strokeLinecap="round">
        <Line x1={25} y1={0} x2={23} y2={-4} />
        <Line x1={40} y1={0} x2={40} y2={-3} />
        <Line x1={50} y1={0} x2={50} y2={-4} />
        <Line x1={60} y1={0} x2={60} y2={-3} />
        <Line x1={75} y1={0} x2={77} y2={-4} />
        <Line x1={25} y1={100} x2={23} y2={104} />
        <Line x1={40} y1={100} x2={40} y2={103} />
        <Line x1={50} y1={100} x2={50} y2={104} />
        <Line x1={60} y1={100} x2={60} y2={103} />
        <Line x1={75} y1={100} x2={77} y2={104} />
        <Line x1={0} y1={25} x2={-4} y2={23} />
        <Line x1={0} y1={50} x2={-4} y2={50} />
        <Line x1={0} y1={75} x2={-4} y2={77} />
        <Line x1={100} y1={25} x2={104} y2={23} />
        <Line x1={100} y1={50} x2={104} y2={50} />
        <Line x1={100} y1={75} x2={104} y2={77} />
      </G>
      {/* Mid-edge snowflake crosses */}
      <G opacity={0.45} stroke="#C8E8FF" strokeWidth={0.8} strokeLinecap="round">
        <Line x1={48} y1={-2} x2={52} y2={-2} />
        <Line x1={50} y1={-4} x2={50} y2={0} />
        <Line x1={48} y1={102} x2={52} y2={102} />
        <Line x1={50} y1={100} x2={50} y2={104} />
        <Line x1={-2} y1={48} x2={-2} y2={52} />
        <Line x1={-4} y1={50} x2={0} y2={50} />
        <Line x1={102} y1={48} x2={102} y2={52} />
        <Line x1={100} y1={50} x2={104} y2={50} />
      </G>
      {/* Ice dots — larger */}
      <Circle cx={50} cy={-2} r={1.8} fill="#C8E8FF" opacity={0.8} />
      <Circle cx={50} cy={102} r={1.8} fill="#C8E8FF" opacity={0.8} />
      <Circle cx={-2} cy={50} r={1.8} fill="#C8E8FF" opacity={0.8} />
      <Circle cx={102} cy={50} r={1.8} fill="#C8E8FF" opacity={0.8} />
      {/* Icicle protrusions at bottom edge */}
      <Path d="M30,100 L30,105 L32,100" fill="#5090C0" opacity={0.4} />
      <Path d="M45,100 L45,106 L47,100" fill="#5090C0" opacity={0.35} />
      <Path d="M55,100 L55,106 L57,100" fill="#5090C0" opacity={0.35} />
      <Path d="M70,100 L70,105 L72,100" fill="#5090C0" opacity={0.4} />
    </Svg>
  );
});
FrostCrystalFrame.displayName = 'FrostCrystalFrame';
