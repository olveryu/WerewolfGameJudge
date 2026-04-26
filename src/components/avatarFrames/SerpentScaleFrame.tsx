import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * SerpentScaleFrame — 蛇鳞
 *
 * 连续蛇身从左下角起步缠绕一周（不断变粗→变细）。
 * 蛇头 = 右上角(三角头 + 竖瞳 RadialGradient + 分叉舌)。
 * 蛇尾 = 左下角(渐细尖尾)。沿蛇身画鳞片弧(半圆叠瓦)。
 * 与 WraithBone 完全不同: 无 bone joint, 无 skull, 采用连续蛇体缠绕+鳞片纹。
 */
export const SerpentScaleFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `ssM${userId}`;
  const bellyG = `ssBl${userId}`;
  const eyeR = `ssEy${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4A8A4A" stopOpacity={0.9} />
          <Stop offset="0.35" stopColor="#2A5A2A" stopOpacity={1} />
          <Stop offset="0.65" stopColor="#1A3A1A" stopOpacity={1} />
          <Stop offset="1" stopColor="#4A8A4A" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={bellyG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6AAA6A" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#2A5A2A" stopOpacity={0} />
        </LinearGradient>
        {/* Snake eye glow */}
        <RadialGradient id={eyeR} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#CCFF00" stopOpacity={0.9} />
          <Stop offset="0.5" stopColor="#00FF44" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#004400" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Shadow */}
      <Rect
        x={1}
        y={1}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke="#0A1A0A"
        strokeWidth={6}
        opacity={0.18}
      />
      {/* Main frame */}
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
        x={6}
        y={6}
        width={88}
        height={88}
        rx={Math.max(rx - 5, 0)}
        fill="none"
        stroke="#2A5A2A"
        strokeWidth={0.7}
        opacity={0.4}
      />

      {/* ── Continuous serpent body — starts as tail (bottom-left), wraps CW to head (top-right) ── */}
      {/* Tail — bottom-left corner, thin tapering */}
      <Path
        d="M-6,104 C-2,100 2,105 8,100"
        fill="none"
        stroke="#3A6A3A"
        strokeWidth={0.8}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Bottom edge — body thickens */}
      <Path
        d="M8,100 C20,108 28,96 40,103 C52,110 60,96 72,104 C82,110 92,98 104,103"
        fill="none"
        stroke="#3A6A3A"
        strokeWidth={2}
        opacity={0.55}
        strokeLinecap="round"
      />
      {/* Right edge — climbing */}
      <Path
        d="M104,103 C110,90 96,80 105,68 C112,56 98,46 106,35 C112,25 100,15 104,2"
        fill="none"
        stroke="#3A6A3A"
        strokeWidth={2.2}
        opacity={0.5}
        strokeLinecap="round"
      />
      {/* Head approach — top-right */}
      <Path
        d="M104,2 C100,-2 96,0 92,-3"
        fill="none"
        stroke="#3A6A3A"
        strokeWidth={2.5}
        opacity={0.55}
        strokeLinecap="round"
      />

      {/* ── Snake head — triangular, top-right area ── */}
      <G opacity={0.6}>
        <Path
          d="M92,-3 L84,-7 L80,-2 L84,1 L92,-3 Z"
          fill="#2A5A2A"
          stroke="#4A8A4A"
          strokeWidth={0.5}
        />
        {/* Eye */}
        <Circle cx={87} cy={-3} r={2} fill={`url(#${eyeR})`} />
        {/* Vertical slit pupil */}
        <Path d="M87,-4.5 Q87.5,-3 87,-1.5" fill="none" stroke="#001A00" strokeWidth={0.5} />
        {/* Forked tongue */}
        <Path
          d="M80,-2 L76,-1 L74,-3 M76,-1 L74,1"
          fill="none"
          stroke="#CC3333"
          strokeWidth={0.4}
          strokeLinecap="round"
        />
      </G>

      {/* ── Scales along body (imbricated arc pattern) ── */}
      {/* Bottom body scales */}
      <G opacity={0.3} fill="none" stroke="#5AAA5A" strokeWidth={0.5}>
        <Path d="M15,101 Q20,105 25,101" />
        <Path d="M25,102 Q30,106 35,102" />
        <Path d="M38,101 Q43,105 48,101" />
        <Path d="M50,103 Q55,107 60,103" />
        <Path d="M62,102 Q67,106 72,102" />
        <Path d="M75,103 Q80,107 85,103" />
        <Path d="M88,102 Q93,106 98,102" />
      </G>
      {/* Right body scales */}
      <G opacity={0.25} fill="none" stroke="#5AAA5A" strokeWidth={0.5}>
        <Path d="M103,90 Q107,85 103,80" />
        <Path d="M104,75 Q108,70 104,65" />
        <Path d="M105,60 Q109,55 105,50" />
        <Path d="M104,44 Q108,39 104,34" />
        <Path d="M105,28 Q109,23 105,18" />
        <Path d="M104,12 Q108,7 104,2" />
      </G>

      {/* ── Secondary coil hint on top edge (body passed earlier) ── */}
      <Path
        d="M-4,-1 C10,-6 20,0 30,-3 C40,-7 50,0 60,-2 C70,-5 78,0 82,-2"
        fill="none"
        stroke="#2A5A2A"
        strokeWidth={1}
        opacity={0.25}
        strokeLinecap="round"
      />

      {/* ── Left edge — faint body trace (earlier loop) ── */}
      <Path
        d="M-3,10 C-6,22 0,32 -2,42 C-5,52 0,62 -2,72 C-4,82 0,90 -4,96"
        fill="none"
        stroke="#2A5A2A"
        strokeWidth={0.8}
        opacity={0.2}
        strokeLinecap="round"
      />

      {/* ── Belly detail lines on thickest segments ── */}
      <G opacity={0.15} stroke="#6AAA6A" strokeWidth={0.3}>
        <Path d="M40,102 L40,105" />
        <Path d="M60,101 L60,104" />
        <Path d="M104,68 L107,68" />
        <Path d="M104,45 L107,45" />
      </G>
    </Svg>
  );
});
SerpentScaleFrame.displayName = 'SerpentScaleFrame';
