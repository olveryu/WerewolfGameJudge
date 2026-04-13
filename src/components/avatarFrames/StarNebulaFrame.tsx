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
 * StarNebulaFrame — 星云
 *
 * 深空星云 · 双色气体漫射 · 四角星芒 + 星簇 + 粉蓝雾。
 */
export const StarNebulaFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const nebGrad = `nebG${uid}`;
  const nebGlow1 = `nebGl1${uid}`;
  const nebGlow2 = `nebGl2${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={nebGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A0533" stopOpacity={0.95} />
          <Stop offset="0.4" stopColor="#3A1066" stopOpacity={1} />
          <Stop offset="1" stopColor="#5A18AA" stopOpacity={0.9} />
        </LinearGradient>
        <RadialGradient id={nebGlow1} cx="20%" cy="20%" r="40%">
          <Stop offset="0" stopColor="#FF6EC7" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#FF6EC7" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={nebGlow2} cx="80%" cy="80%" r="40%">
          <Stop offset="0" stopColor="#6EC7FF" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#6EC7FF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Dual-color nebula glows */}
      <Rect x={-6} y={-6} width={112} height={112} rx={rx + 4} fill={`url(#${nebGlow1})`} />
      <Rect x={-6} y={-6} width={112} height={112} rx={rx + 4} fill={`url(#${nebGlow2})`} />
      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#0A0015"
        strokeWidth={5}
        opacity={0.3}
      />
      {/* Main frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${nebGrad})`}
        strokeWidth={3}
      />
      {/* Inner shimmer */}
      <Rect
        x={4}
        y={4}
        width={92}
        height={92}
        rx={Math.max(rx - 3, 0)}
        fill="none"
        stroke="#7B3FBB"
        strokeWidth={0.7}
        opacity={0.35}
      />
      {/* Nebula wisps */}
      <Path
        d="M-4,20 Q8,10 20,-3"
        fill="none"
        stroke="#FF6EC7"
        strokeWidth={1.2}
        opacity={0.25}
        strokeLinecap="round"
      />
      <Path
        d="M-3,25 Q10,15 25,-2"
        fill="none"
        stroke="#FF8ED7"
        strokeWidth={0.6}
        opacity={0.2}
        strokeLinecap="round"
      />
      <Path
        d="M80,103 Q92,95 104,82"
        fill="none"
        stroke="#6EC7FF"
        strokeWidth={1.2}
        opacity={0.25}
        strokeLinecap="round"
      />
      <Path
        d="M75,104 Q88,97 103,87"
        fill="none"
        stroke="#8ED7FF"
        strokeWidth={0.6}
        opacity={0.2}
        strokeLinecap="round"
      />
      {/* 4-pointed stars — side midpoints */}
      <G opacity={0.7}>
        <Path d="M-4,50 L-7,49 L-4,48 L-3,45 L-2,48 L1,49 L-2,50 L-3,53 Z" fill="#fff" />
        <Path d="M104,50 L107,49 L104,48 L103,45 L102,48 L99,49 L102,50 L103,53 Z" fill="#fff" />
      </G>
      <G opacity={0.6}>
        <Path d="M50,-4 L49,-7 L48,-4 L45,-3 L48,-2 L49,1 L50,-2 L53,-3 Z" fill="#FFE4FF" />
        <Path d="M50,104 L49,107 L48,104 L45,103 L48,102 L49,99 L50,102 L53,103 Z" fill="#FFE4FF" />
      </G>
      {/* Bright stars */}
      <Circle cx={15} cy={-5} r={1.2} fill="#fff" opacity={0.85} />
      <Circle cx={35} cy={-4} r={0.7} fill="#FFE4FF" opacity={0.6} />
      <Circle cx={65} cy={-6} r={1} fill="#fff" opacity={0.75} />
      <Circle cx={85} cy={-3} r={0.8} fill="#E4E4FF" opacity={0.65} />
      {/* Dim stars */}
      <Circle cx={-5} cy={30} r={0.9} fill="#fff" opacity={0.55} />
      <Circle cx={-4} cy={70} r={1.1} fill="#FFE4FF" opacity={0.6} />
      <Circle cx={-6} cy={88} r={0.6} fill="#fff" opacity={0.4} />
      <Circle cx={105} cy={15} r={0.7} fill="#E4E4FF" opacity={0.5} />
      <Circle cx={106} cy={42} r={0.8} fill="#fff" opacity={0.45} />
      <Circle cx={104} cy={75} r={1} fill="#FFE4FF" opacity={0.55} />
      <Circle cx={20} cy={105} r={0.8} fill="#fff" opacity={0.55} />
      <Circle cx={55} cy={106} r={1.2} fill="#E4FFFF" opacity={0.7} />
      <Circle cx={90} cy={104} r={0.6} fill="#fff" opacity={0.45} />
      {/* Tiny star cluster at top-right */}
      <Circle cx={95} cy={-3} r={0.5} fill="#fff" opacity={0.7} />
      <Circle cx={97} cy={-5} r={0.3} fill="#fff" opacity={0.5} />
      <Circle cx={93} cy={-5} r={0.4} fill="#FFE4FF" opacity={0.6} />
      {/* Corner glow orbs */}
      <Circle cx={0} cy={0} r={4} fill="#FF6EC7" opacity={0.08} />
      <Circle cx={100} cy={0} r={4} fill="#6EC7FF" opacity={0.08} />
      <Circle cx={0} cy={100} r={4} fill="#6EC7FF" opacity={0.08} />
      <Circle cx={100} cy={100} r={4} fill="#FF6EC7" opacity={0.08} />
    </Svg>
  );
});
StarNebulaFrame.displayName = 'StarNebulaFrame';
