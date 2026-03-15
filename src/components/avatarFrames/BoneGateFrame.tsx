import { memo, useId } from 'react';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const BoneGateFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const boneGrad = `boneGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={boneGrad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E0D8C8" stopOpacity={0.95} />
          <Stop offset="1" stopColor="#A89880" stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      {/* Outer bone border — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${boneGrad})`}
        strokeWidth={3}
      />
      {/* Inner bone border */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#B8A890"
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Cross bones — top-left (overflow) */}
      <Line
        x1={-4}
        y1={-4}
        x2={12}
        y2={12}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={-4}
        x2={-4}
        y2={12}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Cross bones — top-right */}
      <Line
        x1={88}
        y1={-4}
        x2={104}
        y2={12}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Line
        x1={104}
        y1={-4}
        x2={88}
        y2={12}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Cross bones — bottom-left */}
      <Line
        x1={-4}
        y1={88}
        x2={12}
        y2={104}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={88}
        x2={-4}
        y2={104}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Cross bones — bottom-right */}
      <Line
        x1={88}
        y1={88}
        x2={104}
        y2={104}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Line
        x1={104}
        y1={88}
        x2={88}
        y2={104}
        stroke="#D8D0C0"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Bone joint knobs */}
      <Circle cx={-4} cy={-4} r={2.5} fill="#E0D8C8" />
      <Circle cx={12} cy={-4} r={2.5} fill="#E0D8C8" />
      <Circle cx={-4} cy={12} r={2.5} fill="#E0D8C8" />
      <Circle cx={12} cy={12} r={2.5} fill="#E0D8C8" />
      <Circle cx={88} cy={-4} r={2.5} fill="#E0D8C8" />
      <Circle cx={104} cy={-4} r={2.5} fill="#E0D8C8" />
      <Circle cx={88} cy={12} r={2.5} fill="#E0D8C8" />
      <Circle cx={104} cy={12} r={2.5} fill="#E0D8C8" />
      <Circle cx={-4} cy={88} r={2.5} fill="#E0D8C8" />
      <Circle cx={12} cy={88} r={2.5} fill="#E0D8C8" />
      <Circle cx={-4} cy={104} r={2.5} fill="#E0D8C8" />
      <Circle cx={12} cy={104} r={2.5} fill="#E0D8C8" />
      <Circle cx={88} cy={88} r={2.5} fill="#E0D8C8" />
      <Circle cx={104} cy={88} r={2.5} fill="#E0D8C8" />
      <Circle cx={88} cy={104} r={2.5} fill="#E0D8C8" />
      <Circle cx={104} cy={104} r={2.5} fill="#E0D8C8" />
      {/* Mini skull at top center */}
      <Circle cx={50} cy={-2} r={3.5} fill="#D8D0C0" stroke="#3A3530" strokeWidth={0.6} />
      <Circle cx={48.5} cy={-2.8} r={0.7} fill="#3A3530" />
      <Circle cx={51.5} cy={-2.8} r={0.7} fill="#3A3530" />
      <Path d="M49,-0.5 L50,0.5 L51,-0.5" fill="none" stroke="#3A3530" strokeWidth={0.5} />
    </Svg>
  );
});
BoneGateFrame.displayName = 'BoneGateFrame';
