import { memo, useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * ViperCoilFrame — 蝰蛇盘旋
 *
 * 蛇身S曲线缠绕四角 · 菱形鳞片纹沿边 · 蛇头(三角+叉舌)对角 · 蛇腹白纹。
 */
export const ViperCoilFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `vcM${userId}`;
  const bellyG = `vcB${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A6B30" stopOpacity={0.9} />
          <Stop offset="0.3" stopColor="#2A4518" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#1A3010" stopOpacity={1} />
          <Stop offset="1" stopColor="#4A6B30" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={bellyG} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#D0C890" stopOpacity={0.2} />
          <Stop offset="0.3" stopColor="#A09870" stopOpacity={0} />
          <Stop offset="1" stopColor="#D0C890" stopOpacity={0} />
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
        stroke="#0A1505"
        strokeWidth={6}
        opacity={0.18}
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
      {/* Belly tint */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${bellyG})`}
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
        stroke="#2A4518"
        strokeWidth={0.6}
        opacity={0.35}
      />
      {/* Diamond scale pattern — top edge */}
      <G opacity={0.35} fill="none" stroke="#4A6B30" strokeWidth={0.5}>
        <Path d="M15,0 L18,-2 L21,0 L18,2 Z" />
        <Path d="M28,0 L31,-2 L34,0 L31,2 Z" />
        <Path d="M41,0 L44,-2 L47,0 L44,2 Z" />
        <Path d="M54,0 L57,-2 L60,0 L57,2 Z" />
        <Path d="M67,0 L70,-2 L73,0 L70,2 Z" />
        <Path d="M80,0 L83,-2 L86,0 L83,2 Z" />
      </G>
      {/* Diamond scale pattern — bottom edge */}
      <G opacity={0.35} fill="none" stroke="#4A6B30" strokeWidth={0.5}>
        <Path d="M15,100 L18,98 L21,100 L18,102 Z" />
        <Path d="M28,100 L31,98 L34,100 L31,102 Z" />
        <Path d="M41,100 L44,98 L47,100 L44,102 Z" />
        <Path d="M54,100 L57,98 L60,100 L57,102 Z" />
        <Path d="M67,100 L70,98 L73,100 L70,102 Z" />
        <Path d="M80,100 L83,98 L86,100 L83,102 Z" />
      </G>
      {/* S-coil at top-left corner */}
      <Path
        d="M-4,10 Q-6,4 -2,0 Q2,-3 6,-1 Q10,2 8,6 Q6,10 2,8"
        fill="none"
        stroke="#5A7B40"
        strokeWidth={1.5}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* S-coil at top-right corner */}
      <Path
        d="M104,10 Q106,4 102,0 Q98,-3 94,-1 Q90,2 92,6 Q94,10 98,8"
        fill="none"
        stroke="#5A7B40"
        strokeWidth={1.5}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* S-coil at bottom-left */}
      <Path
        d="M-4,90 Q-6,96 -2,100 Q2,103 6,101 Q10,98 8,94 Q6,90 2,92"
        fill="none"
        stroke="#5A7B40"
        strokeWidth={1.5}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* S-coil at bottom-right */}
      <Path
        d="M104,90 Q106,96 102,100 Q98,103 94,101 Q90,98 92,94 Q94,90 98,92"
        fill="none"
        stroke="#5A7B40"
        strokeWidth={1.5}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Snake head — top-left (facing left) */}
      <G opacity={0.6}>
        <Path d="M-5,10 L-8,8 L-5,6 Z" fill="#4A6B30" />
        {/* Forked tongue */}
        <Path d="M-8,8 L-11,7 M-8,8 L-11,9" stroke="#CC3333" strokeWidth={0.4} />
        {/* Eye */}
        <Circle cx={-5} cy={8.5} r={0.6} fill="#FFD700" />
      </G>
      {/* Snake head — bottom-right (facing right) */}
      <G opacity={0.6}>
        <Path d="M105,90 L108,92 L105,94 Z" fill="#4A6B30" />
        <Path d="M108,92 L111,91 M108,92 L111,93" stroke="#CC3333" strokeWidth={0.4} />
        <Circle cx={105} cy={91.5} r={0.6} fill="#FFD700" />
      </G>
      {/* Belly stripe highlights */}
      <G opacity={0.2} fill="none" stroke="#D0C890" strokeWidth={0.4}>
        <Path d="M-2,4 L-1,6 L0,4" />
        <Path d="M100,94 L101,96 L102,94" />
        <Path d="M94,0 L96,-1 L98,0" />
        <Path d="M6,100 L4,101 L2,100" />
      </G>
    </Svg>
  );
});
ViperCoilFrame.displayName = 'ViperCoilFrame';
