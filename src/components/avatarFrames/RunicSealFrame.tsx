import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const RunicSealFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const runicGrad = `runicGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={runicGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7B5FBF" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#4B3F8F" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Main frame — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${runicGrad})`}
        strokeWidth={2.5}
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
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* Top rune marks — overflow */}
      <G opacity={0.7}>
        <Line x1={25} y1={-2} x2={25} y2={3} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={23} y1={0.5} x2={27} y2={0.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
        <Line x1={50} y1={-2} x2={50} y2={3} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={48} y1={0.5} x2={52} y2={0.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
        <Line x1={75} y1={-2} x2={75} y2={3} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={73} y1={0.5} x2={77} y2={0.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
      </G>
      {/* Bottom rune marks */}
      <G opacity={0.7}>
        <Line x1={25} y1={97} x2={25} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={50} y1={97} x2={50} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={75} y1={97} x2={75} y2={102} stroke="#9B8BFF" strokeWidth={1.5} />
      </G>
      {/* Left rune marks */}
      <G opacity={0.7}>
        <Line x1={-2} y1={25} x2={3} y2={25} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={-2} y1={50} x2={3} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={-2} y1={75} x2={3} y2={75} stroke="#9B8BFF" strokeWidth={1.5} />
      </G>
      {/* Right rune marks */}
      <G opacity={0.7}>
        <Line x1={97} y1={25} x2={102} y2={25} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={97} y1={50} x2={102} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
        <Line x1={97} y1={75} x2={102} y2={75} stroke="#9B8BFF" strokeWidth={1.5} />
      </G>
      {/* Corner glyphs — overflow */}
      <Path d="M0,0 L3,-3 L6,0 L3,3 Z" fill="#A78BFA" opacity={0.85} />
      <Path d="M94,0 L97,-3 L100,0 L97,3 Z" fill="#A78BFA" opacity={0.85} />
      <Path d="M0,100 L3,97 L6,100 L3,103 Z" fill="#A78BFA" opacity={0.85} />
      <Path d="M94,100 L97,97 L100,100 L97,103 Z" fill="#A78BFA" opacity={0.85} />
      {/* Glow dots */}
      <Circle cx={0} cy={0} r={1.5} fill="#BBA0FF" opacity={0.4} />
      <Circle cx={100} cy={0} r={1.5} fill="#BBA0FF" opacity={0.4} />
      <Circle cx={0} cy={100} r={1.5} fill="#BBA0FF" opacity={0.4} />
      <Circle cx={100} cy={100} r={1.5} fill="#BBA0FF" opacity={0.4} />
    </Svg>
  );
});
RunicSealFrame.displayName = 'RunicSealFrame';
