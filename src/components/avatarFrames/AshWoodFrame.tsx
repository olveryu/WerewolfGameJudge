import { memo, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import type { FrameProps } from './FrameProps';

/**
 * AshWoodFrame — 灰木
 *
 * 断裂木板拼合边框。每边 = 2-3 段不连续的厚木条(Rect+Path)，段间留缝隙。
 * 木板上有木纹线条、树节(knothole = 椭圆+年轮)、树皮边缘(bark strip = 不规则 Path)。
 * 角部 = 碳化焦痕(char mark RadialGradient) + 余烬微光。
 * 与 SandStone 完全不同: 无 crack line 网, 无 sand particle, 采用 plank 段+knothole。
 */
export const AshWoodFrame = memo<FrameProps>(({ size, rx }) => {
  const userId = useId();
  const mainG = `awM${userId}`;
  const barkG = `awBk${userId}`;
  const charR = `awCh${userId}`;
  return (
    <Svg width={size} height={size} viewBox="-8 -8 116 116">
      <Defs>
        <LinearGradient id={mainG} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4A4040" stopOpacity={0.9} />
          <Stop offset="0.4" stopColor="#2A2424" stopOpacity={1} />
          <Stop offset="0.7" stopColor="#1A1515" stopOpacity={1} />
          <Stop offset="1" stopColor="#4A4040" stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={barkG} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5A4A3A" stopOpacity={0.3} />
          <Stop offset="0.5" stopColor="#3A2A1A" stopOpacity={0} />
          <Stop offset="1" stopColor="#5A4A3A" stopOpacity={0.3} />
        </LinearGradient>
        {/* Char burn at corners */}
        <RadialGradient id={charR} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FF4400" stopOpacity={0.2} />
          <Stop offset="0.5" stopColor="#331100" stopOpacity={0.1} />
          <Stop offset="1" stopColor="#1A1515" stopOpacity={0} />
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
        stroke="#080505"
        strokeWidth={6}
        opacity={0.22}
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
        strokeWidth={5.5}
      />
      {/* Bark texture overlay */}
      <Rect
        x={0}
        y={0}
        width={100}
        height={100}
        rx={rx}
        fill="none"
        stroke={`url(#${barkG})`}
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
        stroke="#2A2424"
        strokeWidth={0.7}
        opacity={0.35}
      />

      {/* ── Corner char burns — RadialGradient circles ── */}
      <Circle cx={0} cy={0} r={12} fill={`url(#${charR})`} />
      <Circle cx={100} cy={0} r={10} fill={`url(#${charR})`} />
      <Circle cx={0} cy={100} r={11} fill={`url(#${charR})`} />
      <Circle cx={100} cy={100} r={13} fill={`url(#${charR})`} />

      {/* ── Top plank segments — 3 disconnected pieces ── */}
      <G opacity={0.5}>
        {/* Plank 1 */}
        <Path
          d="M8,-4 L35,-4 L36,-3 L35,-1 L8,-1 L7,-2.5 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        {/* Plank 2 (gap at 35-40) */}
        <Path
          d="M40,-4 L65,-4.5 L66,-3 L65,-1 L40,-1 L39,-2.5 Z"
          fill="#332828"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        {/* Plank 3 */}
        <Path
          d="M70,-4 L92,-3.5 L93,-2 L92,-1 L70,-1.5 L69,-3 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
      </G>

      {/* ── Bottom plank segments — 2 pieces ── */}
      <G opacity={0.5}>
        <Path
          d="M10,101 L48,101.5 L49,103 L48,105 L10,104.5 L9,103 Z"
          fill="#332828"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        <Path
          d="M55,101 L90,101.5 L91,103 L90,105 L55,104 L54,102.5 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
      </G>

      {/* ── Left plank segments — 2 pieces ── */}
      <G opacity={0.45}>
        <Path
          d="M-4,10 L-4,45 L-2.5,46 L-1,45 L-1,10 L-2.5,9 Z"
          fill="#332828"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        <Path
          d="M-4,52 L-4,88 L-2.5,89 L-1,88 L-1,52 L-2.5,51 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
      </G>

      {/* ── Right plank segments — 3 pieces ── */}
      <G opacity={0.45}>
        <Path
          d="M101,8 L101,35 L103,36 L105,35 L105,8 L103,7 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        <Path
          d="M101,42 L101,68 L103,69 L105,68 L105,42 L103,41 Z"
          fill="#332828"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
        <Path
          d="M101,75 L101,92 L103,93 L105,92 L105,75 L103,74 Z"
          fill="#3A3030"
          stroke="#4A4040"
          strokeWidth={0.3}
        />
      </G>

      {/* ── Wood grain lines on planks ── */}
      <G opacity={0.2} fill="none" stroke="#5A5050" strokeWidth={0.3} strokeLinecap="round">
        {/* Top planks */}
        <Line x1={12} y1={-3} x2={15} y2={-1.5} />
        <Line x1={20} y1={-3.5} x2={24} y2={-1.5} />
        <Line x1={45} y1={-3} x2={48} y2={-1.5} />
        <Line x1={55} y1={-4} x2={58} y2={-1.5} />
        <Line x1={75} y1={-3} x2={78} y2={-1.5} />
        <Line x1={85} y1={-3.5} x2={88} y2={-2} />
        {/* Left planks */}
        <Line x1={-3.5} y1={18} x2={-1.5} y2={20} />
        <Line x1={-3} y1={32} x2={-1.5} y2={34} />
        <Line x1={-3.5} y1={60} x2={-1.5} y2={62} />
        <Line x1={-3} y1={78} x2={-1.5} y2={80} />
      </G>

      {/* ── Knotholes — elliptical rings ── */}
      <G opacity={0.4}>
        {/* Knothole on top plank 2 */}
        <Circle cx={52} cy={-2.5} r={1.8} fill="#1A1515" />
        <Circle cx={52} cy={-2.5} r={1.8} fill="none" stroke="#3A3030" strokeWidth={0.3} />
        <Circle cx={52} cy={-2.5} r={1} fill="none" stroke="#2A2424" strokeWidth={0.2} />
        {/* Knothole on left plank */}
        <Circle cx={-2.5} cy={40} r={1.5} fill="#1A1515" />
        <Circle cx={-2.5} cy={40} r={1.5} fill="none" stroke="#3A3030" strokeWidth={0.3} />
        <Circle cx={-2.5} cy={40} r={0.8} fill="none" stroke="#2A2424" strokeWidth={0.2} />
        {/* Knothole on right plank */}
        <Circle cx={103} cy={58} r={1.3} fill="#1A1515" />
        <Circle cx={103} cy={58} r={1.3} fill="none" stroke="#3A3030" strokeWidth={0.3} />
      </G>

      {/* ── Bark strips — irregular edge paths along planks ── */}
      <G opacity={0.2} fill="none" stroke="#5A4A3A" strokeWidth={0.4}>
        <Path d="M8,-4.5 C12,-5 16,-4.5 20,-5.5 C24,-5 28,-5.5 32,-4.5 L35,-4.5" />
        <Path d="M55,104.5 C60,105.5 65,104.5 70,105.5 C75,105 80,105.5 85,104.5 L90,105" />
      </G>

      {/* ── Ember glow in gaps between planks ── */}
      <G opacity={0.35}>
        <Circle cx={37.5} cy={-2.5} r={0.6} fill="#FF4400" />
        <Circle cx={67.5} cy={-2.5} r={0.5} fill="#FF6600" />
        <Circle cx={-2.5} cy={48.5} r={0.4} fill="#FF4400" />
        <Circle cx={103} cy={38.5} r={0.5} fill="#FF4400" />
        <Circle cx={103} cy={71.5} r={0.4} fill="#FF6600" />
        <Circle cx={51.5} cy={103} r={0.5} fill="#FF4400" />
      </G>
    </Svg>
  );
});
AshWoodFrame.displayName = 'AshWoodFrame';
