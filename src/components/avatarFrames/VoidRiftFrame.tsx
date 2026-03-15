import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const VoidRiftFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const voidGrad = `voidGrad${uid}`;
  const riftGlow = `riftGlow${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <RadialGradient id={voidGrad} cx="50%" cy="50%" r="70%">
          <Stop offset="0" stopColor="#301060" stopOpacity={0.3} />
          <Stop offset="0.7" stopColor="#4A1880" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#6030A0" stopOpacity={0.9} />
        </RadialGradient>
        <LinearGradient id={riftGlow} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A060E0" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#6030A0" stopOpacity={0.7} />
        </LinearGradient>
      </Defs>
      {/* Main frame — at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${riftGlow})`}
        strokeWidth={2.5}
      />
      {/* Inner frame */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#4A1880"
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Rift cracks — overflow outward */}
      <Path
        d="M25,0 L23,-6 L26,-10"
        fill="none"
        stroke="#A060E0"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M60,0 L62,-8 L59,-12"
        fill="none"
        stroke="#C080FF"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M80,0 L78,-5 L81,-9"
        fill="none"
        stroke="#A060E0"
        strokeWidth={0.8}
        opacity={0.5}
        strokeLinecap="round"
      />
      <Path
        d="M40,100 L42,106 L39,110"
        fill="none"
        stroke="#A060E0"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M70,100 L68,107 L71,111"
        fill="none"
        stroke="#C080FF"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M0,35 L-6,33 L-10,36"
        fill="none"
        stroke="#A060E0"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      <Path
        d="M0,65 L-7,67 L-11,64"
        fill="none"
        stroke="#C080FF"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M100,30 L106,28 L110,31"
        fill="none"
        stroke="#A060E0"
        strokeWidth={1}
        opacity={0.6}
        strokeLinecap="round"
      />
      <Path
        d="M100,70 L107,72 L111,69"
        fill="none"
        stroke="#A060E0"
        strokeWidth={1.2}
        opacity={0.7}
        strokeLinecap="round"
      />
      {/* Void eye diamonds at corners */}
      <Path
        d="M0,0 L4,-3 L8,0 L4,3 Z"
        fill="#6030A0"
        stroke="#A060E0"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M92,0 L96,-3 L100,0 L96,3 Z"
        fill="#6030A0"
        stroke="#A060E0"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M0,100 L4,97 L8,100 L4,103 Z"
        fill="#6030A0"
        stroke="#A060E0"
        strokeWidth={0.6}
        opacity={0.8}
      />
      <Path
        d="M92,100 L96,97 L100,100 L96,103 Z"
        fill="#6030A0"
        stroke="#A060E0"
        strokeWidth={0.6}
        opacity={0.8}
      />
      {/* Void particles */}
      <Circle cx={15} cy={-4} r={0.8} fill="#C080FF" opacity={0.5} />
      <Circle cx={85} cy={104} r={0.8} fill="#C080FF" opacity={0.5} />
      <Circle cx={-4} cy={50} r={0.6} fill="#A060E0" opacity={0.4} />
      <Circle cx={104} cy={50} r={0.6} fill="#A060E0" opacity={0.4} />
    </Svg>
  );
});
VoidRiftFrame.displayName = 'VoidRiftFrame';
