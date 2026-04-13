import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * DragonScaleFrame — 龙鳞
 *
 * 苍绿龙鳞甲 · 金色鳞弧四边 · 双叉龙角 + 宝石眼 + 利爪。
 */
export const DragonScaleFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const drgGrad = `drgG${uid}`;
  const goldGrad = `drgGold${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={drgGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2A6B3A" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#1A4A28" stopOpacity={1} />
          <Stop offset="1" stopColor="#0D3018" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={goldGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D4AA30" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#8A6E18" stopOpacity={0.8} />
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
        stroke="#081808"
        strokeWidth={5.5}
        opacity={0.25}
      />
      {/* Outer frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${drgGrad})`}
        strokeWidth={4.5}
      />
      {/* Inner gold trim */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Scale arcs — top */}
      <G opacity={0.55} fill="none" stroke="#C9A84C" strokeWidth={1}>
        <Path d="M18,0 Q21,-4 24,0" />
        <Path d="M24,0 Q27,-4 30,0" />
        <Path d="M30,0 Q33,-4 36,0" />
        <Path d="M36,0 Q39,-4 42,0" />
        <Path d="M42,0 Q45,-4 48,0" />
        <Path d="M52,0 Q55,-4 58,0" />
        <Path d="M58,0 Q61,-4 64,0" />
        <Path d="M64,0 Q67,-4 70,0" />
        <Path d="M70,0 Q73,-4 76,0" />
        <Path d="M76,0 Q79,-4 82,0" />
      </G>
      {/* Scale arcs — bottom */}
      <G opacity={0.55} fill="none" stroke="#C9A84C" strokeWidth={1}>
        <Path d="M18,100 Q21,104 24,100" />
        <Path d="M24,100 Q27,104 30,100" />
        <Path d="M30,100 Q33,104 36,100" />
        <Path d="M36,100 Q39,104 42,100" />
        <Path d="M42,100 Q45,104 48,100" />
        <Path d="M52,100 Q55,104 58,100" />
        <Path d="M58,100 Q61,104 64,100" />
        <Path d="M64,100 Q67,104 70,100" />
        <Path d="M70,100 Q73,104 76,100" />
        <Path d="M76,100 Q79,104 82,100" />
      </G>
      {/* Scale arcs — left */}
      <G opacity={0.55} fill="none" stroke="#C9A84C" strokeWidth={1}>
        <Path d="M0,18 Q-4,21 0,24" />
        <Path d="M0,24 Q-4,27 0,30" />
        <Path d="M0,30 Q-4,33 0,36" />
        <Path d="M0,36 Q-4,39 0,42" />
        <Path d="M0,58 Q-4,61 0,64" />
        <Path d="M0,64 Q-4,67 0,70" />
        <Path d="M0,70 Q-4,73 0,76" />
        <Path d="M0,76 Q-4,79 0,82" />
      </G>
      {/* Scale arcs — right */}
      <G opacity={0.55} fill="none" stroke="#C9A84C" strokeWidth={1}>
        <Path d="M100,18 Q104,21 100,24" />
        <Path d="M100,24 Q104,27 100,30" />
        <Path d="M100,30 Q104,33 100,36" />
        <Path d="M100,36 Q104,39 100,42" />
        <Path d="M100,58 Q104,61 100,64" />
        <Path d="M100,64 Q104,67 100,70" />
        <Path d="M100,70 Q104,73 100,76" />
        <Path d="M100,76 Q104,79 100,82" />
      </G>
      {/* Dragon horns — top-left (2-prong) */}
      <Path
        d="M6,2 Q0,-6 -5,-4 Q-2,-2 2,1"
        fill="#1A4A28"
        stroke="#C9A84C"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Path
        d="M3,0 Q-3,-10 -6,-8 Q-1,-5 2,-1"
        fill="#2A6B3A"
        stroke="#8A6E18"
        strokeWidth={0.6}
        opacity={0.6}
      />
      {/* Dragon horns — top-right */}
      <Path
        d="M94,2 Q100,-6 105,-4 Q102,-2 98,1"
        fill="#1A4A28"
        stroke="#C9A84C"
        strokeWidth={0.8}
        opacity={0.8}
      />
      <Path
        d="M97,0 Q103,-10 106,-8 Q101,-5 98,-1"
        fill="#2A6B3A"
        stroke="#8A6E18"
        strokeWidth={0.6}
        opacity={0.6}
      />
      {/* Dragon eye gems — top-left */}
      <Circle cx={5} cy={5} r={3.5} fill="none" stroke="#C9A84C" strokeWidth={0.6} opacity={0.4} />
      <Circle cx={5} cy={5} r={2.2} fill="#C9A84C" opacity={0.85} />
      <Circle cx={5} cy={5} r={1} fill="#FFE066" opacity={0.95} />
      <Circle cx={4.5} cy={4.5} r={0.4} fill="#fff" opacity={0.8} />
      {/* Dragon eye gems — top-right */}
      <Circle cx={95} cy={5} r={3.5} fill="none" stroke="#C9A84C" strokeWidth={0.6} opacity={0.4} />
      <Circle cx={95} cy={5} r={2.2} fill="#C9A84C" opacity={0.85} />
      <Circle cx={95} cy={5} r={1} fill="#FFE066" opacity={0.95} />
      <Circle cx={94.5} cy={4.5} r={0.4} fill="#fff" opacity={0.8} />
      {/* Bottom corner claws */}
      <Path
        d="M3,100 Q-2,104 -4,102 Q0,101 3,100"
        fill="#1A4A28"
        stroke="#8A6E18"
        strokeWidth={0.5}
        opacity={0.6}
      />
      <Path
        d="M97,100 Q102,104 104,102 Q100,101 97,100"
        fill="#1A4A28"
        stroke="#8A6E18"
        strokeWidth={0.5}
        opacity={0.6}
      />
      {/* Mid-edge diamond gems */}
      <Path
        d="M48,0 L50,-4 L52,0"
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <Path
        d="M48,100 L50,104 L52,100"
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <Path
        d="M0,48 L-4,50 L0,52"
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={1.2}
        opacity={0.7}
      />
      <Path
        d="M100,48 L104,50 L100,52"
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={1.2}
        opacity={0.7}
      />
    </Svg>
  );
});
DragonScaleFrame.displayName = 'DragonScaleFrame';
