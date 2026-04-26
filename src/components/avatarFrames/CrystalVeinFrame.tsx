import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CrystalVeinFrame — 晶脉
 *
 * 深色框体上裂开发光的水晶脉络 · 脉络从四角向中心延伸 · 裂口内透出青白光芒。
 */
export const CrystalVeinFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `cvM${userId}`;
  const veinG = `cvV${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2C3E50" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#1A252F" stopOpacity={1} />
          <Stop offset="1" stopColor="#2C3E50" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={veinG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#76D7EA" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#48C9B0" stopOpacity={0.8} />
        </LinearGradient>
      </Defs>
      {/* Base dark frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={5}
      />
      {/* Crystal veins — glowing cracks extending beyond frame */}
      {/* Top-left vein cluster */}
      <Path
        d="M-3,-3 L8,0 L12,5 L8,8"
        fill="none"
        stroke={`url(#${veinG})`}
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M-2,5 L5,3 L10,8"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Top-right vein cluster */}
      <Path
        d="M103,-3 L92,0 L88,5 L92,8"
        fill="none"
        stroke={`url(#${veinG})`}
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M102,5 L95,3 L90,8"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Bottom-left vein cluster */}
      <Path
        d="M-3,103 L8,100 L12,95 L8,92"
        fill="none"
        stroke={`url(#${veinG})`}
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M-2,95 L5,97 L10,92"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Bottom-right vein cluster */}
      <Path
        d="M103,103 L92,100 L88,95 L92,92"
        fill="none"
        stroke={`url(#${veinG})`}
        strokeWidth={1.5}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M102,95 L95,97 L90,92"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Mid-edge vein branches */}
      <Path
        d="M45,-3 L50,3 L55,-3"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M45,103 L50,97 L55,103"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M-3,45 L3,50 L-3,55"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M103,45 L97,50 L103,55"
        fill="none"
        stroke="#76D7EA"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      {/* Glow nodes at vein junctions */}
      <Circle cx={-1} cy={-1} r={2} fill="#76D7EA" opacity={0.6} />
      <Circle cx={101} cy={-1} r={2} fill="#76D7EA" opacity={0.6} />
      <Circle cx={-1} cy={101} r={2} fill="#76D7EA" opacity={0.6} />
      <Circle cx={101} cy={101} r={2} fill="#76D7EA" opacity={0.6} />
      <Circle cx={50} cy={-2} r={1.5} fill="#48C9B0" opacity={0.7} />
      <Circle cx={50} cy={102} r={1.5} fill="#48C9B0" opacity={0.7} />
      <Circle cx={-2} cy={50} r={1.5} fill="#48C9B0" opacity={0.7} />
      <Circle cx={102} cy={50} r={1.5} fill="#48C9B0" opacity={0.7} />
    </Svg>
  );
});
CrystalVeinFrame.displayName = 'CrystalVeinFrame';
