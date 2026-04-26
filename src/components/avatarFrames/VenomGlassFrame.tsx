import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * VenomGlassFrame — 毒玻璃
 *
 * 半透明毒绿玻璃 · 气泡内含物(空心圆+高光点) · 酸蚀虚线内框 · 腐蚀弧角。
 */
export const VenomGlassFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `vgM${userId}`;
  const acidG = `vgA${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#88CC44" stopOpacity={0.7} />
          <Stop offset="0.35" stopColor="#448822" stopOpacity={0.9} />
          <Stop offset="0.65" stopColor="#225511" stopOpacity={1} />
          <Stop offset="1" stopColor="#88CC44" stopOpacity={0.7} />
        </LinearGradient>
        <LinearGradient id={acidG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#CCFF66" stopOpacity={0.3} />
          <Stop offset="0.4" stopColor="#88CC44" stopOpacity={0} />
          <Stop offset="1" stopColor="#CCFF66" stopOpacity={0} />
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
        stroke="#0A1A05"
        strokeWidth={6}
        opacity={0.15}
      />
      {/* Main glass frame */}
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
      {/* Acid bottom glow */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${acidG})`}
        strokeWidth={2}
      />
      {/* Inner etch — dashed */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#448822"
        strokeWidth={0.7}
        opacity={0.4}
        strokeDasharray="3,5"
      />
      {/* Bubble inclusions — hollow circles with bright highlight dots */}
      <G opacity={0.35}>
        <Circle cx={8} cy={12} r={2} fill="none" stroke="#88CC44" strokeWidth={0.5} />
        <Circle cx={8} cy={12} r={0.5} fill="#CCFF66" opacity={0.85} />
      </G>
      <G opacity={0.35}>
        <Circle cx={40} cy={-3} r={1.8} fill="none" stroke="#88CC44" strokeWidth={0.5} />
        <Circle cx={40} cy={-3} r={0.5} fill="#CCFF66" opacity={0.7} />
      </G>
      <G opacity={0.35}>
        <Circle cx={92} cy={15} r={1.6} fill="none" stroke="#88CC44" strokeWidth={0.5} />
        <Circle cx={92} cy={15} r={0.4} fill="#CCFF66" opacity={0.85} />
      </G>
      <Circle
        cx={15}
        cy={-2}
        r={1.5}
        fill="none"
        stroke="#88CC44"
        strokeWidth={0.5}
        opacity={0.3}
      />
      <Circle cx={70} cy={1} r={1.3} fill="none" stroke="#88CC44" strokeWidth={0.4} opacity={0.3} />
      <G opacity={0.3}>
        <Circle cx={-2} cy={45} r={1.8} fill="none" stroke="#88CC44" strokeWidth={0.5} />
      </G>
      <Circle
        cx={102}
        cy={60}
        r={1.4}
        fill="none"
        stroke="#88CC44"
        strokeWidth={0.4}
        opacity={0.3}
      />
      <G opacity={0.35}>
        <Circle cx={-3} cy={80} r={2} fill="none" stroke="#88CC44" strokeWidth={0.5} />
        <Circle cx={-3} cy={80} r={0.5} fill="#CCFF66" opacity={0.7} />
      </G>
      <Circle
        cx={25}
        cy={102}
        r={1.6}
        fill="none"
        stroke="#88CC44"
        strokeWidth={0.5}
        opacity={0.35}
      />
      <G opacity={0.3}>
        <Circle cx={60} cy={103} r={2} fill="none" stroke="#88CC44" strokeWidth={0.5} />
        <Circle cx={60} cy={103} r={0.6} fill="#CCFF66" opacity={0.7} />
      </G>
      <Circle
        cx={85}
        cy={90}
        r={1.3}
        fill="none"
        stroke="#88CC44"
        strokeWidth={0.4}
        opacity={0.3}
      />
      {/* Acid etch marks — zigzag */}
      <Path d="M10,-1 L13,0 L11,1" fill="none" stroke="#CCFF66" strokeWidth={0.4} opacity={0.3} />
      <Path
        d="M55,100 L58,101 L56,102"
        fill="none"
        stroke="#CCFF66"
        strokeWidth={0.4}
        opacity={0.3}
      />
      <Path d="M-1,35 L0,38 L1,36" fill="none" stroke="#CCFF66" strokeWidth={0.4} opacity={0.25} />
      <Path
        d="M100,70 L101,73 L99,71"
        fill="none"
        stroke="#CCFF66"
        strokeWidth={0.4}
        opacity={0.25}
      />
      {/* Corroded corner erosion arcs */}
      <Path
        d="M-1,-1 Q-3,3 0,5"
        fill="none"
        stroke="#225511"
        strokeWidth={1.5}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Path
        d="M101,-1 Q103,3 100,5"
        fill="none"
        stroke="#225511"
        strokeWidth={1.5}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Path
        d="M-1,101 Q-3,97 0,95"
        fill="none"
        stroke="#225511"
        strokeWidth={1.5}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Path
        d="M101,101 Q103,97 100,95"
        fill="none"
        stroke="#225511"
        strokeWidth={1.5}
        opacity={0.3}
        strokeLinecap="round"
      />
    </Svg>
  );
});
VenomGlassFrame.displayName = 'VenomGlassFrame';
