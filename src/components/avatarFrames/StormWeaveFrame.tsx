import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * StormWeaveFrame — 暴风编织
 *
 * 链环编织纹沿边 · 闪电锯齿穿越连接 · 风旋涡角饰 · 风暴灰蓝色调。
 */
export const StormWeaveFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `swM${userId}`;
  const boltG = `swB${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5A6880" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#354050" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#252D38" stopOpacity={1} />
          <Stop offset="1" stopColor="#5A6880" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={boltG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#88BBFF" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#88BBFF" stopOpacity={0.3} />
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
        stroke="#0A1020"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Main */}
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
      {/* Lightning overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${boltG})`}
        strokeWidth={1.5}
      />
      {/* Inner */}
      <Rect
        x={7}
        y={7}
        width={86}
        height={86}
        rx={Math.max(rx - 6, 0)}
        fill="none"
        stroke="#354050"
        strokeWidth={0.6}
        opacity={0.4}
      />
      {/* Chain link pattern — top */}
      <G opacity={0.35} fill="none" stroke="#6A7888" strokeWidth={0.6}>
        <Path d="M12,-2 Q15,-4 18,-2 Q15,0 12,-2" />
        <Path d="M22,-2 Q25,-4 28,-2 Q25,0 22,-2" />
        <Path d="M32,-2 Q35,-4 38,-2 Q35,0 32,-2" />
        <Path d="M42,-2 Q45,-4 48,-2 Q45,0 42,-2" />
        <Path d="M52,-2 Q55,-4 58,-2 Q55,0 52,-2" />
        <Path d="M62,-2 Q65,-4 68,-2 Q65,0 62,-2" />
        <Path d="M72,-2 Q75,-4 78,-2 Q75,0 72,-2" />
        <Path d="M82,-2 Q85,-4 88,-2 Q85,0 82,-2" />
      </G>
      {/* Chain link pattern — bottom */}
      <G opacity={0.35} fill="none" stroke="#6A7888" strokeWidth={0.6}>
        <Path d="M12,102 Q15,104 18,102 Q15,100 12,102" />
        <Path d="M32,102 Q35,104 38,102 Q35,100 32,102" />
        <Path d="M52,102 Q55,104 58,102 Q55,100 52,102" />
        <Path d="M72,102 Q75,104 78,102 Q75,100 72,102" />
      </G>
      {/* Lightning zigzag — left edge */}
      <Path
        d="M-2,20 L1,25 L-3,30 L0,35 L-2,40"
        fill="none"
        stroke="#88BBFF"
        strokeWidth={0.7}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Lightning zigzag — right edge */}
      <Path
        d="M102,60 L99,65 L103,70 L100,75 L102,80"
        fill="none"
        stroke="#88BBFF"
        strokeWidth={0.7}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Lightning flash — horizontal top */}
      <Path
        d="M25,-4 L30,-2 L27,-1 L35,0"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={0.5}
        opacity={0.4}
      />
      {/* Wind vortex spirals — corners */}
      <G opacity={0.4} fill="none" stroke="#8A98A8" strokeWidth={0.8} strokeLinecap="round">
        <Path d="M-3,-3 Q0,-6 3,-3 Q6,0 3,3 Q0,5 -2,3" />
        <Path d="M103,-3 Q100,-6 97,-3 Q94,0 97,3 Q100,5 102,3" />
        <Path d="M-3,103 Q0,106 3,103 Q6,100 3,97 Q0,95 -2,97" />
        <Path d="M103,103 Q100,106 97,103 Q94,100 97,97 Q100,95 102,97" />
      </G>
      {/* Spark particles */}
      <G opacity={0.5}>
        <Circle cx={-4} cy={30} r={0.6} fill="#88BBFF" />
        <Circle cx={104} cy={70} r={0.6} fill="#88BBFF" />
        <Circle cx={50} cy={-4} r={0.7} fill="#AACCFF" />
        <Circle cx={40} cy={104} r={0.6} fill="#88BBFF" />
      </G>
      {/* Tiny bolt marks at mid-edges */}
      <G opacity={0.45} stroke="#AACCFF" strokeWidth={0.4}>
        <Line x1={48} y1={-5} x2={50} y2={-3} />
        <Line x1={50} y1={-3} x2={48} y2={-1} />
        <Line x1={-4} y1={50} x2={-2} y2={48} />
        <Line x1={-2} y1={48} x2={0} y2={50} />
      </G>
    </Svg>
  );
});
StormWeaveFrame.displayName = 'StormWeaveFrame';
