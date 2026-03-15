import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const DarkVineFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const vineGrad = `vineGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={vineGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A5A2A" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#0A3018" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Base frame — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${vineGrad})`}
        strokeWidth={2.5}
      />
      {/* Vine along top — overflow */}
      <Path
        d="M15,0 C20,-5 30,5 40,0 C50,-5 60,5 70,0 C80,-5 88,3 90,0"
        fill="none"
        stroke="#2D8B4A"
        strokeWidth={1.8}
        opacity={0.7}
      />
      {/* Vine along bottom */}
      <Path
        d="M10,100 C20,105 30,95 40,100 C50,105 60,95 70,100 C80,105 90,97 95,100"
        fill="none"
        stroke="#2D8B4A"
        strokeWidth={1.8}
        opacity={0.7}
      />
      {/* Vine along left */}
      <Path
        d="M0,15 C-5,25 5,35 0,45 C-5,55 5,65 0,75 C-5,82 3,88 0,90"
        fill="none"
        stroke="#2D8B4A"
        strokeWidth={1.8}
        opacity={0.7}
      />
      {/* Vine along right */}
      <Path
        d="M100,10 C105,20 95,30 100,40 C105,50 95,60 100,70 C105,78 97,85 100,90"
        fill="none"
        stroke="#2D8B4A"
        strokeWidth={1.8}
        opacity={0.7}
      />
      {/* Leaves at corners — overflow */}
      <Path d="M2,2 Q-3,-3 2,-3 Q7,-3 2,2 Z" fill="#34D399" opacity={0.7} />
      <Path d="M6,-1 Q4,-5 8,-3 Z" fill="#2AAA70" opacity={0.5} />
      <Path d="M98,2 Q103,-3 98,-3 Q93,-3 98,2 Z" fill="#34D399" opacity={0.7} />
      <Path d="M94,-1 Q96,-5 92,-3 Z" fill="#2AAA70" opacity={0.5} />
      <Path d="M2,98 Q-3,103 2,103 Q7,103 2,98 Z" fill="#34D399" opacity={0.7} />
      <Path d="M98,98 Q103,103 98,103 Q93,103 98,98 Z" fill="#34D399" opacity={0.7} />
      {/* Berries */}
      <Circle cx={25} cy={-2} r={1.5} fill="#8B1A1A" opacity={0.7} />
      <Circle cx={55} cy={102} r={1.5} fill="#8B1A1A" opacity={0.7} />
      <Circle cx={-2} cy={40} r={1.5} fill="#8B1A1A" opacity={0.7} />
      <Circle cx={102} cy={60} r={1.5} fill="#8B1A1A" opacity={0.7} />
    </Svg>
  );
});
DarkVineFrame.displayName = 'DarkVineFrame';
