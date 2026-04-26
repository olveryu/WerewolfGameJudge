import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SandStoneFrame — 砂岩
 *
 * 风化砂岩框 · 四角裂出的楔形石块 · 象形符号浮雕 · 风蚀曲线轮廓。
 */
export const SandStoneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ssM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D4B88C" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#B89860" stopOpacity={1} />
          <Stop offset="0.6" stopColor="#A08040" stopOpacity={1} />
          <Stop offset="1" stopColor="#D4B88C" stopOpacity={0.9} />
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
        strokeWidth={5}
      />
      {/* Broken stone wedges at corners */}
      <Path
        d="M-2,-2 L-6,-6 L3,-5 L-4,3 Z"
        fill="#C0A060"
        stroke="#D4B88C"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M102,-2 L106,-6 L97,-5 L104,3 Z"
        fill="#C0A060"
        stroke="#D4B88C"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M-2,102 L-6,106 L3,105 L-4,97 Z"
        fill="#C0A060"
        stroke="#D4B88C"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M102,102 L106,106 L97,105 L104,97 Z"
        fill="#C0A060"
        stroke="#D4B88C"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Erosion cracks extending from corners */}
      <Path
        d="M-4,-4 L5,8"
        fill="none"
        stroke="#806830"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M104,-4 L95,8"
        fill="none"
        stroke="#806830"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M-4,104 L5,92"
        fill="none"
        stroke="#806830"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M104,104 L95,92"
        fill="none"
        stroke="#806830"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Hieroglyphic carved symbols — top edge */}
      <Path d="M20,-2 Q22,-5 24,-2 L22,0 Z" fill="#A08040" opacity={0.7} />
      <Path d="M38,-2 L40,-5 L42,-2 L40,-1 Z" fill="#B89860" opacity={0.65} />
      <Path d="M58,-2 Q60,-6 62,-2 L60,0 Z" fill="#A08040" opacity={0.7} />
      <Path d="M76,-2 L78,-5 L80,-2 L78,-1 Z" fill="#B89860" opacity={0.65} />
      {/* Hieroglyphic — bottom edge */}
      <Path d="M25,102 Q27,105 29,102 L27,100 Z" fill="#A08040" opacity={0.7} />
      <Path d="M50,102 L52,106 L54,102 L52,100 Z" fill="#B89860" opacity={0.65} />
      <Path d="M72,102 Q74,105 76,102 L74,100 Z" fill="#A08040" opacity={0.7} />
      {/* Side erosion bumps */}
      <Path
        d="M-2,25 Q-5,28 -2,31"
        fill="none"
        stroke="#C0A060"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M-2,60 Q-5,63 -2,66"
        fill="none"
        stroke="#C0A060"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,35 Q105,38 102,41"
        fill="none"
        stroke="#C0A060"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,70 Q105,73 102,76"
        fill="none"
        stroke="#C0A060"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Sand grain accents */}
      <Circle cx={50} cy={-4} r={1.2} fill="#D4B88C" opacity={0.7} />
      <Circle cx={-4} cy={50} r={1.2} fill="#D4B88C" opacity={0.7} />
      <Circle cx={104} cy={50} r={1.2} fill="#D4B88C" opacity={0.7} />
      <Circle cx={50} cy={104} r={1.2} fill="#D4B88C" opacity={0.7} />
    </Svg>
  );
});
SandStoneFrame.displayName = 'SandStoneFrame';
