import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WraithBoneFrame — 亡灵骨甲
 *
 * 枯骨白灰色 · 肋骨弧形沿边 · 四角骷髅头(空心眼+鼻孔+嘴齿) · 骨钉。
 */
export const WraithBoneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wbM${userId}`;
  const marrowG = `wbMr${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D8D0C0" stopOpacity={0.85} />
          <Stop offset="0.35" stopColor="#A09880" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#807060" stopOpacity={1} />
          <Stop offset="1" stopColor="#D8D0C0" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={marrowG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#C0B090" stopOpacity={0.25} />
          <Stop offset="0.5" stopColor="#A09880" stopOpacity={0} />
          <Stop offset="1" stopColor="#C0B090" stopOpacity={0.25} />
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
        stroke="#1A1510"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Bone frame */}
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
      {/* Marrow tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${marrowG})`}
        strokeWidth={1.5}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#A09880"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Rib cage arcs — top */}
      <G opacity={0.4} fill="none" stroke="#B0A890" strokeWidth={0.8}>
        <Path d="M15,0 Q20,-4 25,0" />
        <Path d="M30,0 Q35,-4 40,0" />
        <Path d="M45,0 Q50,-4 55,0" />
        <Path d="M60,0 Q65,-4 70,0" />
        <Path d="M75,0 Q80,-4 85,0" />
      </G>
      {/* Rib cage arcs — bottom */}
      <G opacity={0.4} fill="none" stroke="#B0A890" strokeWidth={0.8}>
        <Path d="M15,100 Q20,104 25,100" />
        <Path d="M30,100 Q35,104 40,100" />
        <Path d="M45,100 Q50,104 55,100" />
        <Path d="M60,100 Q65,104 70,100" />
        <Path d="M75,100 Q80,104 85,100" />
      </G>
      {/* Rib arcs — left */}
      <G opacity={0.35} fill="none" stroke="#B0A890" strokeWidth={0.7}>
        <Path d="M0,20 Q-4,25 0,30" />
        <Path d="M0,40 Q-4,45 0,50" />
        <Path d="M0,60 Q-4,65 0,70" />
        <Path d="M0,80 Q-4,85 0,90" />
      </G>
      {/* Rib arcs — right */}
      <G opacity={0.35} fill="none" stroke="#B0A890" strokeWidth={0.7}>
        <Path d="M100,20 Q104,25 100,30" />
        <Path d="M100,40 Q104,45 100,50" />
        <Path d="M100,60 Q104,65 100,70" />
        <Path d="M100,80 Q104,85 100,90" />
      </G>
      {/* Skull — top-left corner */}
      <G opacity={0.55}>
        <Circle cx={0} cy={0} r={4.5} fill="#C8C0B0" stroke="#807060" strokeWidth={0.5} />
        <Circle cx={-1.5} cy={-0.5} r={1} fill="#2A2520" />
        <Circle cx={1.5} cy={-0.5} r={1} fill="#2A2520" />
        <Path d="M-0.5,1 L0.5,1" stroke="#2A2520" strokeWidth={0.4} />
        <Path
          d="M-1.5,2.5 L-0.5,2.2 L0.5,2.5 L1.5,2.2"
          fill="none"
          stroke="#2A2520"
          strokeWidth={0.3}
        />
      </G>
      {/* Skull — top-right */}
      <G opacity={0.55}>
        <Circle cx={100} cy={0} r={4.5} fill="#C8C0B0" stroke="#807060" strokeWidth={0.5} />
        <Circle cx={98.5} cy={-0.5} r={1} fill="#2A2520" />
        <Circle cx={101.5} cy={-0.5} r={1} fill="#2A2520" />
        <Path d="M99.5,1 L100.5,1" stroke="#2A2520" strokeWidth={0.4} />
        <Path
          d="M98.5,2.5 L99.5,2.2 L100.5,2.5 L101.5,2.2"
          fill="none"
          stroke="#2A2520"
          strokeWidth={0.3}
        />
      </G>
      {/* Skull — bottom-left */}
      <G opacity={0.55}>
        <Circle cx={0} cy={100} r={4.5} fill="#C8C0B0" stroke="#807060" strokeWidth={0.5} />
        <Circle cx={-1.5} cy={99.5} r={1} fill="#2A2520" />
        <Circle cx={1.5} cy={99.5} r={1} fill="#2A2520" />
        <Path d="M-0.5,101 L0.5,101" stroke="#2A2520" strokeWidth={0.4} />
      </G>
      {/* Skull — bottom-right */}
      <G opacity={0.55}>
        <Circle cx={100} cy={100} r={4.5} fill="#C8C0B0" stroke="#807060" strokeWidth={0.5} />
        <Circle cx={98.5} cy={99.5} r={1} fill="#2A2520" />
        <Circle cx={101.5} cy={99.5} r={1} fill="#2A2520" />
        <Path d="M99.5,101 L100.5,101" stroke="#2A2520" strokeWidth={0.4} />
      </G>
      {/* Bone pegs / nails */}
      <G opacity={0.5}>
        <Circle cx={50} cy={-1} r={1} fill="#A09880" stroke="#807060" strokeWidth={0.3} />
        <Circle cx={50} cy={101} r={1} fill="#A09880" stroke="#807060" strokeWidth={0.3} />
        <Circle cx={-1} cy={50} r={1} fill="#A09880" stroke="#807060" strokeWidth={0.3} />
        <Circle cx={101} cy={50} r={1} fill="#A09880" stroke="#807060" strokeWidth={0.3} />
      </G>
    </Svg>
  );
});
WraithBoneFrame.displayName = 'WraithBoneFrame';
