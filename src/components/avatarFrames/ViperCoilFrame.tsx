import { memo, useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ViperCoilFrame — 蝰蛇
 *
 * 蛇鳞绿框 · 蛇身从四角蜿蜒而出 · 三角蛇头 · 红色蛇眼 · 鳞片纹理。
 */
export const ViperCoilFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `vcM${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2ECC71" stopOpacity={0.85} />
          <Stop offset="0.5" stopColor="#1D8348" stopOpacity={1} />
          <Stop offset="1" stopColor="#2ECC71" stopOpacity={0.85} />
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
      {/* Inner scale line */}
      <Rect
        x={5}
        y={5}
        width={90}
        height={90}
        rx={Math.max(rx - 4, 0)}
        fill="none"
        stroke="#58D68D"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Snake coil from top-left — body + triangular head */}
      <Path
        d="M-3,10 Q-6,5 -3,0 Q0,-5 5,-3"
        fill="none"
        stroke="#1D8348"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M5,-3 L8,-7 L10,-2 Z"
        fill="#1D8348"
        stroke="#2ECC71"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Circle cx={7} cy={-5} r={0.8} fill="#E74C3C" opacity={0.9} />
      {/* Snake coil from top-right */}
      <Path
        d="M103,10 Q106,5 103,0 Q100,-5 95,-3"
        fill="none"
        stroke="#1D8348"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M95,-3 L92,-7 L90,-2 Z"
        fill="#1D8348"
        stroke="#2ECC71"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Circle cx={93} cy={-5} r={0.8} fill="#E74C3C" opacity={0.9} />
      {/* Snake coil from bottom-left */}
      <Path
        d="M-3,90 Q-6,95 -3,100 Q0,105 5,103"
        fill="none"
        stroke="#1D8348"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M5,103 L8,107 L10,102 Z"
        fill="#1D8348"
        stroke="#2ECC71"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Circle cx={7} cy={105} r={0.8} fill="#E74C3C" opacity={0.9} />
      {/* Snake coil from bottom-right */}
      <Path
        d="M103,90 Q106,95 103,100 Q100,105 95,103"
        fill="none"
        stroke="#1D8348"
        strokeWidth={3}
        opacity={0.8}
        strokeLinecap="round"
      />
      <Path
        d="M95,103 L92,107 L90,102 Z"
        fill="#1D8348"
        stroke="#2ECC71"
        strokeWidth={0.5}
        opacity={0.85}
      />
      <Circle cx={93} cy={105} r={0.8} fill="#E74C3C" opacity={0.9} />
      {/* Scale pattern along top edge */}
      <Path d="M20,0 Q25,-2 30,0" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.55} />
      <Path d="M35,0 Q40,-2 45,0" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.55} />
      <Path d="M50,0 Q55,-2 60,0" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.55} />
      <Path d="M65,0 Q70,-2 75,0" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.55} />
      {/* Scale pattern along bottom */}
      <Path
        d="M25,100 Q30,102 35,100"
        fill="none"
        stroke="#2ECC71"
        strokeWidth={1}
        opacity={0.55}
      />
      <Path
        d="M45,100 Q50,102 55,100"
        fill="none"
        stroke="#2ECC71"
        strokeWidth={1}
        opacity={0.55}
      />
      <Path
        d="M65,100 Q70,102 75,100"
        fill="none"
        stroke="#2ECC71"
        strokeWidth={1}
        opacity={0.55}
      />
      {/* Side scales */}
      <Path d="M0,25 Q-2,30 0,35" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.5} />
      <Path d="M0,55 Q-2,60 0,65" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.5} />
      <Path d="M100,35 Q102,40 100,45" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.5} />
      <Path d="M100,65 Q102,70 100,75" fill="none" stroke="#2ECC71" strokeWidth={1} opacity={0.5} />
    </Svg>
  );
});
ViperCoilFrame.displayName = 'ViperCoilFrame';
