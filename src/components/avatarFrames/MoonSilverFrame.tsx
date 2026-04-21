import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const MoonSilverFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const moonGrad = `moonGrad${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={moonGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F0F2FF" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#C0C8E0" stopOpacity={1} />
          <Stop offset="1" stopColor="#8090B8" stopOpacity={0.95} />
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
        stroke={`url(#${moonGrad})`}
        strokeWidth={3.5}
      />
      {/* Inner accent line */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#B0B8D0"
        strokeWidth={1.2}
        opacity={0.7}
      />
      {/* Corner crescents — follow rx arc */}
      <Path
        d={`M0,${rx} A${rx - 4},${rx - 4} 0 0,1 ${rx},0`}
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M4,${rx - 4} A${Math.max(rx - 8, 2)},${Math.max(rx - 8, 2)} 0 0,1 ${rx - 4},4`}
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d={`M${100 - rx},0 A${rx - 4},${rx - 4} 0 0,1 100,${rx}`}
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M${104 - rx},4 A${Math.max(rx - 8, 2)},${Math.max(rx - 8, 2)} 0 0,1 96,${rx - 4}`}
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d={`M${rx},100 A${rx - 4},${rx - 4} 0 0,1 0,${100 - rx}`}
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M${rx - 4},96 A${Math.max(rx - 8, 2)},${Math.max(rx - 8, 2)} 0 0,1 4,${104 - rx}`}
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d={`M100,${100 - rx} A${rx - 4},${rx - 4} 0 0,1 ${100 - rx},100`}
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d={`M96,${104 - rx} A${Math.max(rx - 8, 2)},${Math.max(rx - 8, 2)} 0 0,1 ${104 - rx},96`}
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Corner starburst crosses */}
      <G opacity={0.4} stroke="#E8EAF8" strokeWidth={0.8} strokeLinecap="round">
        {/* Top-left */}
        <Line x1={rx * 0.29 - 5} y1={rx * 0.29} x2={rx * 0.29 + 5} y2={rx * 0.29} />
        <Line x1={rx * 0.29} y1={rx * 0.29 - 5} x2={rx * 0.29} y2={rx * 0.29 + 5} />
        {/* Top-right */}
        <Line x1={100 - rx * 0.29 - 5} y1={rx * 0.29} x2={100 - rx * 0.29 + 5} y2={rx * 0.29} />
        <Line x1={100 - rx * 0.29} y1={rx * 0.29 - 5} x2={100 - rx * 0.29} y2={rx * 0.29 + 5} />
        {/* Bottom-left */}
        <Line x1={rx * 0.29 - 5} y1={100 - rx * 0.29} x2={rx * 0.29 + 5} y2={100 - rx * 0.29} />
        <Line x1={rx * 0.29} y1={100 - rx * 0.29 - 5} x2={rx * 0.29} y2={100 - rx * 0.29 + 5} />
        {/* Bottom-right */}
        <Line
          x1={100 - rx * 0.29 - 5}
          y1={100 - rx * 0.29}
          x2={100 - rx * 0.29 + 5}
          y2={100 - rx * 0.29}
        />
        <Line
          x1={100 - rx * 0.29}
          y1={100 - rx * 0.29 - 5}
          x2={100 - rx * 0.29}
          y2={100 - rx * 0.29 + 5}
        />
      </G>
      {/* Edge diamonds — larger */}
      <Path d="M50,-4 L54,0 L50,4 L46,0 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M50,96 L54,100 L50,104 L46,100 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M-4,50 L0,46 L4,50 L0,54 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M96,50 L100,46 L104,50 L100,54 Z" fill="#D8DCF0" opacity={1} />
      {/* Moon phase dots along edges */}
      <G opacity={0.35} fill="#C8D0E8">
        <Circle cx={20} cy={0} r={1.2} />
        <Circle cx={80} cy={0} r={1.2} />
        <Circle cx={20} cy={100} r={1.2} />
        <Circle cx={80} cy={100} r={1.2} />
        <Circle cx={0} cy={20} r={1.2} />
        <Circle cx={0} cy={80} r={1.2} />
        <Circle cx={100} cy={20} r={1.2} />
        <Circle cx={100} cy={80} r={1.2} />
      </G>
      {/* Stars at mid-edges — larger */}
      <Circle cx={30} cy={-1} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={70} cy={-1} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={30} cy={101} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={70} cy={101} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={-1} cy={30} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={-1} cy={70} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={101} cy={30} r={2} fill="#E8EAF8" opacity={0.85} />
      <Circle cx={101} cy={70} r={2} fill="#E8EAF8" opacity={0.85} />
      {/* Extra mid-quarter stars */}
      <Circle cx={42} cy={-1.5} r={1.2} fill="#D8DCF0" opacity={0.6} />
      <Circle cx={58} cy={-1.5} r={1.2} fill="#D8DCF0" opacity={0.6} />
      <Circle cx={42} cy={101.5} r={1.2} fill="#D8DCF0" opacity={0.6} />
      <Circle cx={58} cy={101.5} r={1.2} fill="#D8DCF0" opacity={0.6} />
    </Svg>
  );
});
MoonSilverFrame.displayName = 'MoonSilverFrame';
