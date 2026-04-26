import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * RavenWingFrame — 鸦羽
 *
 * 漆黑乌鸦翼框 · 四角大型翼展向外张开 · 羽毛层叠覆盖边缘 · 鸦眼红色宝石。
 */
export const RavenWingFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `rwM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2C2C34" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#121216" stopOpacity={1} />
          <Stop offset="1" stopColor="#2C2C34" stopOpacity={0.95} />
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
        stroke="#000005"
        strokeWidth={6}
        opacity={0.2}
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
      {/* Wing spread — top-left */}
      <Path
        d="M-1,-1 L-7,-5 L-4,3 Z"
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M2,-1 L-3,-8 L0,2 Z"
        fill="#222228"
        stroke="#3A3A44"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <Path d="M5,-1 L1,-7 L4,1 Z" fill="#1A1A20" opacity={0.65} />
      {/* Wing spread — top-right */}
      <Path
        d="M101,-1 L107,-5 L104,3 Z"
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M98,-1 L103,-8 L100,2 Z"
        fill="#222228"
        stroke="#3A3A44"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <Path d="M95,-1 L99,-7 L96,1 Z" fill="#1A1A20" opacity={0.65} />
      {/* Wing spread — bottom-left */}
      <Path
        d="M-1,101 L-7,105 L-4,97 Z"
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M2,101 L-3,108 L0,98 Z"
        fill="#222228"
        stroke="#3A3A44"
        strokeWidth={0.5}
        opacity={0.75}
      />
      {/* Wing spread — bottom-right */}
      <Path
        d="M101,101 L107,105 L104,97 Z"
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.6}
        opacity={0.85}
      />
      <Path
        d="M98,101 L103,108 L100,98 Z"
        fill="#222228"
        stroke="#3A3A44"
        strokeWidth={0.5}
        opacity={0.75}
      />
      {/* Feather overlaps — top edge */}
      <Path
        d="M15,-1 Q20,-5 25,-1"
        fill="#1A1A20"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Path
        d="M30,-1 Q35,-4 40,-1"
        fill="#222228"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.65}
      />
      <Path
        d="M45,-1 Q50,-5 55,-1"
        fill="#1A1A20"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Path
        d="M60,-1 Q65,-4 70,-1"
        fill="#222228"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.65}
      />
      <Path
        d="M75,-1 Q80,-5 85,-1"
        fill="#1A1A20"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.7}
      />
      {/* Feather overlaps — bottom edge */}
      <Path
        d="M15,101 Q20,105 25,101"
        fill="#1A1A20"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Path
        d="M35,101 Q40,104 45,101"
        fill="#222228"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.65}
      />
      <Path
        d="M55,101 Q60,105 65,101"
        fill="#1A1A20"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Path
        d="M75,101 Q80,104 85,101"
        fill="#222228"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.65}
      />
      {/* Raven eye gems — two red jewels */}
      <Circle
        cx={-2}
        cy={50}
        r={2.5}
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Circle cx={-2} cy={50} r={1.2} fill="#CC2222" opacity={0.9} />
      <Circle cx={-1.5} cy={49.5} r={0.4} fill="#FF4444" opacity={0.8} />
      <Circle
        cx={102}
        cy={50}
        r={2.5}
        fill="#1A1A20"
        stroke="#3A3A44"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Circle cx={102} cy={50} r={1.2} fill="#CC2222" opacity={0.9} />
      <Circle cx={102.5} cy={49.5} r={0.4} fill="#FF4444" opacity={0.8} />
      {/* Oil-sheen highlight */}
      <Path d="M20,0 Q50,-2 80,0" fill="none" stroke="#4A4A5A" strokeWidth={0.6} opacity={0.4} />
    </Svg>
  );
});
RavenWingFrame.displayName = 'RavenWingFrame';
