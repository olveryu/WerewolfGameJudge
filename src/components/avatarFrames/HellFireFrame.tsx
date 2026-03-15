import { memo, useId } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const HellFireFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const hfireGrad = `hfireGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={hfireGrad} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FF6B20" stopOpacity={0.95} />
          <Stop offset="0.3" stopColor="#CC2200" stopOpacity={0.9} />
          <Stop offset="0.6" stopColor="#4A1800" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#4A1800" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Frame — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${hfireGrad})`}
        strokeWidth={2.5}
      />
      {/* Bottom flame tongues — overflow downward */}
      <Path d="M15,100 Q12,88 18,82 Q14,90 20,100" fill="#FF6B20" opacity={0.8} />
      <Path d="M30,100 Q26,85 33,78 Q28,87 35,100" fill="#CC2200" opacity={0.85} />
      <Path d="M45,100 Q42,82 50,74 Q46,84 52,100" fill="#FF8830" opacity={0.9} />
      <Path d="M60,100 Q56,80 63,74 Q58,84 65,100" fill="#FF6B20" opacity={0.85} />
      <Path d="M75,100 Q72,86 78,80 Q74,88 80,100" fill="#CC2200" opacity={0.8} />
      <Path d="M88,100 Q85,90 90,84 Q87,92 92,100" fill="#FF6B20" opacity={0.7} />
      {/* Side flame wisps */}
      <Path d="M0,82 Q-5,76 0,70" fill="none" stroke="#FF6B20" strokeWidth={1.5} opacity={0.6} />
      <Path
        d="M100,82 Q105,76 100,70"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Ember particles */}
      <Circle cx={20} cy={92} r={1} fill="#FFB020" opacity={0.7} />
      <Circle cx={40} cy={86} r={0.8} fill="#FFCC40" opacity={0.6} />
      <Circle cx={65} cy={88} r={1} fill="#FFB020" opacity={0.7} />
      <Circle cx={85} cy={94} r={0.7} fill="#FFCC40" opacity={0.5} />
      <Circle cx={50} cy={80} r={0.8} fill="#FF8830" opacity={0.6} />
      {/* Top edge accent */}
      <Line x1={20} y1={0} x2={80} y2={0} stroke="#CC2200" strokeWidth={1} opacity={0.4} />
    </Svg>
  );
});
HellFireFrame.displayName = 'HellFireFrame';
