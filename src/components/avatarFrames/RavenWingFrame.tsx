import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * RavenWingFrame — 鸦翼
 *
 * 漆黑乌鸦羽毛层叠覆盖边框 · 羽毛倒钩(barb)纹理 · 鸦爪角饰 · 鸦眼红色高光。
 */
export const RavenWingFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `rwM${userId}`;
  const sheenG = `rwS${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A2A30" stopOpacity={0.95} />
          <Stop offset="0.4" stopColor="#151518" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#0A0A0C" stopOpacity={1} />
          <Stop offset="1" stopColor="#2A2A30" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={sheenG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A4A60" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#2A2A35" stopOpacity={0} />
          <Stop offset="1" stopColor="#4A4A60" stopOpacity={0.3} />
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
        stroke="#000005"
        strokeWidth={6}
        opacity={0.25}
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
      {/* Oil sheen */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${sheenG})`}
        strokeWidth={2}
      />
      {/* Inner */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#2A2A30"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Feather overlays — top edge (layered quill shapes) */}
      <G opacity={0.5} fill="none" stroke="#303038" strokeWidth={0.7}>
        <Path d="M10,-3 Q15,-6 20,-2 Q18,-1 12,-1 Z" />
        <Path d="M20,-3 Q25,-6 30,-2 Q28,-1 22,-1 Z" />
        <Path d="M30,-3 Q35,-6 40,-2 Q38,-1 32,-1 Z" />
        <Path d="M45,-3 Q50,-6 55,-2 Q53,-1 47,-1 Z" />
        <Path d="M55,-3 Q60,-6 65,-2 Q63,-1 57,-1 Z" />
        <Path d="M65,-3 Q70,-6 75,-2 Q73,-1 67,-1 Z" />
        <Path d="M78,-3 Q83,-6 88,-2 Q86,-1 80,-1 Z" />
      </G>
      {/* Feather barb lines — top edge */}
      <G opacity={0.25} stroke="#40404A" strokeWidth={0.3}>
        <Path d="M12,-4 L15,-2" />
        <Path d="M14,-5 L17,-3" />
        <Path d="M32,-4 L35,-2" />
        <Path d="M50,-5 L53,-3" />
        <Path d="M70,-4 L73,-2" />
        <Path d="M82,-5 L85,-3" />
      </G>
      {/* Feather overlays — bottom edge */}
      <G opacity={0.5} fill="none" stroke="#303038" strokeWidth={0.7}>
        <Path d="M10,103 Q15,106 20,102 Q18,101 12,101 Z" />
        <Path d="M30,103 Q35,106 40,102 Q38,101 32,101 Z" />
        <Path d="M55,103 Q60,106 65,102 Q63,101 57,101 Z" />
        <Path d="M78,103 Q83,106 88,102 Q86,101 80,101 Z" />
      </G>
      {/* Left edge feathers */}
      <G opacity={0.4} fill="none" stroke="#303038" strokeWidth={0.6}>
        <Path d="M-3,15 Q-6,20 -2,25 Q-1,22 -1,17 Z" />
        <Path d="M-3,35 Q-6,40 -2,45 Q-1,42 -1,37 Z" />
        <Path d="M-3,60 Q-6,65 -2,70 Q-1,67 -1,62 Z" />
        <Path d="M-3,80 Q-6,85 -2,90 Q-1,87 -1,82 Z" />
      </G>
      {/* Corvid claw — top-left corner */}
      <G opacity={0.55} fill="none" stroke="#1A1A20" strokeWidth={0.8} strokeLinecap="round">
        <Path d="M-5,-5 Q-3,-2 0,0" />
        <Path d="M-6,-3 Q-3,0 1,2" />
        <Path d="M-4,-6 Q-1,-3 2,0" />
      </G>
      {/* Corvid claw — bottom-right corner */}
      <G opacity={0.55} fill="none" stroke="#1A1A20" strokeWidth={0.8} strokeLinecap="round">
        <Path d="M105,105 Q103,102 100,100" />
        <Path d="M106,103 Q103,100 99,98" />
        <Path d="M104,106 Q101,103 98,100" />
      </G>
      {/* Raven eye — top-right accent */}
      <G opacity={0.6}>
        <Circle cx={100} cy={0} r={2.5} fill="#151518" stroke="#303038" strokeWidth={0.5} />
        <Circle cx={100} cy={0} r={1} fill="#CC2222" />
        <Circle cx={100.5} cy={-0.5} r={0.3} fill="#FF4444" />
      </G>
    </Svg>
  );
});
RavenWingFrame.displayName = 'RavenWingFrame';
