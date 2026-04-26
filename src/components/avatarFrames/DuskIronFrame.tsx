import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * DuskIronFrame — 暮铁
 *
 * 锻铁门栅 · 扭曲S形铁条穿越边框 · 鸢尾花冠角饰 · 锈蚀斑点 · 铆钉接合。
 */
export const DuskIronFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `diM${userId}`;
  const rustG = `diR${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6A6A70" stopOpacity={0.9} />
          <Stop offset="0.35" stopColor="#3A3A40" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#2A2A30" stopOpacity={1} />
          <Stop offset="1" stopColor="#6A6A70" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={rustG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B5A2B" stopOpacity={0.25} />
          <Stop offset="0.5" stopColor="#6A6A70" stopOpacity={0} />
          <Stop offset="1" stopColor="#8B5A2B" stopOpacity={0.25} />
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
        stroke="#0A0A10"
        strokeWidth={6.5}
        opacity={0.18}
      />
      {/* Main wrought iron frame */}
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
      {/* Rust patina */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${rustG})`}
        strokeWidth={2}
      />
      {/* Inner rail */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#3A3A40"
        strokeWidth={0.8}
        opacity={0.45}
      />
      {/* Twisted bar verticals — top edge */}
      <G opacity={0.4} stroke="#5A5A60" strokeWidth={0.8} fill="none">
        <Path d="M25,-5 Q26,-2 24,1 Q22,3 25,5" />
        <Path d="M40,-5 Q41,-2 39,1 Q37,3 40,5" />
        <Path d="M60,-5 Q61,-2 59,1 Q57,3 60,5" />
        <Path d="M75,-5 Q76,-2 74,1 Q72,3 75,5" />
      </G>
      {/* Twisted bar verticals — bottom edge */}
      <G opacity={0.4} stroke="#5A5A60" strokeWidth={0.8} fill="none">
        <Path d="M25,95 Q26,98 24,101 Q22,103 25,105" />
        <Path d="M40,95 Q41,98 39,101 Q37,103 40,105" />
        <Path d="M60,95 Q61,98 59,101 Q57,103 60,105" />
        <Path d="M75,95 Q76,98 74,101 Q72,103 75,105" />
      </G>
      {/* Fleur-de-lis finials at corners */}
      <G opacity={0.6} fill="#5A5A60">
        <Path d="M-1,-3 Q0,-7 1,-3 Q3,-5 1,-2 Q0,0 -1,-2 Z" />
        <Line x1={0} y1={-7} x2={0} y2={-3} stroke="#7A7A80" strokeWidth={0.4} />
      </G>
      <G opacity={0.6} fill="#5A5A60">
        <Path d="M99,-3 Q100,-7 101,-3 Q103,-5 101,-2 Q100,0 99,-2 Z" />
        <Line x1={100} y1={-7} x2={100} y2={-3} stroke="#7A7A80" strokeWidth={0.4} />
      </G>
      <G opacity={0.6} fill="#5A5A60">
        <Path d="M-1,103 Q0,107 1,103 Q3,105 1,102 Q0,100 -1,102 Z" />
        <Line x1={0} y1={103} x2={0} y2={107} stroke="#7A7A80" strokeWidth={0.4} />
      </G>
      <G opacity={0.6} fill="#5A5A60">
        <Path d="M99,103 Q100,107 101,103 Q103,105 101,102 Q100,100 99,102 Z" />
        <Line x1={100} y1={103} x2={100} y2={107} stroke="#7A7A80" strokeWidth={0.4} />
      </G>
      {/* Rust spots */}
      <Circle cx={15} cy={1} r={1.5} fill="#8B5A2B" opacity={0.2} />
      <Circle cx={85} cy={99} r={1.8} fill="#8B5A2B" opacity={0.18} />
      <Circle cx={-1} cy={40} r={1.3} fill="#8B5A2B" opacity={0.15} />
      <Circle cx={101} cy={65} r={1.5} fill="#8B5A2B" opacity={0.18} />
      {/* Rivet joints along edges */}
      <G opacity={0.5}>
        <Circle cx={12} cy={0} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={88} cy={0} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={12} cy={100} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={88} cy={100} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={0} cy={25} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={0} cy={75} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={100} cy={25} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
        <Circle cx={100} cy={75} r={1.2} fill="#4A4A50" stroke="#6A6A70" strokeWidth={0.3} />
      </G>
    </Svg>
  );
});
DuskIronFrame.displayName = 'DuskIronFrame';
