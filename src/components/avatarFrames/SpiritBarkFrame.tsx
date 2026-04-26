import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SpiritBarkFrame — 灵木
 *
 * 古树皮纹理(纵向不规则线条) · 灵魂面孔浮雕(空洞眼嘴) · 苔藓斑块 · 年轮内框。
 */
export const SpiritBarkFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `sbM${userId}`;
  const mossG = `sbMo${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6B5B3A" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#4A3A20" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#352A15" stopOpacity={1} />
          <Stop offset="1" stopColor="#6B5B3A" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={mossG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#4A8040" stopOpacity={0.3} />
          <Stop offset="0.3" stopColor="#308030" stopOpacity={0} />
          <Stop offset="1" stopColor="#4A8040" stopOpacity={0} />
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
        stroke="#1A1008"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Bark frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={5.5}
      />
      {/* Moss tint bottom */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mossG})`}
        strokeWidth={2}
      />
      {/* Tree ring inner border */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#4A3A20"
        strokeWidth={0.8}
        opacity={0.4}
      />
      <Rect
        x={8}
        y={8}
        width={84}
        height={84}
        rx={Math.max(rx - 7, 0)}
        fill="none"
        stroke="#5A4A30"
        strokeWidth={0.4}
        opacity={0.25}
      />
      {/* Bark texture — vertical irregular lines along left/right */}
      <G opacity={0.3} fill="none" stroke="#5A4A30" strokeWidth={0.5} strokeLinecap="round">
        <Path d="M-1,10 L0,15 L-1,20 L1,25 L-1,30" />
        <Path d="M1,35 L-1,40 L0,45 L-1,50" />
        <Path d="M0,55 L1,60 L-1,65 L0,70" />
        <Path d="M-1,75 L1,80 L-1,85 L0,90" />
        <Path d="M101,12 L100,18 L101,23 L99,28" />
        <Path d="M100,38 L101,43 L99,48 L101,53" />
        <Path d="M99,60 L101,65 L100,70 L101,78" />
        <Path d="M100,82 L99,87 L101,92" />
      </G>
      {/* Spirit face — left edge (hollow eyes + gaping mouth) */}
      <G opacity={0.45}>
        <Circle cx={-1} cy={35} r={1.8} fill="#1A1008" />
        <Circle cx={-1} cy={42} r={1.8} fill="#1A1008" />
        <Path d="M-3,48 Q-1,51 1,48" fill="#1A1008" />
      </G>
      {/* Spirit face — right edge */}
      <G opacity={0.4}>
        <Circle cx={101} cy={55} r={1.5} fill="#1A1008" />
        <Circle cx={101} cy={61} r={1.5} fill="#1A1008" />
        <Path d="M99,66 Q101,69 103,66" fill="#1A1008" />
      </G>
      {/* Moss patches */}
      <G opacity={0.4} fill="#4A8040">
        <Circle cx={5} cy={95} r={2.5} />
        <Circle cx={8} cy={93} r={1.5} />
        <Circle cx={3} cy={92} r={1} />
      </G>
      <G opacity={0.35} fill="#4A8040">
        <Circle cx={92} cy={98} r={2} />
        <Circle cx={95} cy={96} r={1.2} />
      </G>
      <G opacity={0.3} fill="#4A8040">
        <Circle cx={-3} cy={88} r={1.5} />
        <Circle cx={103} cy={90} r={1.8} />
      </G>
      {/* Knotholes */}
      <Circle
        cx={50}
        cy={-2}
        r={2}
        fill="#352A15"
        stroke="#4A3A20"
        strokeWidth={0.5}
        opacity={0.4}
      />
      <Circle
        cx={50}
        cy={102}
        r={2}
        fill="#352A15"
        stroke="#4A3A20"
        strokeWidth={0.5}
        opacity={0.4}
      />
    </Svg>
  );
});
SpiritBarkFrame.displayName = 'SpiritBarkFrame';
