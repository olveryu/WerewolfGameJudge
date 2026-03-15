import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const PharaohGoldFrame = memo<FrameProps>(({ size, rx }) => {
  const uid = useId();
  const goldGrad = `goldGrad${uid}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={goldGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D4AA30" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#B8942A" stopOpacity={1} />
          <Stop offset="1" stopColor="#8A6E18" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Triple-layer frame — outer at avatar edge */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={2}
      />
      <Rect
        x={4}
        y={4}
        width={92}
        height={92}
        rx={Math.max(rx - 3, 0)}
        fill="none"
        stroke="#B8942A"
        strokeWidth={1.5}
        opacity={0.8}
      />
      <Rect
        x={8}
        y={8}
        width={84}
        height={84}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#8A6E18"
        strokeWidth={1}
        opacity={0.6}
      />
      {/* Corner pyramidal triangles — overflow */}
      <Path d="M-2,-2 L12,-2 L-2,12 Z" fill="#D4AA30" opacity={0.6} />
      <Path d="M88,-2 L102,-2 L102,12 Z" fill="#D4AA30" opacity={0.6} />
      <Path d="M-2,88 L-2,102 L12,102 Z" fill="#D4AA30" opacity={0.6} />
      <Path d="M88,102 L102,102 L102,88 Z" fill="#D4AA30" opacity={0.6} />
      {/* Inner corner triangles */}
      <Path d="M4,4 L10,4 L4,10 Z" fill="#B8942A" opacity={0.4} />
      <Path d="M90,4 L96,4 L96,10 Z" fill="#B8942A" opacity={0.4} />
      <Path d="M4,90 L4,96 L10,96 Z" fill="#B8942A" opacity={0.4} />
      <Path d="M90,96 L96,96 L96,90 Z" fill="#B8942A" opacity={0.4} />
      {/* Edge pyramid marks — overflow */}
      <Path d="M40,0 L44,-2 L48,0" fill="none" stroke="#D4AA30" strokeWidth={1} />
      <Path d="M52,0 L56,-2 L60,0" fill="none" stroke="#D4AA30" strokeWidth={1} />
      <Path d="M40,100 L44,102 L48,100" fill="none" stroke="#D4AA30" strokeWidth={1} />
      <Path d="M52,100 L56,102 L60,100" fill="none" stroke="#D4AA30" strokeWidth={1} />
      <Path d="M0,40 L-2,44 L0,48" fill="none" stroke="#D4AA30" strokeWidth={1} />
      <Path d="M100,40 L102,44 L100,48" fill="none" stroke="#D4AA30" strokeWidth={1} />
      {/* Center-edge scarab diamonds */}
      <Path d="M50,-3 L52,-1 L50,1 L48,-1 Z" fill="#DDBB40" opacity={0.8} />
      <Path d="M50,99 L52,101 L50,103 L48,101 Z" fill="#DDBB40" opacity={0.8} />
      <Path d="M-3,50 L-1,48 L1,50 L-1,52 Z" fill="#DDBB40" opacity={0.8} />
      <Path d="M99,50 L101,48 L103,50 L101,52 Z" fill="#DDBB40" opacity={0.8} />
    </Svg>
  );
});
PharaohGoldFrame.displayName = 'PharaohGoldFrame';
