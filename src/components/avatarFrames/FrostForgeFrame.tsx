import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * FrostForgeFrame — 霜锻
 *
 * 冰蓝金属锻造 · 冰冻铆钉(带霜晕) · 冰柱/冰挂从下缘垂落 · 霜花纹四角。
 */
export const FrostForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ffM${userId}`;
  const iceG = `ffI${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#88B0D0" stopOpacity={0.85} />
          <Stop offset="0.35" stopColor="#5080A8" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#386088" stopOpacity={1} />
          <Stop offset="1" stopColor="#88B0D0" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={iceG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#C0E0FF" stopOpacity={0.35} />
          <Stop offset="0.3" stopColor="#A0C8E8" stopOpacity={0} />
          <Stop offset="1" stopColor="#C0E0FF" stopOpacity={0} />
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
        stroke="#102030"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Metal frame */}
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
      {/* Ice sheen bottom-up */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${iceG})`}
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
        stroke="#5080A8"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Icicle drips — bottom edge */}
      <G opacity={0.55} fill="#A0D0F0">
        <Path d="M15,102 L16,108 L17,102 Z" />
        <Path d="M28,102 L29.5,110 L31,102 Z" />
        <Path d="M42,102 L43,107 L44,102 Z" />
        <Path d="M55,102 L56.5,112 L58,102 Z" />
        <Path d="M70,102 L71,109 L72,102 Z" />
        <Path d="M83,102 L84,106 L85,102 Z" />
      </G>
      {/* Icicle highlight lines */}
      <G opacity={0.3} stroke="#D0EEFF" strokeWidth={0.3}>
        <Line x1={15.8} y1={103} x2={15.8} y2={107} />
        <Line x1={29} y1={103} x2={29} y2={109} />
        <Line x1={56} y1={103} x2={56} y2={111} />
        <Line x1={70.8} y1={103} x2={70.8} y2={108} />
      </G>
      {/* Frost rivets with icy halo */}
      <G opacity={0.5}>
        <Circle cx={12} cy={0} r={2} fill="#A0D0F0" opacity={0.15} />
        <Circle cx={12} cy={0} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={88} cy={0} r={2} fill="#A0D0F0" opacity={0.15} />
        <Circle cx={88} cy={0} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={12} cy={100} r={2} fill="#A0D0F0" opacity={0.15} />
        <Circle cx={12} cy={100} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={88} cy={100} r={2} fill="#A0D0F0" opacity={0.15} />
        <Circle cx={88} cy={100} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={0} cy={30} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={0} cy={70} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={100} cy={30} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
        <Circle cx={100} cy={70} r={1} fill="#5080A8" stroke="#88B0D0" strokeWidth={0.3} />
      </G>
      {/* Frost crystal patterns — corners (6-fold snowflake arms) */}
      <G opacity={0.35} stroke="#C0E0FF" strokeWidth={0.5} fill="none">
        {/* Top-left */}
        <Line x1={0} y1={-5} x2={0} y2={-1} />
        <Line x1={-3} y1={-3} x2={-1} y2={-1} />
        <Line x1={-5} y1={0} x2={-1} y2={0} />
        {/* Top-right */}
        <Line x1={100} y1={-5} x2={100} y2={-1} />
        <Line x1={103} y1={-3} x2={101} y2={-1} />
        <Line x1={105} y1={0} x2={101} y2={0} />
        {/* Bottom-left */}
        <Line x1={0} y1={105} x2={0} y2={101} />
        <Line x1={-3} y1={103} x2={-1} y2={101} />
        <Line x1={-5} y1={100} x2={-1} y2={100} />
        {/* Bottom-right */}
        <Line x1={100} y1={105} x2={100} y2={101} />
        <Line x1={103} y1={103} x2={101} y2={101} />
        <Line x1={105} y1={100} x2={101} y2={100} />
      </G>
      {/* Frost branch tips */}
      <G opacity={0.25} stroke="#D0EEFF" strokeWidth={0.3}>
        <Line x1={-1} y1={-4} x2={-2} y2={-5} />
        <Line x1={1} y1={-4} x2={2} y2={-5} />
        <Line x1={99} y1={-4} x2={98} y2={-5} />
        <Line x1={101} y1={-4} x2={102} y2={-5} />
      </G>
    </Svg>
  );
});
FrostForgeFrame.displayName = 'FrostForgeFrame';
