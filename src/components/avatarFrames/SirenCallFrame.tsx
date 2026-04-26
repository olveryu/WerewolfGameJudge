import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SirenCallFrame — 海妖之歌
 *
 * 海蓝珍珠母 · 波浪弧沿边 · 贝壳扇形角饰 · 珍珠项链串 · 海藻飘带。
 */
export const SirenCallFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `scM${userId}`;
  const pearlG = `scP${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2080A0" stopOpacity={0.85} />
          <Stop offset="0.4" stopColor="#105878" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#084060" stopOpacity={1} />
          <Stop offset="1" stopColor="#2080A0" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={pearlG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E8D8C8" stopOpacity={0.25} />
          <Stop offset="0.5" stopColor="#C0B0A0" stopOpacity={0} />
          <Stop offset="1" stopColor="#E8D8C8" stopOpacity={0.25} />
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
        stroke="#041828"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Main */}
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
      {/* Pearl sheen */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${pearlG})`}
        strokeWidth={2}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#105878"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Wave crests — top edge */}
      <G opacity={0.45} fill="none" stroke="#40A0C0" strokeWidth={0.8}>
        <Path d="M10,0 Q15,-4 20,0 Q25,4 30,0" />
        <Path d="M35,0 Q40,-4 45,0 Q50,4 55,0" />
        <Path d="M60,0 Q65,-4 70,0 Q75,4 80,0" />
        <Path d="M82,0 Q87,-3 92,0" />
      </G>
      {/* Wave crests — bottom edge */}
      <G opacity={0.45} fill="none" stroke="#40A0C0" strokeWidth={0.8}>
        <Path d="M10,100 Q15,104 20,100 Q25,96 30,100" />
        <Path d="M35,100 Q40,104 45,100 Q50,96 55,100" />
        <Path d="M60,100 Q65,104 70,100 Q75,96 80,100" />
      </G>
      {/* Scallop shell — top-left corner */}
      <G opacity={0.5}>
        <Path
          d="M-4,-4 Q0,-8 4,-4 Q2,-1 0,0 Q-2,-1 -4,-4 Z"
          fill="#E8D8C8"
          stroke="#C0A890"
          strokeWidth={0.4}
        />
        <Path d="M-2,-5 L0,-1" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
        <Path d="M0,-6 L0,-1" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
        <Path d="M2,-5 L0,-1" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
      </G>
      {/* Scallop shell — bottom-right corner */}
      <G opacity={0.5}>
        <Path
          d="M96,104 Q100,108 104,104 Q102,101 100,100 Q98,101 96,104 Z"
          fill="#E8D8C8"
          stroke="#C0A890"
          strokeWidth={0.4}
        />
        <Path d="M98,105 L100,101" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
        <Path d="M100,106 L100,101" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
        <Path d="M102,105 L100,101" stroke="#C0A890" strokeWidth={0.3} opacity={0.5} />
      </G>
      {/* Pearl necklace string — left edge */}
      <G opacity={0.5}>
        <Circle cx={-2} cy={20} r={1.2} fill="#E8E0D4" stroke="#C0B0A0" strokeWidth={0.3} />
        <Circle cx={-3} cy={28} r={1} fill="#E8E0D4" stroke="#C0B0A0" strokeWidth={0.3} />
        <Circle cx={-2} cy={36} r={1.2} fill="#E8E0D4" stroke="#C0B0A0" strokeWidth={0.3} />
        <Circle cx={-3} cy={44} r={1} fill="#E8E0D4" stroke="#C0B0A0" strokeWidth={0.3} />
        <Circle cx={-2} cy={52} r={1.2} fill="#E8E0D4" stroke="#C0B0A0" strokeWidth={0.3} />
      </G>
      {/* Seaweed ribbon — right edge */}
      <G opacity={0.4} fill="none" stroke="#2A6040" strokeWidth={0.8} strokeLinecap="round">
        <Path d="M103,55 Q106,60 103,65 Q100,70 103,75 Q106,80 103,85" />
      </G>
      {/* Bubble accents */}
      <G opacity={0.35}>
        <Circle cx={92} cy={-3} r={1} fill="none" stroke="#80C0D0" strokeWidth={0.4} />
        <Circle cx={8} cy={103} r={1.2} fill="none" stroke="#80C0D0" strokeWidth={0.4} />
        <Circle cx={104} cy={45} r={0.8} fill="none" stroke="#80C0D0" strokeWidth={0.3} />
      </G>
    </Svg>
  );
});
SirenCallFrame.displayName = 'SirenCallFrame';
