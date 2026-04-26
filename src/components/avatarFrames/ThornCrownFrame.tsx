import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ThornCrownFrame — 荆冠
 *
 * 古铜荆棘冠 · 粗壮荆条编织环绕 · 尖刺向外突出 · 暗红宝石镶嵌。
 */
export const ThornCrownFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `tcM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8B6914" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#6B4F10" stopOpacity={1} />
          <Stop offset="1" stopColor="#8B6914" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Base frame */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${mainG})`}
        strokeWidth={4.5}
      />
      {/* Bramble weave overlay */}
      <Path
        d="M10,0 Q15,-2 20,0 Q25,-1 30,0 Q35,-2 40,0 Q45,-1 50,0 Q55,-2 60,0 Q65,-1 70,0 Q75,-2 80,0 Q85,-1 90,0"
        fill="none"
        stroke="#6B4F10"
        strokeWidth={2}
        opacity={0.7}
      />
      <Path
        d="M10,100 Q15,102 20,100 Q25,101 30,100 Q35,102 40,100 Q45,101 50,100 Q55,102 60,100 Q65,101 70,100 Q75,102 80,100 Q85,101 90,100"
        fill="none"
        stroke="#6B4F10"
        strokeWidth={2}
        opacity={0.7}
      />
      {/* Thorn spikes — top */}
      <Path
        d="M18,0 L16,-6 L20,-1"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M35,0 L33,-5 L37,-1"
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <Path
        d="M50,0 L48,-7 L52,-1"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M65,0 L63,-5 L67,-1"
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.75}
      />
      <Path
        d="M82,0 L80,-6 L84,-1"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.8}
      />
      {/* Thorn spikes — bottom */}
      <Path
        d="M18,100 L16,106 L20,101"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Path
        d="M50,100 L48,107 L52,101"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Path
        d="M82,100 L80,106 L84,101"
        fill="#6B4F10"
        stroke="#8B6914"
        strokeWidth={0.5}
        opacity={0.8}
      />
      {/* Thorn spikes — sides */}
      <Path d="M0,20 L-5,18 L-1,22" fill="#6B4F10" opacity={0.8} />
      <Path d="M0,50 L-6,48 L-1,52" fill="#6B4F10" opacity={0.85} />
      <Path d="M0,80 L-5,78 L-1,82" fill="#6B4F10" opacity={0.8} />
      <Path d="M100,25 L105,23 L101,27" fill="#6B4F10" opacity={0.8} />
      <Path d="M100,50 L106,48 L101,52" fill="#6B4F10" opacity={0.85} />
      <Path d="M100,75 L105,73 L101,77" fill="#6B4F10" opacity={0.8} />
      {/* Corner bramble knots */}
      <Circle
        cx={0}
        cy={0}
        r={3}
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.8}
        opacity={0.75}
      />
      <Circle
        cx={100}
        cy={0}
        r={3}
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.8}
        opacity={0.75}
      />
      <Circle
        cx={0}
        cy={100}
        r={3}
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.8}
        opacity={0.75}
      />
      <Circle
        cx={100}
        cy={100}
        r={3}
        fill="#5A4110"
        stroke="#8B6914"
        strokeWidth={0.8}
        opacity={0.75}
      />
      {/* Dark ruby gems */}
      <Circle
        cx={50}
        cy={-2}
        r={2}
        fill="#7B241C"
        stroke="#C0392B"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Circle cx={50} cy={-2.5} r={0.6} fill="#E74C3C" opacity={0.7} />
      <Circle
        cx={50}
        cy={102}
        r={2}
        fill="#7B241C"
        stroke="#C0392B"
        strokeWidth={0.5}
        opacity={0.8}
      />
      <Circle cx={50} cy={101.5} r={0.6} fill="#E74C3C" opacity={0.7} />
    </Svg>
  );
});
ThornCrownFrame.displayName = 'ThornCrownFrame';
