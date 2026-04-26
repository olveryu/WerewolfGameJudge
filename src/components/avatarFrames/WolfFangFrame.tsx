import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * WolfFangFrame — 狼牙
 *
 * 獠牙利齿突出边缘 · 三道爪痕划裂角落 · 毛皮短线肌理 · 嗜血暗红渐变。
 */
export const WolfFangFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `wfM${userId}`;
  const bloodG = `wfB${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8A8A8A" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#555555" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#3A3A3A" stopOpacity={1} />
          <Stop offset="1" stopColor="#8A8A8A" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={bloodG} x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#CC2222" stopOpacity={0.5} />
          <Stop offset="0.5" stopColor="#880000" stopOpacity={0} />
          <Stop offset="1" stopColor="#CC2222" stopOpacity={0.5} />
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
        stroke="#1A1A1A"
        strokeWidth={6.5}
        opacity={0.2}
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
        strokeWidth={5.5}
      />
      {/* Blood tint overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${bloodG})`}
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
        stroke="#555555"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Fangs — top edge (large+small alternating) */}
      <Path
        d="M30,-2 L33,-8 L36,-2"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M44,-2 L46,-6 L48,-2"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Path
        d="M52,-2 L54,-6 L56,-2"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Path
        d="M64,-2 L67,-8 L70,-2"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.8}
      />
      {/* Fangs — bottom edge */}
      <Path
        d="M30,102 L33,108 L36,102"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M44,102 L46,106 L48,102"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Path
        d="M52,102 L54,106 L56,102"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.7}
      />
      <Path
        d="M64,102 L67,108 L70,102"
        fill="#8A8A8A"
        stroke="#555555"
        strokeWidth={0.5}
        opacity={0.8}
      />
      {/* Triple claw scratches — all 4 corners */}
      <G opacity={0.5} stroke="#CC2222" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={-3} y1={3} x2={6} y2={-4} />
        <Line x1={-1} y1={6} x2={8} y2={-1} />
        <Line x1={1} y1={9} x2={10} y2={2} />
      </G>
      <G opacity={0.5} stroke="#CC2222" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={94} y1={-4} x2={103} y2={3} />
        <Line x1={92} y1={-1} x2={101} y2={6} />
        <Line x1={90} y1={2} x2={99} y2={9} />
      </G>
      <G opacity={0.5} stroke="#CC2222" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={-3} y1={97} x2={6} y2={104} />
        <Line x1={-1} y1={94} x2={8} y2={101} />
        <Line x1={1} y1={91} x2={10} y2={98} />
      </G>
      <G opacity={0.5} stroke="#CC2222" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={94} y1={104} x2={103} y2={97} />
        <Line x1={92} y1={101} x2={101} y2={94} />
        <Line x1={90} y1={98} x2={99} y2={91} />
      </G>
      {/* Fur texture — left edge */}
      <G opacity={0.25} stroke="#6A6A6A" strokeWidth={0.4}>
        <Line x1={-2} y1={20} x2={2} y2={18} />
        <Line x1={-2} y1={25} x2={2} y2={23} />
        <Line x1={-2} y1={35} x2={2} y2={33} />
        <Line x1={-2} y1={40} x2={2} y2={38} />
        <Line x1={-2} y1={55} x2={2} y2={53} />
        <Line x1={-2} y1={65} x2={2} y2={63} />
        <Line x1={-2} y1={75} x2={2} y2={73} />
        <Line x1={-2} y1={80} x2={2} y2={78} />
      </G>
      {/* Fur texture — right edge */}
      <G opacity={0.25} stroke="#6A6A6A" strokeWidth={0.4}>
        <Line x1={98} y1={18} x2={102} y2={20} />
        <Line x1={98} y1={23} x2={102} y2={25} />
        <Line x1={98} y1={33} x2={102} y2={35} />
        <Line x1={98} y1={38} x2={102} y2={40} />
        <Line x1={98} y1={53} x2={102} y2={55} />
        <Line x1={98} y1={63} x2={102} y2={65} />
        <Line x1={98} y1={73} x2={102} y2={75} />
        <Line x1={98} y1={78} x2={102} y2={80} />
      </G>
      {/* Blood drip from top-left fang */}
      <Path
        d="M33.5,-7 Q34,-4 33.5,-2"
        fill="none"
        stroke="#CC2222"
        strokeWidth={0.5}
        opacity={0.4}
      />
      <Circle cx={33.5} cy={-2} r={0.8} fill="#CC2222" opacity={0.4} />
    </Svg>
  );
});
WolfFangFrame.displayName = 'WolfFangFrame';
