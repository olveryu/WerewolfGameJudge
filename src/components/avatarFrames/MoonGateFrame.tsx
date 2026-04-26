import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * MoonGateFrame — 月洞门
 *
 * 中式月洞门拱形装饰 · 云纹(叠圆弧) · 翡翠色点缀 · 回字纹内框。
 */
export const MoonGateFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `mgM${userId}`;
  const jadeG = `mgJ${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8B4040" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#5A2020" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#3A1515" stopOpacity={1} />
          <Stop offset="1" stopColor="#8B4040" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={jadeG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#40A060" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#308040" stopOpacity={0} />
          <Stop offset="1" stopColor="#40A060" stopOpacity={0.3} />
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
        stroke="#1A0808"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Main red lacquer frame */}
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
      {/* Jade tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${jadeG})`}
        strokeWidth={1.5}
      />
      {/* Inner hui-wen (回字纹) border */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#5A2020"
        strokeWidth={0.7}
        opacity={0.45}
      />
      {/* Hui-wen notch pattern along inner border */}
      <G opacity={0.3} fill="none" stroke="#8B4040" strokeWidth={0.5}>
        <Path d="M15,6 L15,9 L18,9 L18,6" />
        <Path d="M30,6 L30,9 L33,9 L33,6" />
        <Path d="M45,6 L45,9 L48,9 L48,6" />
        <Path d="M60,6 L60,9 L63,9 L63,6" />
        <Path d="M75,6 L75,9 L78,9 L78,6" />
        <Path d="M15,94 L15,91 L18,91 L18,94" />
        <Path d="M30,94 L30,91 L33,91 L33,94" />
        <Path d="M45,94 L45,91 L48,91 L48,94" />
        <Path d="M60,94 L60,91 L63,91 L63,94" />
        <Path d="M75,94 L75,91 L78,91 L78,94" />
      </G>
      {/* Moon gate arch — top center */}
      <Path d="M35,-5 Q50,-12 65,-5" fill="none" stroke="#8B4040" strokeWidth={1.2} opacity={0.5} />
      <Path
        d="M37,-4 Q50,-10 63,-4"
        fill="none"
        stroke="#5A2020"
        strokeWidth={0.7}
        opacity={0.35}
      />
      {/* Moon gate arch — bottom center */}
      <Path
        d="M35,105 Q50,112 65,105"
        fill="none"
        stroke="#8B4040"
        strokeWidth={1.2}
        opacity={0.5}
      />
      {/* Cloud wisps (叠圆弧) — corners */}
      <G opacity={0.45} fill="none" stroke="#BB6060" strokeWidth={0.7}>
        {/* Top-left cloud */}
        <Path d="M-3,-3 Q-5,-1 -3,1 Q-1,3 1,1 Q3,-1 5,1" />
        {/* Top-right cloud */}
        <Path d="M95,-1 Q97,-3 99,-1 Q101,1 103,-1 Q105,-3 103,-5" />
        {/* Bottom-left cloud */}
        <Path d="M-3,101 Q-5,103 -3,105 Q-1,103 1,101 Q3,103 5,101" />
        {/* Bottom-right cloud */}
        <Path d="M95,101 Q97,103 99,101 Q101,99 103,101 Q105,103 103,105" />
      </G>
      {/* Jade accent circles */}
      <G opacity={0.5}>
        <Circle cx={50} cy={-4} r={1.5} fill="#40A060" />
        <Circle cx={50} cy={-4} r={0.6} fill="#80D0A0" />
      </G>
      <G opacity={0.5}>
        <Circle cx={50} cy={104} r={1.5} fill="#40A060" />
        <Circle cx={50} cy={104} r={0.6} fill="#80D0A0" />
      </G>
      <G opacity={0.45}>
        <Circle cx={-4} cy={50} r={1.3} fill="#40A060" />
        <Circle cx={104} cy={50} r={1.3} fill="#40A060" />
      </G>
    </Svg>
  );
});
MoonGateFrame.displayName = 'MoonGateFrame';
