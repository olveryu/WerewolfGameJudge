import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * EmberAshFrame — 余烬
 *
 * 燃尽灰烬 · 橙色裂纹发光 · 底部热浪 + 余烬粒子 + 焦痕。
 */
export const EmberAshFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const ashGrad = `ashG${uid}`;
  const embGlow = `embGl${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={ashGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A4A4A" stopOpacity={0.95} />
          <Stop offset="0.4" stopColor="#2A2A2A" stopOpacity={1} />
          <Stop offset="1" stopColor="#3A3A3A" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={embGlow} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#FF4500" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#FF4500" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {/* Under-glow from bottom */}
      <Rect x={-4} y={40} width={108} height={68} rx={12} fill={`url(#${embGlow})`} opacity={0.3} />
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#000"
        strokeWidth={5}
        opacity={0.3}
      />
      {/* Ash-colored frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${ashGrad})`}
        strokeWidth={4.5}
      />
      {/* Cracked inner line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#555"
        strokeWidth={0.7}
        opacity={0.4}
        strokeDasharray="5 3"
      />
      {/* Glowing cracks — top */}
      <Path
        d="M22,0 L25,2.5 L28,0.5 L32,0"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M55,0 L57,1.5 L60,-0.5 L63,0"
        fill="none"
        stroke="#FF4500"
        strokeWidth={0.9}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Cracks — bottom (denser, brighter) */}
      <Path
        d="M20,100 L23,98 L26,100.5 L30,100"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1.3}
        opacity={0.65}
        strokeLinecap="round"
      />
      <Path
        d="M40,100 L43,97 L47,99 L50,100"
        fill="none"
        stroke="#FF8C00"
        strokeWidth={1.5}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M60,100 L63,97.5 L66,99.5 L70,100"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1.2}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M78,100 L80,98 L83,100"
        fill="none"
        stroke="#FF4500"
        strokeWidth={0.9}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Cracks — left */}
      <Path
        d="M0,35 L2,38 L0.5,42 L0,45"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1}
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d="M0,65 L1.5,68 L0,70"
        fill="none"
        stroke="#FF4500"
        strokeWidth={0.8}
        opacity={0.45}
        strokeLinecap="round"
      />
      {/* Cracks — right */}
      <Path
        d="M100,50 L98,53 L100,57"
        fill="none"
        stroke="#FF6B20"
        strokeWidth={1}
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d="M100,75 L98.5,78 L100,80"
        fill="none"
        stroke="#FF4500"
        strokeWidth={0.8}
        opacity={0.45}
        strokeLinecap="round"
      />
      {/* Ember particles — bottom cluster */}
      <Circle cx={25} cy={95} r={1.3} fill="#FF4500" opacity={0.65} />
      <Circle cx={35} cy={90} r={0.9} fill="#FF6B20" opacity={0.55} />
      <Circle cx={50} cy={88} r={1.1} fill="#FF8C00" opacity={0.5} />
      <Circle cx={65} cy={92} r={1.2} fill="#FF4500" opacity={0.6} />
      <Circle cx={80} cy={96} r={0.8} fill="#FFAA00" opacity={0.5} />
      {/* Embers — sides */}
      <Circle cx={12} cy={-5} r={1.1} fill="#FF4500" opacity={0.55} />
      <Circle cx={40} cy={-6} r={0.7} fill="#FF6B20" opacity={0.4} />
      <Circle cx={80} cy={-4} r={0.9} fill="#FF8C00" opacity={0.45} />
      <Circle cx={-5} cy={25} r={0.8} fill="#FF4500" opacity={0.45} />
      <Circle cx={-4} cy={80} r={1} fill="#FF6B20" opacity={0.5} />
      <Circle cx={105} cy={45} r={0.7} fill="#FF8C00" opacity={0.4} />
      <Circle cx={106} cy={90} r={1} fill="#FF4500" opacity={0.5} />
      {/* Heat shimmer lines */}
      <Path d="M20,100 Q22,94 20,88" fill="none" stroke="#FF4500" strokeWidth={0.4} opacity={0.2} />
      <Path d="M40,100 Q42,92 40,84" fill="none" stroke="#FF6B20" strokeWidth={0.4} opacity={0.2} />
      <Path d="M60,100 Q58,94 60,88" fill="none" stroke="#FF4500" strokeWidth={0.4} opacity={0.2} />
      <Path d="M80,100 Q78,95 80,90" fill="none" stroke="#FF6B20" strokeWidth={0.4} opacity={0.2} />
      {/* Corner charred marks */}
      <G opacity={0.3}>
        <Circle cx={5} cy={5} r={3} fill="#1A0A00" />
        <Circle cx={95} cy={5} r={2.5} fill="#1A0A00" />
        <Circle cx={5} cy={95} r={2.5} fill="#1A0A00" />
        <Circle cx={95} cy={95} r={3} fill="#1A0A00" />
      </G>
    </Svg>
  );
});
EmberAshFrame.displayName = 'EmberAshFrame';
