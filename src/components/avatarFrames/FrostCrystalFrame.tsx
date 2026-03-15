import { memo, useId } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const FrostCrystalFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const frostGrad = `frostGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={frostGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A0D8F0" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#5090C0" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#203850" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      {/* Rounded frame — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${frostGrad})`}
        strokeWidth={2.5}
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
        strokeWidth={1}
        opacity={0.4}
      />
      {/* Crystal spikes at corners — overflow */}
      <Path d="M12,0 L5,-7 L-2,0 L5,7 Z" fill="#A0D8F0" opacity={0.5} />
      <Path d="M88,0 L95,-7 L102,0 L95,7 Z" fill="#A0D8F0" opacity={0.5} />
      <Path d="M0,88 L-7,95 L0,102 L7,95 Z" fill="#A0D8F0" opacity={0.5} />
      <Path d="M100,88 L107,95 L100,102 L93,95 Z" fill="#A0D8F0" opacity={0.5} />
      {/* Frost lines — overflow */}
      <Line x1={30} y1={0} x2={28} y2={-3} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      <Line x1={50} y1={0} x2={50} y2={-3} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      <Line x1={70} y1={0} x2={72} y2={-3} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      <Line x1={30} y1={100} x2={28} y2={103} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      <Line x1={50} y1={100} x2={50} y2={103} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      <Line x1={70} y1={100} x2={72} y2={103} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
      {/* Ice dots */}
      <Circle cx={50} cy={-2} r={1.2} fill="#C8E8FF" opacity={0.7} />
      <Circle cx={50} cy={102} r={1.2} fill="#C8E8FF" opacity={0.7} />
      <Circle cx={-2} cy={50} r={1.2} fill="#C8E8FF" opacity={0.7} />
      <Circle cx={102} cy={50} r={1.2} fill="#C8E8FF" opacity={0.7} />
    </Svg>
  );
});
FrostCrystalFrame.displayName = 'FrostCrystalFrame';
