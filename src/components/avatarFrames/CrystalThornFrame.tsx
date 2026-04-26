import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CrystalThornFrame — 晶棘
 *
 * 紫水晶尖刺从边框向外突出 · 四角大晶簇 · 内圈高光弧线 · 碎晶散布。
 */
export const CrystalThornFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ctM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9B59B6" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#6C3483" stopOpacity={1} />
          <Stop offset="1" stopColor="#9B59B6" stopOpacity={0.95} />
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
      {/* Inner highlight */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#D2B4DE"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Top crystal spikes */}
      <Path
        d="M15,0 L17,-7 L19,0"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M30,0 L33,-6 L36,0"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M48,0 L50,-8 L52,0"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M64,0 L67,-6 L70,0"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M81,0 L83,-7 L85,0"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Bottom crystal spikes */}
      <Path
        d="M15,100 L17,107 L19,100"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M30,100 L33,106 L36,100"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M48,100 L50,108 L52,100"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M64,100 L67,106 L70,100"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M81,100 L83,107 L85,100"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Left crystal spikes */}
      <Path
        d="M0,15 L-7,17 L0,19"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M0,35 L-6,38 L0,41"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M0,55 L-7,58 L0,61"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M0,78 L-6,81 L0,84"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      {/* Right crystal spikes */}
      <Path
        d="M100,15 L107,17 L100,19"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M100,35 L106,38 L100,41"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      <Path
        d="M100,55 L107,58 L100,61"
        fill="#8E44AD"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M100,78 L106,81 L100,84"
        fill="#7D3C98"
        stroke="#D2B4DE"
        strokeWidth={0.6}
        opacity={0.75}
      />
      {/* Corner crystal clusters */}
      <Path d="M3,3 L-5,-5 L3,0 Z" fill="#9B59B6" opacity={0.85} />
      <Path d="M1,5 L-6,-1 L2,2 Z" fill="#7D3C98" opacity={0.7} />
      <Path d="M97,3 L105,-5 L97,0 Z" fill="#9B59B6" opacity={0.85} />
      <Path d="M99,5 L106,-1 L98,2 Z" fill="#7D3C98" opacity={0.7} />
      <Path d="M3,97 L-5,105 L3,100 Z" fill="#9B59B6" opacity={0.85} />
      <Path d="M1,95 L-6,101 L2,98 Z" fill="#7D3C98" opacity={0.7} />
      <Path d="M97,97 L105,105 L97,100 Z" fill="#9B59B6" opacity={0.85} />
      <Path d="M99,95 L106,101 L98,98 Z" fill="#7D3C98" opacity={0.7} />
      {/* Crystal highlight dots */}
      <Circle cx={50} cy={-4} r={1.2} fill="#E8DAEF" opacity={0.8} />
      <Circle cx={50} cy={104} r={1.2} fill="#E8DAEF" opacity={0.8} />
      <Circle cx={-4} cy={50} r={1.2} fill="#E8DAEF" opacity={0.8} />
      <Circle cx={104} cy={50} r={1.2} fill="#E8DAEF" opacity={0.8} />
    </Svg>
  );
});
CrystalThornFrame.displayName = 'CrystalThornFrame';
