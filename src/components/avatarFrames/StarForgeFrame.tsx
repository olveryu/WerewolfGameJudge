import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * StarForgeFrame — 星锻
 *
 * 深紫宇宙底色 · 星云彩虹叠层 · 星座三角/V/锯齿连线角饰 · 散布恒星粒子。
 */
export const StarForgeFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `stfM${userId}`;
  const nebG = `stfN${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#1A1040" stopOpacity={0.95} />
          <Stop offset="0.3" stopColor="#2A1860" stopOpacity={1} />
          <Stop offset="0.6" stopColor="#3A2080" stopOpacity={1} />
          <Stop offset="1" stopColor="#1A1040" stopOpacity={0.95} />
        </LinearGradient>
        <LinearGradient id={nebG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF6090" stopOpacity={0.2} />
          <Stop offset="0.4" stopColor="#6060FF" stopOpacity={0.2} />
          <Stop offset="0.7" stopColor="#60FFFF" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#FF6090" stopOpacity={0.2} />
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
        stroke="#050010"
        strokeWidth={6}
        opacity={0.2}
      />
      {/* Cosmic frame */}
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
      {/* Nebula overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${nebG})`}
        strokeWidth={2.5}
      />
      {/* Inner */}
      <Rect
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#3A2080"
        strokeWidth={0.7}
        opacity={0.4}
      />
      {/* Constellation — top-left (triangle) */}
      <G opacity={0.55}>
        <Circle cx={-2} cy={8} r={1} fill="#FFFFFF" />
        <Circle cx={8} cy={-3} r={1.2} fill="#FFFFFF" />
        <Circle cx={3} cy={3} r={0.8} fill="#CCCCFF" />
        <Line x1={-2} y1={8} x2={3} y2={3} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={3} y1={3} x2={8} y2={-3} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={8} y1={-3} x2={-2} y2={8} stroke="#8888FF" strokeWidth={0.3} opacity={0.6} />
      </G>
      {/* Constellation — top-right (V shape) */}
      <G opacity={0.55}>
        <Circle cx={92} cy={-2} r={1} fill="#FFFFFF" />
        <Circle cx={100} cy={5} r={0.8} fill="#CCCCFF" />
        <Circle cx={103} cy={-3} r={1.2} fill="#FFFFFF" />
        <Line x1={92} y1={-2} x2={100} y2={5} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={100} y1={5} x2={103} y2={-3} stroke="#8888FF" strokeWidth={0.4} />
      </G>
      {/* Constellation — bottom-left (zigzag) */}
      <G opacity={0.55}>
        <Circle cx={-3} cy={88} r={1} fill="#FFFFFF" />
        <Circle cx={5} cy={95} r={0.8} fill="#CCCCFF" />
        <Circle cx={-2} cy={100} r={1.2} fill="#FFFFFF" />
        <Circle cx={8} cy={103} r={0.8} fill="#CCCCFF" />
        <Line x1={-3} y1={88} x2={5} y2={95} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={5} y1={95} x2={-2} y2={100} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={-2} y1={100} x2={8} y2={103} stroke="#8888FF" strokeWidth={0.4} />
      </G>
      {/* Constellation — bottom-right (pair) */}
      <G opacity={0.55}>
        <Circle cx={92} cy={103} r={1} fill="#FFFFFF" />
        <Circle cx={103} cy={92} r={1} fill="#FFFFFF" />
        <Circle cx={97} cy={97} r={0.6} fill="#CCCCFF" />
        <Line x1={92} y1={103} x2={97} y2={97} stroke="#8888FF" strokeWidth={0.4} />
        <Line x1={97} y1={97} x2={103} y2={92} stroke="#8888FF" strokeWidth={0.4} />
      </G>
      {/* Scattered edge stars */}
      <G opacity={0.5}>
        <Circle cx={30} cy={-3} r={0.6} fill="#FFFFFF" />
        <Circle cx={50} cy={-4} r={0.8} fill="#CCCCFF" />
        <Circle cx={70} cy={-2} r={0.5} fill="#FFFFFF" />
        <Circle cx={-4} cy={40} r={0.7} fill="#FFFFFF" />
        <Circle cx={-3} cy={65} r={0.6} fill="#CCCCFF" />
        <Circle cx={104} cy={35} r={0.6} fill="#FFFFFF" />
        <Circle cx={103} cy={75} r={0.7} fill="#CCCCFF" />
        <Circle cx={40} cy={103} r={0.6} fill="#FFFFFF" />
        <Circle cx={70} cy={104} r={0.5} fill="#FFFFFF" />
      </G>
    </Svg>
  );
});
StarForgeFrame.displayName = 'StarForgeFrame';
