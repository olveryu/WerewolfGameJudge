import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ThornCrownFrame — 荆棘冠
 *
 * 有机贝塞尔荆棘缠绕四边 · 尖刺交错凸出 · 暗红玫瑰点缀 · 枯藤褐色渐变。
 */
export const ThornCrownFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `tcM${userId}`;
  const roseG = `tcR${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6B4226" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#4A2E1A" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#3A2010" stopOpacity={1} />
          <Stop offset="1" stopColor="#6B4226" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={roseG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#CC2244" stopOpacity={0.4} />
          <Stop offset="0.5" stopColor="#880022" stopOpacity={0} />
          <Stop offset="1" stopColor="#CC2244" stopOpacity={0.4} />
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
        stroke="#1A0A00"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Main frame */}
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
      {/* Rose tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${roseG})`}
        strokeWidth={1.5}
      />
      {/* Inner groove */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#4A2E1A"
        strokeWidth={0.7}
        opacity={0.4}
      />
      {/* Vine along top — organic bezier wave */}
      <Path
        d="M10,-2 Q20,-6 30,-2 Q35,1 40,-3 Q48,-6 55,-2 Q62,1 70,-3 Q78,-6 90,-2"
        fill="none"
        stroke="#5A3618"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Thorns on top vine */}
      <Path d="M18,-3 L16,-7 L20,-4" fill="#5A3618" opacity={0.5} />
      <Path d="M35,-1 L34,-5 L37,-2" fill="#5A3618" opacity={0.45} />
      <Path d="M52,-3 L50,-7 L54,-4" fill="#5A3618" opacity={0.5} />
      <Path d="M70,-2 L68,-6 L72,-3" fill="#5A3618" opacity={0.45} />
      <Path d="M85,-2 L84,-6 L87,-3" fill="#5A3618" opacity={0.5} />
      {/* Vine along bottom */}
      <Path
        d="M10,102 Q20,106 30,102 Q35,99 40,103 Q48,106 55,102 Q62,99 70,103 Q78,106 90,102"
        fill="none"
        stroke="#5A3618"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Bottom thorns */}
      <Path d="M18,103 L16,107 L20,104" fill="#5A3618" opacity={0.5} />
      <Path d="M52,103 L50,107 L54,104" fill="#5A3618" opacity={0.5} />
      <Path d="M85,102 L84,106 L87,103" fill="#5A3618" opacity={0.45} />
      {/* Vine along left */}
      <Path
        d="M-2,10 Q-6,20 -2,30 Q1,38 -3,45 Q-6,55 -2,65 Q1,73 -2,80 Q-5,88 -2,92"
        fill="none"
        stroke="#5A3618"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Vine along right */}
      <Path
        d="M102,10 Q106,20 102,30 Q99,38 103,45 Q106,55 102,65 Q99,73 102,80 Q105,88 102,92"
        fill="none"
        stroke="#5A3618"
        strokeWidth={1}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Rose accents — left edge */}
      <G opacity={0.65}>
        <Circle cx={-2} cy={30} r={2.5} fill="#CC2244" />
        <Circle cx={-2} cy={30} r={1.2} fill="#DD4466" />
      </G>
      {/* Rose — right edge */}
      <G opacity={0.65}>
        <Circle cx={102} cy={65} r={2.5} fill="#CC2244" />
        <Circle cx={102} cy={65} r={1.2} fill="#DD4466" />
      </G>
      {/* Rose — top-right area */}
      <G opacity={0.55}>
        <Circle cx={90} cy={-2} r={2} fill="#CC2244" />
        <Circle cx={90} cy={-2} r={1} fill="#DD4466" />
      </G>
    </Svg>
  );
});
ThornCrownFrame.displayName = 'ThornCrownFrame';
