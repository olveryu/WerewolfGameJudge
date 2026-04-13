import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CoralReefFrame — 珊瑚
 *
 * 海底珊瑚丛 · 分枝造型 · 橙→青渐变 + 气泡高光 + 海星。
 */
export const CoralReefFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const corGrad = `corG${uid}`;
  const corGlow = `corGl${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={corGrad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7F50" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#E0604A" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#20B2AA" stopOpacity={0.85} />
        </LinearGradient>
        <RadialGradient id={corGlow} cx="50%" cy="100%" r="50%">
          <Stop offset="0" stopColor="#20B2AA" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#20B2AA" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Underwater glow */}
      <Rect x={-6} y={-6} width={112} height={112} rx={rx + 4} fill={`url(#${corGlow})`} />
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#102020"
        strokeWidth={5}
        opacity={0.2}
      />
      {/* Ocean gradient frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${corGrad})`}
        strokeWidth={3.5}
      />
      {/* Inner accent */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#40E0D0"
        strokeWidth={0.7}
        opacity={0.3}
      />
      {/* Coral branches — top-left */}
      <G opacity={0.75} strokeLinecap="round">
        <Path d="M20,-2 Q17,-7 15,-10" fill="none" stroke="#FF7F50" strokeWidth={1.5} />
        <Path d="M15,-10 Q13,-12 10,-11" fill="none" stroke="#FF6347" strokeWidth={1} />
        <Path d="M15,-10 Q16,-13 18,-12" fill="none" stroke="#FF6347" strokeWidth={0.8} />
        <Path d="M20,-2 Q23,-8 25,-10" fill="none" stroke="#FF8C66" strokeWidth={1.2} />
        <Path d="M25,-10 Q27,-12 29,-11" fill="none" stroke="#FF6347" strokeWidth={0.8} />
      </G>
      {/* Coral — top-right */}
      <G opacity={0.75} strokeLinecap="round">
        <Path d="M75,-2 Q78,-7 80,-10" fill="none" stroke="#FF7F50" strokeWidth={1.5} />
        <Path d="M80,-10 Q82,-12 84,-11" fill="none" stroke="#FF6347" strokeWidth={1} />
        <Path d="M80,-10 Q79,-13 77,-12" fill="none" stroke="#FF6347" strokeWidth={0.8} />
        <Path d="M75,-2 Q72,-7 70,-9" fill="none" stroke="#FF8C66" strokeWidth={1.2} />
      </G>
      {/* Coral — bottom */}
      <G opacity={0.7} strokeLinecap="round">
        <Path d="M35,102 Q32,107 30,110" fill="none" stroke="#FF7F50" strokeWidth={1.4} />
        <Path d="M30,110 Q28,112 26,111" fill="none" stroke="#FF6347" strokeWidth={0.8} />
        <Path d="M30,110 Q31,113 33,112" fill="none" stroke="#FF6347" strokeWidth={0.8} />
        <Path d="M65,102 Q68,107 70,110" fill="none" stroke="#FF8C66" strokeWidth={1.3} />
        <Path d="M70,110 Q72,112 74,111" fill="none" stroke="#FF6347" strokeWidth={0.8} />
      </G>
      {/* Coral — sides */}
      <G opacity={0.65} strokeLinecap="round">
        <Path d="M-2,30 Q-7,28 -9,25" fill="none" stroke="#FF7F50" strokeWidth={1.2} />
        <Path d="M-9,25 Q-11,23 -10,21" fill="none" stroke="#FF6347" strokeWidth={0.8} />
        <Path d="M102,70 Q107,68 109,65" fill="none" stroke="#FF7F50" strokeWidth={1.2} />
        <Path d="M109,65 Q111,63 110,61" fill="none" stroke="#FF6347" strokeWidth={0.8} />
      </G>
      {/* Bubbles with shine dots */}
      <G opacity={0.5}>
        <Circle cx={12} cy={-4} r={2.5} fill="none" stroke="#40E0D0" strokeWidth={0.6} />
        <Circle cx={11.5} cy={-4.8} r={0.5} fill="#80FFF0" opacity={0.7} />
      </G>
      <G opacity={0.45}>
        <Circle cx={88} cy={105} r={3} fill="none" stroke="#40E0D0" strokeWidth={0.7} />
        <Circle cx={87.3} cy={104} r={0.6} fill="#80FFF0" opacity={0.7} />
      </G>
      <G opacity={0.4}>
        <Circle cx={-5} cy={55} r={2} fill="none" stroke="#48D1CC" strokeWidth={0.5} />
        <Circle cx={-5.5} cy={54.3} r={0.4} fill="#80FFF0" opacity={0.6} />
      </G>
      <Circle
        cx={106}
        cy={35}
        r={1.5}
        fill="none"
        stroke="#48D1CC"
        strokeWidth={0.4}
        opacity={0.35}
      />
      <Circle
        cx={45}
        cy={-6}
        r={1.2}
        fill="none"
        stroke="#40E0D0"
        strokeWidth={0.4}
        opacity={0.35}
      />
      <Circle
        cx={55}
        cy={107}
        r={1.8}
        fill="none"
        stroke="#40E0D0"
        strokeWidth={0.5}
        opacity={0.4}
      />
      {/* Seafloor particles */}
      <Circle cx={8} cy={103} r={0.6} fill="#FF7F50" opacity={0.3} />
      <Circle cx={92} cy={104} r={0.5} fill="#FF8C66" opacity={0.25} />
      {/* Sea star — top-left */}
      <G opacity={0.45}>
        <Path
          d="M-5,-8 L-4,-6 L-2,-6 L-3.5,-4.5 L-3,-2.5 L-5,-3.8 L-7,-2.5 L-6.5,-4.5 L-8,-6 L-6,-6 Z"
          fill="#FFD700"
        />
      </G>
      {/* Sea star — bottom-right */}
      <G opacity={0.35}>
        <Path
          d="M106,103.5 L106.8,105.2 L108.5,105.2 L107.2,106.4 L107.6,108 L106,107 L104.4,108 L104.8,106.4 L103.5,105.2 L105.2,105.2 Z"
          fill="#FFD700"
        />
      </G>
    </Svg>
  );
});
CoralReefFrame.displayName = 'CoralReefFrame';
