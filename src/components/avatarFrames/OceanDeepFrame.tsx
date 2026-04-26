import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * OceanDeepFrame — 深渊
 *
 * 深海生物荧光 · 触手/须角缠绕四角 · 气泡散布 · 海底暗绿蓝渐变。
 */
export const OceanDeepFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `odM${userId}`;
  const bioG = `odB${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A2030" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#051520" stopOpacity={1} />
          <Stop offset="1" stopColor="#0A2030" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={bioG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#00FFAA" stopOpacity={0.2} />
          <Stop offset="0.3" stopColor="#0088AA" stopOpacity={0.1} />
          <Stop offset="0.6" stopColor="#005580" stopOpacity={0} />
          <Stop offset="1" stopColor="#00FFAA" stopOpacity={0} />
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
        stroke="#000810"
        strokeWidth={6}
        opacity={0.25}
      />
      {/* Deep ocean frame */}
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
      {/* Bioluminescence */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${bioG})`}
        strokeWidth={2.5}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#0A2030"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Tentacle — top-left corner (S-curve with suckers) */}
      <G opacity={0.5}>
        <Path
          d="M-5,8 Q-3,2 0,-2 Q3,-5 8,-4 Q5,-2 3,0 Q1,3 -1,5"
          fill="none"
          stroke="#205040"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Circle cx={-3} cy={5} r={0.5} fill="#40A080" opacity={0.4} />
        <Circle cx={0} cy={1} r={0.5} fill="#40A080" opacity={0.4} />
        <Circle cx={3} cy={-2} r={0.5} fill="#40A080" opacity={0.4} />
      </G>
      {/* Tentacle — bottom-right corner */}
      <G opacity={0.5}>
        <Path
          d="M105,92 Q103,98 100,102 Q97,105 92,104 Q95,102 97,100 Q99,97 101,95"
          fill="none"
          stroke="#205040"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Circle cx={103} cy={95} r={0.5} fill="#40A080" opacity={0.4} />
        <Circle cx={100} cy={99} r={0.5} fill="#40A080" opacity={0.4} />
        <Circle cx={97} cy={102} r={0.5} fill="#40A080" opacity={0.4} />
      </G>
      {/* Tentacle — top-right */}
      <G opacity={0.4}>
        <Path
          d="M92,-4 Q98,-3 102,0 Q105,3 104,8"
          fill="none"
          stroke="#205040"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Circle cx={98} cy={-1} r={0.4} fill="#40A080" opacity={0.35} />
        <Circle cx={102} cy={3} r={0.4} fill="#40A080" opacity={0.35} />
      </G>
      {/* Tentacle — bottom-left */}
      <G opacity={0.4}>
        <Path
          d="M8,104 Q2,103 -2,100 Q-5,97 -4,92"
          fill="none"
          stroke="#205040"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <Circle cx={2} cy={101} r={0.4} fill="#40A080" opacity={0.35} />
        <Circle cx={-2} cy={97} r={0.4} fill="#40A080" opacity={0.35} />
      </G>
      {/* Bubbles rising */}
      <G opacity={0.4}>
        <Circle cx={-3} cy={30} r={1.5} fill="none" stroke="#40A0A0" strokeWidth={0.4} />
        <Circle cx={-4} cy={25} r={1} fill="none" stroke="#40A0A0" strokeWidth={0.3} />
        <Circle cx={-2} cy={20} r={0.7} fill="none" stroke="#40A0A0" strokeWidth={0.3} />
      </G>
      <G opacity={0.35}>
        <Circle cx={103} cy={50} r={1.3} fill="none" stroke="#40A0A0" strokeWidth={0.4} />
        <Circle cx={104} cy={45} r={0.9} fill="none" stroke="#40A0A0" strokeWidth={0.3} />
        <Circle cx={102} cy={40} r={0.6} fill="none" stroke="#40A0A0" strokeWidth={0.3} />
      </G>
      {/* Bioluminescent dots */}
      <G opacity={0.6}>
        <Circle cx={20} cy={-3} r={0.6} fill="#00FFAA" />
        <Circle cx={50} cy={-4} r={0.5} fill="#00CCAA" />
        <Circle cx={80} cy={-3} r={0.7} fill="#00FFAA" />
        <Circle cx={-4} cy={60} r={0.5} fill="#00CCAA" />
        <Circle cx={-3} cy={80} r={0.6} fill="#00FFAA" />
        <Circle cx={30} cy={103} r={0.5} fill="#00CCAA" />
        <Circle cx={65} cy={104} r={0.6} fill="#00FFAA" />
      </G>
    </Svg>
  );
});
OceanDeepFrame.displayName = 'OceanDeepFrame';
