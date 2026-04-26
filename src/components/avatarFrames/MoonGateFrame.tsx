import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * MoonGateFrame — 月门
 *
 * 银白月拱门 · 四角新月弯钩向外延伸 · 星点散布 · 月晕弧光。
 */
export const MoonGateFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `mgM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D5D8DC" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#ABB2B9" stopOpacity={1} />
          <Stop offset="1" stopColor="#D5D8DC" stopOpacity={0.9} />
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
        stroke="#E8E8F0"
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
        strokeWidth={4}
      />
      {/* Inner arc */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#E8E8F0"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Crescent hooks at corners — large, extending outward */}
      <Path
        d="M-2,-2 Q-7,-2 -7,5 Q-4,2 -2,0 Z"
        fill="#C0C5CC"
        stroke="#E8E8F0"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M102,-2 Q107,-2 107,5 Q104,2 102,0 Z"
        fill="#C0C5CC"
        stroke="#E8E8F0"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M-2,102 Q-7,102 -7,95 Q-4,98 -2,100 Z"
        fill="#C0C5CC"
        stroke="#E8E8F0"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M102,102 Q107,102 107,95 Q104,98 102,100 Z"
        fill="#C0C5CC"
        stroke="#E8E8F0"
        strokeWidth={0.5}
        opacity={0.8}
      />
      {/* Moon arch — top center */}
      <Path d="M35,-2 Q50,-10 65,-2" fill="none" stroke="#D5D8DC" strokeWidth={2} opacity={0.7} />
      <Path d="M38,-1 Q50,-7 62,-1" fill="none" stroke="#E8E8F0" strokeWidth={0.8} opacity={0.5} />
      {/* Moon arch — bottom center */}
      <Path d="M35,102 Q50,110 65,102" fill="none" stroke="#D5D8DC" strokeWidth={2} opacity={0.7} />
      {/* Side crescents */}
      <Path d="M-2,35 Q-8,50 -2,65" fill="none" stroke="#D5D8DC" strokeWidth={1.8} opacity={0.6} />
      <Path
        d="M102,35 Q108,50 102,65"
        fill="none"
        stroke="#D5D8DC"
        strokeWidth={1.8}
        opacity={0.6}
      />
      {/* Star dots */}
      <Circle cx={50} cy={-6} r={1.5} fill="#F0F0F8" opacity={0.8} />
      <Circle cx={30} cy={-4} r={1} fill="#E8E8F0" opacity={0.7} />
      <Circle cx={70} cy={-4} r={1} fill="#E8E8F0" opacity={0.7} />
      <Circle cx={-4} cy={50} r={1.2} fill="#F0F0F8" opacity={0.7} />
      <Circle cx={104} cy={50} r={1.2} fill="#F0F0F8" opacity={0.7} />
      <Circle cx={50} cy={106} r={1.5} fill="#F0F0F8" opacity={0.8} />
      {/* Tiny stars scatter */}
      <Circle cx={15} cy={-3} r={0.6} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={85} cy={-3} r={0.6} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={-3} cy={20} r={0.6} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={103} cy={80} r={0.6} fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
});
MoonGateFrame.displayName = 'MoonGateFrame';
