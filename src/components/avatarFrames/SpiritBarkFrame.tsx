import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SpiritBarkFrame — 灵木
 *
 * 古树皮框 · 四角粗壮树根向外蜿蜒 · 树瘤突起 · 灵光苔藓斑点。
 */
export const SpiritBarkFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `sbM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6B4226" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#4A2C17" stopOpacity={1} />
          <Stop offset="1" stopColor="#6B4226" stopOpacity={0.9} />
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
        stroke="#1A0E08"
        strokeWidth={6}
        opacity={0.15}
      />
      {/* Main bark frame */}
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
      {/* Inner ring */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#8B5E3C"
        strokeWidth={0.7}
        opacity={0.4}
      />
      {/* Root tendrils from corners — thick, visible */}
      <Path
        d="M-2,-2 Q-8,5 -6,15 Q-4,10 -1,6"
        fill="none"
        stroke="#5C3A1E"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M0,-3 Q-5,3 -4,10"
        fill="none"
        stroke="#7B4F2E"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,-2 Q108,5 106,15 Q104,10 101,6"
        fill="none"
        stroke="#5C3A1E"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M100,-3 Q105,3 104,10"
        fill="none"
        stroke="#7B4F2E"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M-2,102 Q-8,95 -6,85 Q-4,90 -1,94"
        fill="none"
        stroke="#5C3A1E"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M0,103 Q-5,97 -4,90"
        fill="none"
        stroke="#7B4F2E"
        strokeWidth={1.5}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M102,102 Q108,95 106,85 Q104,90 101,94"
        fill="none"
        stroke="#5C3A1E"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      {/* Bark knots along edges */}
      <Circle
        cx={30}
        cy={-1}
        r={2.5}
        fill="#5C3A1E"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Circle
        cx={70}
        cy={-1}
        r={2}
        fill="#4A2C17"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.65}
      />
      <Circle
        cx={-1}
        cy={40}
        r={2.2}
        fill="#5C3A1E"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Circle
        cx={101}
        cy={60}
        r={2.5}
        fill="#5C3A1E"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.7}
      />
      <Circle
        cx={40}
        cy={101}
        r={2}
        fill="#4A2C17"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.65}
      />
      <Circle
        cx={75}
        cy={101}
        r={2.3}
        fill="#5C3A1E"
        stroke="#7B4F2E"
        strokeWidth={0.6}
        opacity={0.7}
      />
      {/* Moss glow spots */}
      <Circle cx={15} cy={-3} r={1.2} fill="#58D68D" opacity={0.6} />
      <Circle cx={-3} cy={25} r={1} fill="#58D68D" opacity={0.5} />
      <Circle cx={85} cy={103} r={1.2} fill="#58D68D" opacity={0.6} />
      <Circle cx={103} cy={75} r={1} fill="#58D68D" opacity={0.5} />
      {/* Bark grain lines */}
      <Path
        d="M10,0 L12,3"
        stroke="#3A1F0F"
        strokeWidth={0.8}
        opacity={0.4}
        strokeLinecap="round"
      />
      <Path
        d="M50,0 L52,3"
        stroke="#3A1F0F"
        strokeWidth={0.8}
        opacity={0.4}
        strokeLinecap="round"
      />
      <Path
        d="M0,55 L3,57"
        stroke="#3A1F0F"
        strokeWidth={0.8}
        opacity={0.4}
        strokeLinecap="round"
      />
    </Svg>
  );
});
SpiritBarkFrame.displayName = 'SpiritBarkFrame';
