import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * StarForgeFrame — 星锻
 *
 * 深紫星空框 · 四角八芒星徽章 · 星轨弧线连接 · 星点散布。
 */
export const StarForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `sfM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6C3483" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#4A235A" stopOpacity={1} />
          <Stop offset="1" stopColor="#6C3483" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#1A0A2E"
        strokeWidth={6}
        opacity={0.15}
      />
      {/* Main frame */}
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
      {/* Eight-pointed star badges at corners */}
      <Path
        d="M0,-6 L2,-2 L6,0 L2,2 L0,6 L-2,2 L-6,0 L-2,-2 Z"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M100,-6 L102,-2 L106,0 L102,2 L100,6 L98,2 L94,0 L98,-2 Z"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M0,94 L2,98 L6,100 L2,102 L0,106 L-2,102 L-6,100 L-2,98 Z"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M100,94 L102,98 L106,100 L102,102 L100,106 L98,102 L94,100 L98,98 Z"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.5}
        opacity={0.85}
      />
      {/* Star trail arcs connecting corners */}
      <Path d="M6,0 Q50,-5 94,0" fill="none" stroke="#BB8FCE" strokeWidth={1} opacity={0.5} />
      <Path d="M6,100 Q50,105 94,100" fill="none" stroke="#BB8FCE" strokeWidth={1} opacity={0.5} />
      <Path d="M0,6 Q-5,50 0,94" fill="none" stroke="#BB8FCE" strokeWidth={1} opacity={0.5} />
      <Path d="M100,6 Q105,50 100,94" fill="none" stroke="#BB8FCE" strokeWidth={1} opacity={0.5} />
      {/* Mid-edge small stars */}
      <Path d="M50,-3 L51,-1 L53,0 L51,1 L50,3 L49,1 L47,0 L49,-1 Z" fill="#D2B4DE" opacity={0.7} />
      <Path
        d="M50,97 L51,99 L53,100 L51,101 L50,103 L49,101 L47,100 L49,99 Z"
        fill="#D2B4DE"
        opacity={0.7}
      />
      <Path d="M-3,50 L-1,51 L0,53 L1,51 L3,50 L1,49 L0,47 L-1,49 Z" fill="#D2B4DE" opacity={0.7} />
      <Path
        d="M97,50 L99,51 L100,53 L101,51 L103,50 L101,49 L100,47 L99,49 Z"
        fill="#D2B4DE"
        opacity={0.7}
      />
      {/* Scattered star dots */}
      <Circle cx={25} cy={-3} r={1} fill="#E8DAEF" opacity={0.7} />
      <Circle cx={75} cy={-3} r={0.8} fill="#E8DAEF" opacity={0.6} />
      <Circle cx={-3} cy={30} r={0.8} fill="#E8DAEF" opacity={0.6} />
      <Circle cx={103} cy={70} r={0.8} fill="#E8DAEF" opacity={0.6} />
      <Circle cx={35} cy={103} r={1} fill="#E8DAEF" opacity={0.7} />
      <Circle cx={80} cy={103} r={0.8} fill="#E8DAEF" opacity={0.6} />
    </Svg>
  );
});
StarForgeFrame.displayName = 'StarForgeFrame';
