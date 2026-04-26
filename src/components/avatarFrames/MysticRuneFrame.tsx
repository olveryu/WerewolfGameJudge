import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * MysticRuneFrame — 秘文
 *
 * 深蓝底框 · 四角发光符文圆盘 · 边缘符文刻线 · 神秘蓝光脉冲。
 */
export const MysticRuneFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `mrM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2E4053" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#1B2631" stopOpacity={1} />
          <Stop offset="1" stopColor="#2E4053" stopOpacity={0.95} />
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
      {/* Inner glow line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Rune discs at corners — large, glowing */}
      <Circle cx={0} cy={0} r={6} fill="#1B2631" stroke="#5DADE2" strokeWidth={1.2} opacity={0.8} />
      <Path
        d="M-2,-2 L2,2 M2,-2 L-2,2 M0,-3 L0,3"
        stroke="#85C1E9"
        strokeWidth={0.7}
        opacity={0.7}
      />
      <Circle
        cx={100}
        cy={0}
        r={6}
        fill="#1B2631"
        stroke="#5DADE2"
        strokeWidth={1.2}
        opacity={0.8}
      />
      <Path
        d="M98,-2 L102,2 M102,-2 L98,2 M100,-3 L100,3"
        stroke="#85C1E9"
        strokeWidth={0.7}
        opacity={0.7}
      />
      <Circle
        cx={0}
        cy={100}
        r={6}
        fill="#1B2631"
        stroke="#5DADE2"
        strokeWidth={1.2}
        opacity={0.8}
      />
      <Path
        d="M-2,98 L2,102 M2,98 L-2,102 M0,97 L0,103"
        stroke="#85C1E9"
        strokeWidth={0.7}
        opacity={0.7}
      />
      <Circle
        cx={100}
        cy={100}
        r={6}
        fill="#1B2631"
        stroke="#5DADE2"
        strokeWidth={1.2}
        opacity={0.8}
      />
      <Path
        d="M98,98 L102,102 M102,98 L98,102 M100,97 L100,103"
        stroke="#85C1E9"
        strokeWidth={0.7}
        opacity={0.7}
      />
      {/* Rune lines along top edge */}
      <Path
        d="M20,-1 L22,-4 L24,-1 L26,-3 L28,-1"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <Path
        d="M40,-1 L42,-3 L44,-1 L46,-4 L48,-1"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <Path
        d="M55,-1 L57,-4 L59,-1 L61,-3 L63,-1"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <Path
        d="M72,-1 L74,-3 L76,-1 L78,-4 L80,-1"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      {/* Rune lines along bottom */}
      <Path
        d="M20,101 L22,104 L24,101 L26,103 L28,101"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      <Path
        d="M55,101 L57,104 L59,101 L61,103 L63,101"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.6}
      />
      {/* Side rune marks */}
      <Path d="M-1,30 L-4,32 L-1,34" fill="none" stroke="#5DADE2" strokeWidth={0.8} opacity={0.5} />
      <Path d="M-1,60 L-4,62 L-1,64" fill="none" stroke="#5DADE2" strokeWidth={0.8} opacity={0.5} />
      <Path
        d="M101,40 L104,42 L101,44"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.5}
      />
      <Path
        d="M101,70 L104,72 L101,74"
        fill="none"
        stroke="#5DADE2"
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* Center glow dots on edges */}
      <Circle cx={50} cy={-2} r={1.5} fill="#85C1E9" opacity={0.7} />
      <Circle cx={50} cy={102} r={1.5} fill="#85C1E9" opacity={0.7} />
      <Circle cx={-2} cy={50} r={1.5} fill="#85C1E9" opacity={0.7} />
      <Circle cx={102} cy={50} r={1.5} fill="#85C1E9" opacity={0.7} />
    </Svg>
  );
});
MysticRuneFrame.displayName = 'MysticRuneFrame';
