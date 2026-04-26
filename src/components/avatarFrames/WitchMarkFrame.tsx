import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WitchMarkFrame — 巫痕
 *
 * 暗橙巫术框 · 四角巫术五角星标记 · 刻痕纹路延伸 · 魔力火焰点。
 */
export const WitchMarkFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wmM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E67E22" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#AF601A" stopOpacity={1} />
          <Stop offset="1" stopColor="#E67E22" stopOpacity={0.9} />
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
        strokeWidth={4.5}
      />
      {/* Inner etch */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#F0B27A"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Pentagram marks at corners — bold and visible */}
      <Path
        d="M0,-6 L1.5,-1.5 L6,0 L1.5,1.5 L0,6 L-1.5,1.5 L-6,0 L-1.5,-1.5 Z"
        fill="#AF601A"
        stroke="#E67E22"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="#F0B27A" strokeWidth={0.4} opacity={0.6} />
      <Path
        d="M100,-6 L101.5,-1.5 L106,0 L101.5,1.5 L100,6 L98.5,1.5 L94,0 L98.5,-1.5 Z"
        fill="#AF601A"
        stroke="#E67E22"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path d="M97,-3 L103,3 M103,-3 L97,3" stroke="#F0B27A" strokeWidth={0.4} opacity={0.6} />
      <Path
        d="M0,94 L1.5,98.5 L6,100 L1.5,101.5 L0,106 L-1.5,101.5 L-6,100 L-1.5,98.5 Z"
        fill="#AF601A"
        stroke="#E67E22"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path d="M-3,97 L3,103 M3,97 L-3,103" stroke="#F0B27A" strokeWidth={0.4} opacity={0.6} />
      <Path
        d="M100,94 L101.5,98.5 L106,100 L101.5,101.5 L100,106 L98.5,101.5 L94,100 L98.5,98.5 Z"
        fill="#AF601A"
        stroke="#E67E22"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Scratch marks along edges */}
      <Path
        d="M20,-1 L18,-5 L22,-3"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M40,-1 L38,-4 L42,-2"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d="M60,-1 L58,-5 L62,-3"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M80,-1 L78,-4 L82,-2"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.55}
        strokeLinecap="round"
      />
      {/* Scratches — bottom */}
      <Path
        d="M25,101 L23,105 L27,103"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M50,101 L48,104 L52,102"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d="M75,101 L73,105 L77,103"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Side scratches */}
      <Path
        d="M-1,25 L-4,23 L-2,27"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M-1,60 L-5,58 L-3,62"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M101,40 L104,38 L102,42"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M101,75 L105,73 L103,77"
        fill="none"
        stroke="#AF601A"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Arcane flame dots */}
      <Circle cx={50} cy={-3} r={1.8} fill="#E67E22" opacity={0.7} />
      <Circle cx={50} cy={-3.5} r={0.7} fill="#F9E79F" opacity={0.8} />
      <Circle cx={50} cy={103} r={1.8} fill="#E67E22" opacity={0.7} />
      <Circle cx={-3} cy={50} r={1.5} fill="#E67E22" opacity={0.6} />
      <Circle cx={103} cy={50} r={1.5} fill="#E67E22" opacity={0.6} />
    </Svg>
  );
});
WitchMarkFrame.displayName = 'WitchMarkFrame';
