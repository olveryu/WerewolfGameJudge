import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SandStoneFrame — 砂岩
 *
 * 风蚀砂岩纹理 · 象形文字雕刻(水平短线+符号) · 裂缝沿角 · 沙粒散布。
 */
export const SandStoneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ssM${userId}`;
  const windG = `ssW${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D4B88C" stopOpacity={0.85} />
          <Stop offset="0.35" stopColor="#B89860" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#A08040" stopOpacity={1} />
          <Stop offset="1" stopColor="#D4B88C" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={windG} x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor="#E8D0A8" stopOpacity={0.3} />
          <Stop offset="0.4" stopColor="#C0A070" stopOpacity={0} />
          <Stop offset="1" stopColor="#E8D0A8" stopOpacity={0} />
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
        stroke="#302010"
        strokeWidth={6}
        opacity={0.15}
      />
      {/* Main sandstone */}
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
      {/* Wind erosion highlight */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${windG})`}
        strokeWidth={2}
      />
      {/* Inner groove */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#A08040"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Hieroglyphic carvings — top edge (simplified Egyptian-like symbols) */}
      <G opacity={0.35} fill="none" stroke="#806830" strokeWidth={0.6}>
        {/* Eye-like symbol */}
        <Path d="M18,-1 Q20,-3 22,-1 M20,-2 L20,0" />
        {/* Wave */}
        <Path d="M33,-1 Q35,-3 37,-1 Q39,-3 41,-1" />
        {/* Ankh-like cross */}
        <Path d="M55,-3 Q55,-5 57,-3 L57,0 M55.5,-1 L58.5,-1" />
        {/* Bird-like */}
        <Path d="M70,-2 L73,-4 L76,-2 L73,-1 Z" />
      </G>
      {/* Hieroglyphic carvings — bottom edge */}
      <G opacity={0.35} fill="none" stroke="#806830" strokeWidth={0.6}>
        <Path d="M22,101 Q24,103 26,101 M24,102 L24,100" />
        <Path d="M45,101 Q47,103 49,101 Q51,103 53,101" />
        <Path d="M68,100 L70,103 L72,100" />
        <Path d="M82,101 Q84,99 86,101 L84,103 Z" />
      </G>
      {/* Cracks from corners */}
      <G opacity={0.3} fill="none" stroke="#705020" strokeWidth={0.5} strokeLinecap="round">
        <Path d="M-2,-2 L3,4 L1,8 L5,12" />
        <Path d="M102,-2 L97,3 L99,7 L95,10" />
        <Path d="M-2,102 L4,97 L2,93 L6,90" />
        <Path d="M102,102 L98,97 L100,93" />
      </G>
      {/* Sand grains scatter */}
      <G opacity={0.4}>
        <Circle cx={10} cy={-3} r={0.6} fill="#D4B88C" />
        <Circle cx={30} cy={-4} r={0.4} fill="#C0A070" />
        <Circle cx={55} cy={-3} r={0.5} fill="#D4B88C" />
        <Circle cx={80} cy={-4} r={0.4} fill="#C0A070" />
        <Circle cx={-3} cy={20} r={0.5} fill="#D4B88C" />
        <Circle cx={-4} cy={55} r={0.4} fill="#C0A070" />
        <Circle cx={-3} cy={85} r={0.5} fill="#D4B88C" />
        <Circle cx={103} cy={30} r={0.4} fill="#C0A070" />
        <Circle cx={104} cy={68} r={0.5} fill="#D4B88C" />
        <Circle cx={25} cy={103} r={0.5} fill="#C0A070" />
        <Circle cx={65} cy={104} r={0.4} fill="#D4B88C" />
        <Circle cx={90} cy={103} r={0.5} fill="#C0A070" />
      </G>
      {/* Erosion pitting along edges */}
      <G opacity={0.2}>
        <Circle cx={45} cy={0} r={1.2} fill="none" stroke="#806830" strokeWidth={0.4} />
        <Circle cx={0} cy={42} r={1} fill="none" stroke="#806830" strokeWidth={0.4} />
        <Circle cx={100} cy={55} r={1.1} fill="none" stroke="#806830" strokeWidth={0.4} />
        <Circle cx={60} cy={100} r={1} fill="none" stroke="#806830" strokeWidth={0.4} />
      </G>
    </Svg>
  );
});
SandStoneFrame.displayName = 'SandStoneFrame';
