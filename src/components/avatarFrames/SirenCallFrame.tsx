import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SirenCallFrame — 海妖
 *
 * 青蓝贝壳框 · 四角大型海螺壳 · 波浪形边缘 · 珍珠点缀。
 */
export const SirenCallFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `scM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#48C9B0" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#1ABC9C" stopOpacity={1} />
          <Stop offset="1" stopColor="#48C9B0" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Base frame */}
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
      {/* Inner shimmer */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#A3E4D7"
        strokeWidth={0.7}
        opacity={0.45}
      />
      {/* Conch shells at corners */}
      <Path
        d="M-2,-2 Q-6,-6 -7,0 Q-6,4 -2,2 Q0,-1 -2,-2 Z"
        fill="#1ABC9C"
        stroke="#A3E4D7"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path d="M-4,-1 Q-5,1 -3,2" fill="none" stroke="#76D7C4" strokeWidth={0.5} opacity={0.6} />
      <Path
        d="M102,-2 Q106,-6 107,0 Q106,4 102,2 Q100,-1 102,-2 Z"
        fill="#1ABC9C"
        stroke="#A3E4D7"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path d="M104,-1 Q105,1 103,2" fill="none" stroke="#76D7C4" strokeWidth={0.5} opacity={0.6} />
      <Path
        d="M-2,102 Q-6,106 -7,100 Q-6,96 -2,98 Q0,101 -2,102 Z"
        fill="#1ABC9C"
        stroke="#A3E4D7"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M102,102 Q106,106 107,100 Q106,96 102,98 Q100,101 102,102 Z"
        fill="#1ABC9C"
        stroke="#A3E4D7"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Wave crest — top edge */}
      <Path
        d="M10,0 Q17,-5 24,0 Q31,-4 38,0 Q45,-5 52,0 Q59,-4 66,0 Q73,-5 80,0 Q87,-4 94,0"
        fill="none"
        stroke="#48C9B0"
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Wave crest — bottom edge */}
      <Path
        d="M10,100 Q17,105 24,100 Q31,104 38,100 Q45,105 52,100 Q59,104 66,100 Q73,105 80,100 Q87,104 94,100"
        fill="none"
        stroke="#48C9B0"
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Side wave crests */}
      <Path
        d="M0,15 Q-4,22 0,29 Q-3,36 0,43 Q-4,50 0,57 Q-3,64 0,71 Q-4,78 0,85"
        fill="none"
        stroke="#48C9B0"
        strokeWidth={1.3}
        opacity={0.6}
      />
      <Path
        d="M100,15 Q104,22 100,29 Q103,36 100,43 Q104,50 100,57 Q103,64 100,71 Q104,78 100,85"
        fill="none"
        stroke="#48C9B0"
        strokeWidth={1.3}
        opacity={0.6}
      />
      {/* Pearl dots */}
      <Circle
        cx={50}
        cy={-3}
        r={2}
        fill="#F0F0F0"
        stroke="#D5D8DC"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Circle
        cx={50}
        cy={103}
        r={2}
        fill="#F0F0F0"
        stroke="#D5D8DC"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Circle
        cx={-3}
        cy={50}
        r={1.8}
        fill="#F0F0F0"
        stroke="#D5D8DC"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <Circle
        cx={103}
        cy={50}
        r={1.8}
        fill="#F0F0F0"
        stroke="#D5D8DC"
        strokeWidth={0.5}
        opacity={0.75}
      />
      {/* Pearl highlights */}
      <Circle cx={49.5} cy={-3.5} r={0.6} fill="#FFFFFF" opacity={0.7} />
      <Circle cx={49.5} cy={102.5} r={0.6} fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
});
SirenCallFrame.displayName = 'SirenCallFrame';
