import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SunForgeFrame — 日锻
 *
 * 黄金日轮框 · 四角火焰日冕向外喷射 · 光芒线条 · 太阳纹章。
 */
export const SunForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `sfgM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F1C40F" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#D4AC0D" stopOpacity={1} />
          <Stop offset="1" stopColor="#F1C40F" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Outer glow */}
      <Rect
        x={-1}
        y={-1}
        width={102}
        height={102}
        rx={rx + 1}
        fill="none"
        stroke="#F9E79F"
        strokeWidth={1.5}
        opacity={0.3}
      />
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
      {/* Inner ring */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#F9E79F"
        strokeWidth={0.7}
        opacity={0.5}
      />
      {/* Solar corona flares at corners */}
      <Path
        d="M0,0 L-4,-7 L2,-3 L-1,-8 L4,-4 Z"
        fill="#D4AC0D"
        stroke="#F1C40F"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M100,0 L104,-7 L98,-3 L101,-8 L96,-4 Z"
        fill="#D4AC0D"
        stroke="#F1C40F"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M0,100 L-4,107 L2,103 L-1,108 L4,104 Z"
        fill="#D4AC0D"
        stroke="#F1C40F"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M100,100 L104,107 L98,103 L101,108 L96,104 Z"
        fill="#D4AC0D"
        stroke="#F1C40F"
        strokeWidth={0.5}
        opacity={0.85}
      />
      {/* Sunray spikes — top edge */}
      <Path d="M20,0 L22,-5 L24,0" fill="#D4AC0D" opacity={0.75} />
      <Path d="M35,0 L37,-4 L39,0" fill="#F1C40F" opacity={0.7} />
      <Path d="M48,0 L50,-6 L52,0" fill="#D4AC0D" opacity={0.8} />
      <Path d="M61,0 L63,-4 L65,0" fill="#F1C40F" opacity={0.7} />
      <Path d="M76,0 L78,-5 L80,0" fill="#D4AC0D" opacity={0.75} />
      {/* Sunray spikes — bottom */}
      <Path d="M20,100 L22,105 L24,100" fill="#D4AC0D" opacity={0.75} />
      <Path d="M48,100 L50,106 L52,100" fill="#D4AC0D" opacity={0.8} />
      <Path d="M76,100 L78,105 L80,100" fill="#D4AC0D" opacity={0.75} />
      {/* Side rays */}
      <Path d="M0,25 L-4,27 L0,29" fill="#D4AC0D" opacity={0.7} />
      <Path d="M0,48 L-5,50 L0,52" fill="#D4AC0D" opacity={0.75} />
      <Path d="M0,73 L-4,75 L0,77" fill="#D4AC0D" opacity={0.7} />
      <Path d="M100,25 L104,27 L100,29" fill="#D4AC0D" opacity={0.7} />
      <Path d="M100,48 L105,50 L100,52" fill="#D4AC0D" opacity={0.75} />
      <Path d="M100,73 L104,75 L100,77" fill="#D4AC0D" opacity={0.7} />
      {/* Sun emblem — top center */}
      <Circle
        cx={50}
        cy={-1}
        r={3}
        fill="#B7950B"
        stroke="#F1C40F"
        strokeWidth={0.7}
        opacity={0.7}
      />
      <Circle cx={50} cy={-1} r={1.5} fill="#F9E79F" opacity={0.8} />
      {/* Sun emblem — bottom center */}
      <Circle
        cx={50}
        cy={101}
        r={3}
        fill="#B7950B"
        stroke="#F1C40F"
        strokeWidth={0.7}
        opacity={0.7}
      />
      <Circle cx={50} cy={101} r={1.5} fill="#F9E79F" opacity={0.8} />
    </Svg>
  );
});
SunForgeFrame.displayName = 'SunForgeFrame';
