import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ObsidianEdgeFrame — 黑曜
 *
 * 火山黑曜石 · 双层彩虹光泽 · 棱切面 + 斜切角 + 棱柱色点。
 */
export const ObsidianEdgeFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const obsGrad = `obsG${uid}`;
  const sheenGrad = `obsSh${uid}`;
  const sheenGrad2 = `obsSh2${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={obsGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#0A0A0A" stopOpacity={1} />
          <Stop offset="0.5" stopColor="#1A1A1A" stopOpacity={1} />
          <Stop offset="1" stopColor="#0A0A0A" stopOpacity={1} />
        </LinearGradient>
        <LinearGradient id={sheenGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4169E1" stopOpacity={0.6} />
          <Stop offset="0.25" stopColor="#9B59B6" stopOpacity={0.5} />
          <Stop offset="0.5" stopColor="#E74C3C" stopOpacity={0.45} />
          <Stop offset="0.75" stopColor="#F1C40F" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#2ECC71" stopOpacity={0.5} />
        </LinearGradient>
        <LinearGradient id={sheenGrad2} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2ECC71" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#E74C3C" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#4169E1" stopOpacity={0.3} />
        </LinearGradient>
      </Defs>
      {/* Deep shadow */}
      <Rect
        x={2}
        y={2}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#000"
        strokeWidth={6}
        opacity={0.35}
      />
      {/* Pure black frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${obsGrad})`}
        strokeWidth={5.5}
      />
      {/* Rainbow sheen layer 1 */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sheenGrad})`}
        strokeWidth={2}
      />
      {/* Rainbow sheen layer 2 (cross-direction) */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sheenGrad2})`}
        strokeWidth={1}
      />
      {/* Inner edge */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#222"
        strokeWidth={0.6}
        opacity={0.5}
      />
      {/* Facet lines — top */}
      <G strokeLinecap="round" opacity={0.6}>
        <Line x1={20} y1={0} x2={22} y2={-3.5} stroke="#4169E1" strokeWidth={0.9} />
        <Line x1={35} y1={0} x2={34} y2={-2.5} stroke="#9B59B6" strokeWidth={0.7} />
        <Line x1={50} y1={0} x2={50} y2={-3} stroke="#E74C3C" strokeWidth={0.9} />
        <Line x1={65} y1={0} x2={66} y2={-2.5} stroke="#F1C40F" strokeWidth={0.7} />
        <Line x1={80} y1={0} x2={78} y2={-3.5} stroke="#2ECC71" strokeWidth={0.9} />
      </G>
      {/* Facets — bottom */}
      <G strokeLinecap="round" opacity={0.6}>
        <Line x1={20} y1={100} x2={22} y2={103.5} stroke="#2ECC71" strokeWidth={0.9} />
        <Line x1={35} y1={100} x2={34} y2={102.5} stroke="#F1C40F" strokeWidth={0.7} />
        <Line x1={50} y1={100} x2={50} y2={103} stroke="#4169E1" strokeWidth={0.9} />
        <Line x1={65} y1={100} x2={66} y2={102.5} stroke="#E74C3C" strokeWidth={0.7} />
        <Line x1={80} y1={100} x2={78} y2={103.5} stroke="#9B59B6" strokeWidth={0.9} />
      </G>
      {/* Facets — left */}
      <G strokeLinecap="round" opacity={0.55}>
        <Line x1={0} y1={25} x2={-3} y2={24} stroke="#9B59B6" strokeWidth={0.8} />
        <Line x1={0} y1={40} x2={-2.5} y2={41} stroke="#E74C3C" strokeWidth={0.7} />
        <Line x1={0} y1={60} x2={-3} y2={59} stroke="#4169E1" strokeWidth={0.8} />
        <Line x1={0} y1={75} x2={-2.5} y2={76} stroke="#2ECC71" strokeWidth={0.7} />
      </G>
      {/* Facets — right */}
      <G strokeLinecap="round" opacity={0.55}>
        <Line x1={100} y1={25} x2={103} y2={24} stroke="#2ECC71" strokeWidth={0.8} />
        <Line x1={100} y1={40} x2={102.5} y2={41} stroke="#F1C40F" strokeWidth={0.7} />
        <Line x1={100} y1={60} x2={103} y2={59} stroke="#9B59B6" strokeWidth={0.8} />
        <Line x1={100} y1={75} x2={102.5} y2={76} stroke="#4169E1" strokeWidth={0.7} />
      </G>
      {/* Corner angular cuts (beveled) */}
      <G stroke="#333" strokeWidth={1.8} opacity={0.6}>
        <Path d="M4,0 L0,4" fill="none" />
        <Path d="M96,0 L100,4" fill="none" />
        <Path d="M0,96 L4,100" fill="none" />
        <Path d="M96,100 L100,96" fill="none" />
      </G>
      {/* Corner prism dots */}
      <Circle cx={2} cy={2} r={1.5} fill="#4169E1" opacity={0.4} />
      <Circle cx={98} cy={2} r={1.5} fill="#2ECC71" opacity={0.4} />
      <Circle cx={2} cy={98} r={1.5} fill="#F1C40F" opacity={0.4} />
      <Circle cx={98} cy={98} r={1.5} fill="#E74C3C" opacity={0.4} />
      {/* Mid-edge obsidian chips */}
      <Path
        d="M48,-1 L50,-4 L52,-1"
        fill="#1A1A1A"
        stroke="#4169E1"
        strokeWidth={0.5}
        opacity={0.5}
      />
      <Path
        d="M48,101 L50,104 L52,101"
        fill="#1A1A1A"
        stroke="#E74C3C"
        strokeWidth={0.5}
        opacity={0.5}
      />
      <Path
        d="M-1,48 L-4,50 L-1,52"
        fill="#1A1A1A"
        stroke="#9B59B6"
        strokeWidth={0.5}
        opacity={0.5}
      />
      <Path
        d="M101,48 L104,50 L101,52"
        fill="#1A1A1A"
        stroke="#2ECC71"
        strokeWidth={0.5}
        opacity={0.5}
      />
    </Svg>
  );
});
ObsidianEdgeFrame.displayName = 'ObsidianEdgeFrame';
