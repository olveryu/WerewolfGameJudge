import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * CrystalThornFrame — 紫晶棘
 *
 * 紫晶水晶尖刺从边框向外突出 · 晶洞内壁纹理(弧形) · 棱面反射高光 · 紫蓝宝石渐变。
 */
export const CrystalThornFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ctM${userId}`;
  const refG = `ctR${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7B48A8" stopOpacity={0.85} />
          <Stop offset="0.35" stopColor="#502878" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#381860" stopOpacity={1} />
          <Stop offset="1" stopColor="#7B48A8" stopOpacity={0.85} />
        </LinearGradient>
        <LinearGradient id={refG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C0A0F0" stopOpacity={0.3} />
          <Stop offset="0.3" stopColor="#9060D0" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#9060D0" stopOpacity={0} />
          <Stop offset="1" stopColor="#C0A0F0" stopOpacity={0.3} />
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
        stroke="#100820"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Main amethyst frame */}
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
      {/* Facet reflection */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${refG})`}
        strokeWidth={2}
      />
      {/* Inner geode wall */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#502878"
        strokeWidth={0.7}
        opacity={0.4}
      />
      {/* Crystal spikes — top edge (angular faceted shapes) */}
      <G opacity={0.55}>
        <Path d="M15,-1 L17,-7 L19,-1" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M28,-1 L30,-9 L32,-1" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M42,-1 L44,-6 L46,-1" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M55,-1 L57,-8 L59,-1" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M68,-1 L70,-7 L72,-1" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M82,-1 L84,-6 L86,-1" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
      </G>
      {/* Crystal spikes — bottom edge */}
      <G opacity={0.55}>
        <Path d="M20,101 L22,108 L24,101" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M40,101 L42,107 L44,101" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M60,101 L62,109 L64,101" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M78,101 L80,106 L82,101" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
      </G>
      {/* Crystal spikes — left edge */}
      <G opacity={0.5}>
        <Path d="M-1,20 L-7,22 L-1,24" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M-1,45 L-8,47 L-1,49" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M-1,70 L-6,72 L-1,74" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
      </G>
      {/* Crystal spikes — right edge */}
      <G opacity={0.5}>
        <Path d="M101,25 L108,27 L101,29" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M101,50 L107,52 L101,54" fill="#7B48A8" stroke="#9060D0" strokeWidth={0.4} />
        <Path d="M101,75 L106,77 L101,79" fill="#6838A0" stroke="#9060D0" strokeWidth={0.4} />
      </G>
      {/* Geode arc texture — inside corners */}
      <G opacity={0.3} fill="none" stroke="#9060D0" strokeWidth={0.5}>
        <Path d="M3,3 Q6,1 8,3 Q10,6 8,8" />
        <Path d="M97,3 Q94,1 92,3 Q90,6 92,8" />
        <Path d="M3,97 Q6,99 8,97 Q10,94 8,92" />
        <Path d="M97,97 Q94,99 92,97 Q90,94 92,92" />
      </G>
      {/* Facet reflection highlights */}
      <G opacity={0.4}>
        <Path d="M17,-5 L18,-3" stroke="#D0B0FF" strokeWidth={0.4} />
        <Path d="M57,-6 L58,-3" stroke="#D0B0FF" strokeWidth={0.4} />
        <Path d="M30,-7 L31,-4" stroke="#D0B0FF" strokeWidth={0.4} />
        <Path d="M-6,22 L-3,22" stroke="#D0B0FF" strokeWidth={0.4} />
        <Path d="M106,27 L103,27" stroke="#D0B0FF" strokeWidth={0.4} />
      </G>
      {/* Sparkle dots on crystal tips */}
      <G opacity={0.6}>
        <Circle cx={17} cy={-7} r={0.4} fill="#E0D0FF" />
        <Circle cx={30} cy={-9} r={0.5} fill="#E0D0FF" />
        <Circle cx={57} cy={-8} r={0.4} fill="#E0D0FF" />
        <Circle cx={-7} cy={22} r={0.4} fill="#E0D0FF" />
        <Circle cx={-8} cy={47} r={0.4} fill="#E0D0FF" />
        <Circle cx={108} cy={27} r={0.4} fill="#E0D0FF" />
      </G>
    </Svg>
  );
});
CrystalThornFrame.displayName = 'CrystalThornFrame';
