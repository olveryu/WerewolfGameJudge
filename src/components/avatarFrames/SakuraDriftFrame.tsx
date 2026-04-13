import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SakuraDriftFrame — 樱散
 *
 * 四角五瓣樱花 + 漂落花瓣 + 粉色三层渐变 + 枝条 + 花蕾。
 */
export const SakuraDriftFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const sakGrad = `sakG${uid}`;
  const sakGlow = `sakGlow${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={sakGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFB7C5" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#E88FA0" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#D06B80" stopOpacity={0.9} />
        </LinearGradient>
        <RadialGradient id={sakGlow} cx="50%" cy="50%" r="55%">
          <Stop offset="0.6" stopColor="#FFD1DC" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFB7C5" stopOpacity={0.12} />
        </RadialGradient>
      </Defs>
      {/* Soft glow */}
      <Circle cx={50} cy={50} r={58} fill={`url(#${sakGlow})`} />
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#6B2030"
        strokeWidth={4}
        opacity={0.15}
      />
      {/* Main pink frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sakGrad})`}
        strokeWidth={3}
      />
      {/* Inner accent */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#FFD1DC"
        strokeWidth={0.8}
        opacity={0.4}
      />
      {/* 5-petal flower: top-left */}
      <G transform="translate(-3,-3)" opacity={0.8}>
        <Ellipse rx={4.5} ry={2} rotation={0} fill="#FFB7C5" />
        <Ellipse rx={4.5} ry={2} rotation={72} fill="#FF9FB2" />
        <Ellipse rx={4.5} ry={2} rotation={144} fill="#FFD1DC" />
        <Ellipse rx={4.5} ry={2} rotation={216} fill="#FFB7C5" />
        <Ellipse rx={4.5} ry={2} rotation={288} fill="#FF9FB2" />
        <Circle r={2} fill="#D05A70" />
        <Circle r={1} fill="#E8899A" />
      </G>
      {/* 5-petal flower: top-right */}
      <G transform="translate(103,-3)" opacity={0.8}>
        <Ellipse rx={4.5} ry={2} rotation={15} fill="#FFB7C5" />
        <Ellipse rx={4.5} ry={2} rotation={87} fill="#FF9FB2" />
        <Ellipse rx={4.5} ry={2} rotation={159} fill="#FFD1DC" />
        <Ellipse rx={4.5} ry={2} rotation={231} fill="#FFB7C5" />
        <Ellipse rx={4.5} ry={2} rotation={303} fill="#FF9FB2" />
        <Circle r={2} fill="#D05A70" />
        <Circle r={1} fill="#E8899A" />
      </G>
      {/* 5-petal flower: bottom-left */}
      <G transform="translate(-3,103)" opacity={0.8}>
        <Ellipse rx={4} ry={1.8} rotation={10} fill="#FFB7C5" />
        <Ellipse rx={4} ry={1.8} rotation={82} fill="#FF9FB2" />
        <Ellipse rx={4} ry={1.8} rotation={154} fill="#FFD1DC" />
        <Ellipse rx={4} ry={1.8} rotation={226} fill="#FFB7C5" />
        <Ellipse rx={4} ry={1.8} rotation={298} fill="#FF9FB2" />
        <Circle r={1.8} fill="#D05A70" />
        <Circle r={0.9} fill="#E8899A" />
      </G>
      {/* 5-petal flower: bottom-right */}
      <G transform="translate(103,103)" opacity={0.75}>
        <Ellipse rx={4} ry={1.8} rotation={25} fill="#FFB7C5" />
        <Ellipse rx={4} ry={1.8} rotation={97} fill="#FF9FB2" />
        <Ellipse rx={4} ry={1.8} rotation={169} fill="#FFD1DC" />
        <Ellipse rx={4} ry={1.8} rotation={241} fill="#FFB7C5" />
        <Ellipse rx={4} ry={1.8} rotation={313} fill="#FF9FB2" />
        <Circle r={1.8} fill="#D05A70" />
        <Circle r={0.9} fill="#E8899A" />
      </G>
      {/* Drifting petals */}
      <Ellipse cx={30} cy={-5} rx={3.5} ry={1.4} rotation={35} fill="#FFB7C5" opacity={0.65} />
      <Ellipse cx={55} cy={-4} rx={2.8} ry={1.2} rotation={-20} fill="#FFD1DC" opacity={0.55} />
      <Ellipse cx={70} cy={105} rx={3.2} ry={1.3} rotation={-25} fill="#FF9FB2" opacity={0.6} />
      <Ellipse cx={35} cy={106} rx={2.5} ry={1.1} rotation={50} fill="#FFB7C5" opacity={0.5} />
      <Ellipse cx={-5} cy={40} rx={3} ry={1.2} rotation={60} fill="#FFD1DC" opacity={0.55} />
      <Ellipse cx={-4} cy={70} rx={2.5} ry={1} rotation={-40} fill="#FF9FB2" opacity={0.5} />
      <Ellipse cx={105} cy={30} rx={2.8} ry={1.2} rotation={15} fill="#FFB7C5" opacity={0.5} />
      <Ellipse cx={106} cy={65} rx={3} ry={1.1} rotation={-55} fill="#FFD1DC" opacity={0.45} />
      {/* Edge flower buds */}
      <G opacity={0.55}>
        <Circle cx={50} cy={-2} r={2} fill="#FFB7C5" />
        <Circle cx={50} cy={-2} r={0.8} fill="#D05A70" />
        <Circle cx={50} cy={102} r={2} fill="#FFB7C5" />
        <Circle cx={50} cy={102} r={0.8} fill="#D05A70" />
        <Circle cx={-2} cy={50} r={1.8} fill="#FF9FB2" />
        <Circle cx={-2} cy={50} r={0.7} fill="#D05A70" />
        <Circle cx={102} cy={50} r={1.8} fill="#FF9FB2" />
        <Circle cx={102} cy={50} r={0.7} fill="#D05A70" />
      </G>
      {/* Branch lines */}
      <Path d="M8,0 Q15,-3 22,0" fill="none" stroke="#C07888" strokeWidth={0.6} opacity={0.4} />
      <Path d="M78,0 Q85,-3 92,0" fill="none" stroke="#C07888" strokeWidth={0.6} opacity={0.4} />
      <Path
        d="M8,100 Q15,103 22,100"
        fill="none"
        stroke="#C07888"
        strokeWidth={0.6}
        opacity={0.4}
      />
      <Path
        d="M78,100 Q85,103 92,100"
        fill="none"
        stroke="#C07888"
        strokeWidth={0.6}
        opacity={0.4}
      />
    </Svg>
  );
});
SakuraDriftFrame.displayName = 'SakuraDriftFrame';
