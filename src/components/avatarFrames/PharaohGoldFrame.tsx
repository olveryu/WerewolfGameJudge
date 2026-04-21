import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

export const PharaohGoldFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const goldGrad = `goldGrad${userId}`;
  const c = rx * 0.29;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={goldGrad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D4AA30" stopOpacity={0.95} />
          <Stop offset="0.5" stopColor="#B8942A" stopOpacity={1} />
          <Stop offset="1" stopColor="#8A6E18" stopOpacity={0.95} />
        </LinearGradient>
      </Defs>
      {/* Triple-layer frame — outer thicker */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${goldGrad})`}
        strokeWidth={3}
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
      {/* Corner pyramidal triangles — larger */}
      <Path
        d={`M${c - 3},${c - 3} L${c + 14},${c - 3} L${c - 3},${c + 14} Z`}
        fill="#D4AA30"
        opacity={0.6}
      />
      <Path
        d={`M${100 - c - 14},${c - 3} L${100 - c + 3},${c - 3} L${100 - c + 3},${c + 14} Z`}
        fill="#D4AA30"
        opacity={0.6}
      />
      <Path
        d={`M${c - 3},${100 - c - 14} L${c - 3},${100 - c + 3} L${c + 14},${100 - c + 3} Z`}
        fill="#D4AA30"
        opacity={0.6}
      />
      <Path
        d={`M${100 - c - 14},${100 - c + 3} L${100 - c + 3},${100 - c + 3} L${100 - c + 3},${100 - c - 14} Z`}
        fill="#D4AA30"
        opacity={0.6}
      />
      {/* Inner corner triangles */}
      <Path
        d={`M${c + 4},${c + 4} L${c + 10},${c + 4} L${c + 4},${c + 10} Z`}
        fill="#B8942A"
        opacity={0.4}
      />
      <Path
        d={`M${100 - c - 10},${c + 4} L${100 - c - 4},${c + 4} L${100 - c - 4},${c + 10} Z`}
        fill="#B8942A"
        opacity={0.4}
      />
      <Path
        d={`M${c + 4},${100 - c - 10} L${c + 4},${100 - c - 4} L${c + 10},${100 - c - 4} Z`}
        fill="#B8942A"
        opacity={0.4}
      />
      <Path
        d={`M${100 - c - 10},${100 - c - 4} L${100 - c - 4},${100 - c - 4} L${100 - c - 4},${100 - c - 10} Z`}
        fill="#B8942A"
        opacity={0.4}
      />
      {/* Corner inner line accents */}
      <G opacity={0.3} stroke="#DDBB40" strokeWidth={0.6} fill="none">
        <Line x1={c + 2} y1={c + 6} x2={c + 6} y2={c + 2} />
        <Line x1={100 - c - 2} y1={c + 6} x2={100 - c - 6} y2={c + 2} />
        <Line x1={c + 2} y1={100 - c - 6} x2={c + 6} y2={100 - c - 2} />
        <Line x1={100 - c - 2} y1={100 - c - 6} x2={100 - c - 6} y2={100 - c - 2} />
      </G>
      {/* Ankh symbol at top center */}
      <G opacity={0.7}>
        <Circle cx={50} cy={-4} r={2.5} fill="none" stroke="#D4AA30" strokeWidth={1} />
        <Line x1={50} y1={-1.5} x2={50} y2={4} stroke="#D4AA30" strokeWidth={1} />
        <Line x1={48} y1={1} x2={52} y2={1} stroke="#D4AA30" strokeWidth={0.8} />
      </G>
      {/* Ankh symbol at bottom center */}
      <G opacity={0.7}>
        <Circle cx={50} cy={104} r={2.5} fill="none" stroke="#D4AA30" strokeWidth={1} />
        <Line x1={50} y1={101.5} x2={50} y2={96} stroke="#D4AA30" strokeWidth={1} />
        <Line x1={48} y1={99} x2={52} y2={99} stroke="#D4AA30" strokeWidth={0.8} />
      </G>
      {/* Edge pyramid marks — more elaborate */}
      <Path d="M35,0 L38,-3 L41,0" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M47,0 L50,-3 L53,0" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M59,0 L62,-3 L65,0" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M35,100 L38,103 L41,100" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M47,100 L50,103 L53,100" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M59,100 L62,103 L65,100" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M0,35 L-3,38 L0,41" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M0,59 L-3,62 L0,65" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M100,35 L103,38 L100,41" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      <Path d="M100,59 L103,62 L100,65" fill="none" stroke="#D4AA30" strokeWidth={1.2} />
      {/* Center-edge scarab diamonds — larger */}
      <Path d="M-4,50 L-1,47 L2,50 L-1,53 Z" fill="#DDBB40" opacity={0.8} />
      <Path d="M98,50 L101,47 L104,50 L101,53 Z" fill="#DDBB40" opacity={0.8} />
      {/* Scarab wing lines beside side diamonds */}
      <G opacity={0.4} stroke="#D4AA30" strokeWidth={0.6} strokeLinecap="round">
        <Line x1={-4} y1={47} x2={-6} y2={45} />
        <Line x1={-4} y1={53} x2={-6} y2={55} />
        <Line x1={104} y1={47} x2={106} y2={45} />
        <Line x1={104} y1={53} x2={106} y2={55} />
      </G>
    </Svg>
  );
});
PharaohGoldFrame.displayName = 'PharaohGoldFrame';
