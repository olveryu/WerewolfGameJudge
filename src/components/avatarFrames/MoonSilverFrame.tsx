import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const MoonSilverFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const moonGrad = `moonGrad${uid}`;
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
      {/* Corner crescents — overflow outward */}
      <Path
        d="M0,18 A14,14 0 0,1 18,0"
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M4,14 A10,10 0 0,1 14,4"
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d="M82,0 A14,14 0 0,1 100,18"
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M86,4 A10,10 0 0,1 96,14"
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d="M18,100 A14,14 0 0,1 0,82"
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M14,96 A10,10 0 0,1 4,86"
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Path
        d="M100,82 A14,14 0 0,1 82,100"
        fill="none"
        stroke="#F0F2FF"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M96,86 A10,10 0 0,1 86,96"
        fill="none"
        stroke="#C8D0E8"
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Edge diamonds — overflow */}
      <Path d="M50,-3 L53,0 L50,3 L47,0 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M50,97 L53,100 L50,103 L47,100 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M-3,50 L0,47 L3,50 L0,53 Z" fill="#D8DCF0" opacity={1} />
      <Path d="M97,50 L100,47 L103,50 L100,53 Z" fill="#D8DCF0" opacity={1} />
      {/* Stars at mid-edges */}
      <Circle cx={30} cy={-1} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={70} cy={-1} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={30} cy={101} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={70} cy={101} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={-1} cy={30} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={-1} cy={70} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={101} cy={30} r={1.5} fill="#E8EAF8" opacity={0.8} />
      <Circle cx={101} cy={70} r={1.5} fill="#E8EAF8" opacity={0.8} />
    </Svg>
  );
});
MoonSilverFrame.displayName = 'MoonSilverFrame';
