/**
 * Avatar Frame SVG Components — 圆角矩形头像框
 *
 * 10 款暗黑奇幻风格圆角矩形头像装饰框，用 react-native-svg 矢量绘制。
 * viewBox="0 0 100 100"，圆形头像居中 (50,50) 直径 72，
 * 外围 14 units 装饰空间用于方框角饰/边饰。
 * 不引入 React hooks、service、theme（颜色固定，确保跨主题一致的装饰效果）。
 */
import { memo } from 'react';
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

export interface FrameProps {
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 铁锻 (Iron Forge) — 粗犷铸铁方框，四角铆钉，锤痕质感
// ═══════════════════════════════════════════════════════════════════════════════

export const IronForgeFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="ironGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#8B7355" stopOpacity={0.95} />
        <Stop offset="0.5" stopColor="#5A4A38" stopOpacity={1} />
        <Stop offset="1" stopColor="#3A3028" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Outer thick border */}
    <Rect
      x={3}
      y={3}
      width={94}
      height={94}
      rx={18}
      fill="none"
      stroke="url(#ironGrad)"
      strokeWidth={4}
    />
    {/* Inner thin border */}
    <Rect
      x={9}
      y={9}
      width={82}
      height={82}
      rx={14}
      fill="none"
      stroke="#5A4A38"
      strokeWidth={1.5}
      opacity={0.7}
    />
    {/* Corner L-brackets */}
    <Path
      d="M3,18 L3,3 L18,3"
      fill="none"
      stroke="#A08A68"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <Path
      d="M82,3 L97,3 L97,18"
      fill="none"
      stroke="#A08A68"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <Path
      d="M3,82 L3,97 L18,97"
      fill="none"
      stroke="#A08A68"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <Path
      d="M82,97 L97,97 L97,82"
      fill="none"
      stroke="#A08A68"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    {/* 4 large corner rivets */}
    <Circle cx={8} cy={8} r={3} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
    <Circle cx={92} cy={8} r={3} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
    <Circle cx={8} cy={92} r={3} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
    <Circle cx={92} cy={92} r={3} fill="#8B7355" stroke="#2A2520" strokeWidth={1} />
    {/* Rivet highlights */}
    <Circle cx={7} cy={7} r={1} fill="#B8A080" opacity={0.6} />
    <Circle cx={91} cy={7} r={1} fill="#B8A080" opacity={0.6} />
    <Circle cx={7} cy={91} r={1} fill="#B8A080" opacity={0.6} />
    <Circle cx={91} cy={91} r={1} fill="#B8A080" opacity={0.6} />
    {/* Edge mid-rivets */}
    <Circle cx={50} cy={4} r={1.8} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
    <Circle cx={50} cy={96} r={1.8} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
    <Circle cx={4} cy={50} r={1.8} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
    <Circle cx={96} cy={50} r={1.8} fill="#6B5A42" stroke="#2A2520" strokeWidth={0.6} />
  </Svg>
));
IronForgeFrame.displayName = 'IronForgeFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 月银 (Moon Silver) — 银白精致细框，四角新月弧饰
// ═══════════════════════════════════════════════════════════════════════════════

export const MoonSilverFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="moonGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#F0F2FF" stopOpacity={1} />
        <Stop offset="0.5" stopColor="#C0C8E0" stopOpacity={1} />
        <Stop offset="1" stopColor="#8090B8" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Main frame — thicker stroke */}
    <Rect
      x={5}
      y={5}
      width={90}
      height={90}
      rx={18}
      fill="none"
      stroke="url(#moonGrad)"
      strokeWidth={3.5}
    />
    {/* Inner accent line */}
    <Rect
      x={11}
      y={11}
      width={78}
      height={78}
      rx={14}
      fill="none"
      stroke="#B0B8D0"
      strokeWidth={1.2}
      opacity={0.7}
    />
    {/* Corner crescents — enlarged and brighter */}
    <Path
      d="M5,22 A14,14 0 0,1 22,5"
      fill="none"
      stroke="#F0F2FF"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <Path
      d="M9,19 A10,10 0 0,1 19,9"
      fill="none"
      stroke="#C8D0E8"
      strokeWidth={1.5}
      opacity={0.7}
    />
    <Path
      d="M78,5 A14,14 0 0,1 95,22"
      fill="none"
      stroke="#F0F2FF"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <Path
      d="M81,9 A10,10 0 0,1 91,19"
      fill="none"
      stroke="#C8D0E8"
      strokeWidth={1.5}
      opacity={0.7}
    />
    <Path
      d="M22,95 A14,14 0 0,1 5,78"
      fill="none"
      stroke="#F0F2FF"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <Path
      d="M19,91 A10,10 0 0,1 9,81"
      fill="none"
      stroke="#C8D0E8"
      strokeWidth={1.5}
      opacity={0.7}
    />
    <Path
      d="M95,78 A14,14 0 0,1 78,95"
      fill="none"
      stroke="#F0F2FF"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <Path
      d="M91,81 A10,10 0 0,1 81,91"
      fill="none"
      stroke="#C8D0E8"
      strokeWidth={1.5}
      opacity={0.7}
    />
    {/* Edge diamonds — larger */}
    <Path d="M50,2 L53,5 L50,8 L47,5 Z" fill="#D8DCF0" opacity={1} />
    <Path d="M50,92 L53,95 L50,98 L47,95 Z" fill="#D8DCF0" opacity={1} />
    <Path d="M2,50 L5,47 L8,50 L5,53 Z" fill="#D8DCF0" opacity={1} />
    <Path d="M92,50 L95,47 L98,50 L95,53 Z" fill="#D8DCF0" opacity={1} />
    {/* Stars at mid-edges — larger */}
    <Circle cx={30} cy={5} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={70} cy={5} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={30} cy={95} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={70} cy={95} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={5} cy={30} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={5} cy={70} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={95} cy={30} r={1.5} fill="#E8EAF8" opacity={0.8} />
    <Circle cx={95} cy={70} r={1.5} fill="#E8EAF8" opacity={0.8} />
  </Svg>
));
MoonSilverFrame.displayName = 'MoonSilverFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 血棘 (Blood Thorn) — 暗红荆棘缠绕方框，刺突四角
// ═══════════════════════════════════════════════════════════════════════════════

export const BloodThornFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="thornGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#CC3333" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#6B1010" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Base frame */}
    <Rect
      x={6}
      y={6}
      width={88}
      height={88}
      rx={18}
      fill="none"
      stroke="url(#thornGrad)"
      strokeWidth={3}
    />
    {/* Top thorns */}
    <Path d="M20,6 L23,0 L26,6" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M38,6 L41,1 L44,6" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M56,6 L59,1 L62,6" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M74,6 L77,0 L80,6" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    {/* Bottom thorns */}
    <Path d="M20,94 L23,100 L26,94" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M38,94 L41,99 L44,94" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M56,94 L59,99 L62,94" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M74,94 L77,100 L80,94" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    {/* Left thorns */}
    <Path d="M6,20 L0,23 L6,26" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M6,38 L1,41 L6,44" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M6,56 L1,59 L6,62" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M6,74 L0,77 L6,80" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    {/* Right thorns */}
    <Path d="M94,20 L100,23 L94,26" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M94,38 L99,41 L94,44" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M94,56 L99,59 L94,62" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    <Path d="M94,74 L100,77 L94,80" fill="#8B1A1A" stroke="#CC3333" strokeWidth={0.8} />
    {/* Large corner thorns */}
    <Path d="M6,6 L-2,-2 L6,2 Z" fill="#CC3333" opacity={0.8} />
    <Path d="M94,6 L102,-2 L94,2 Z" fill="#CC3333" opacity={0.8} />
    <Path d="M6,94 L-2,102 L6,98 Z" fill="#CC3333" opacity={0.8} />
    <Path d="M94,94 L102,102 L94,98 Z" fill="#CC3333" opacity={0.8} />
    {/* Blood drip accents */}
    <Path
      d="M50,6 Q50,3 50,1"
      fill="none"
      stroke="#FF4444"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
    <Path
      d="M50,94 Q50,97 50,99"
      fill="none"
      stroke="#FF4444"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
  </Svg>
));
BloodThornFrame.displayName = 'BloodThornFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 符印 (Runic Seal) — 紫蓝神秘符文标记在四边
// ═══════════════════════════════════════════════════════════════════════════════

export const RunicSealFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="runicGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#7B5FBF" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#4B3F8F" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Main frame */}
    <Rect
      x={5}
      y={5}
      width={90}
      height={90}
      rx={18}
      fill="none"
      stroke="url(#runicGrad)"
      strokeWidth={2.5}
    />
    {/* Inner frame */}
    <Rect
      x={10}
      y={10}
      width={80}
      height={80}
      rx={14}
      fill="none"
      stroke="#5B4FA0"
      strokeWidth={0.8}
      opacity={0.4}
    />
    {/* Top rune marks */}
    <G opacity={0.7}>
      <Line x1={25} y1={3} x2={25} y2={8} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={23} y1={5.5} x2={27} y2={5.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
      <Line x1={50} y1={3} x2={50} y2={8} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={48} y1={5.5} x2={52} y2={5.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
      <Line x1={75} y1={3} x2={75} y2={8} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={73} y1={5.5} x2={77} y2={5.5} stroke="#9B8BFF" strokeWidth={1} opacity={0.7} />
    </G>
    {/* Bottom rune marks */}
    <G opacity={0.7}>
      <Line x1={25} y1={92} x2={25} y2={97} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={50} y1={92} x2={50} y2={97} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={75} y1={92} x2={75} y2={97} stroke="#9B8BFF" strokeWidth={1.5} />
    </G>
    {/* Left rune marks */}
    <G opacity={0.7}>
      <Line x1={3} y1={25} x2={8} y2={25} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={3} y1={50} x2={8} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={3} y1={75} x2={8} y2={75} stroke="#9B8BFF" strokeWidth={1.5} />
    </G>
    {/* Right rune marks */}
    <G opacity={0.7}>
      <Line x1={92} y1={25} x2={97} y2={25} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={92} y1={50} x2={97} y2={50} stroke="#9B8BFF" strokeWidth={1.5} />
      <Line x1={92} y1={75} x2={97} y2={75} stroke="#9B8BFF" strokeWidth={1.5} />
    </G>
    {/* Corner glyphs — diamond shapes */}
    <Path d="M5,5 L8,2 L11,5 L8,8 Z" fill="#A78BFA" opacity={0.85} />
    <Path d="M89,5 L92,2 L95,5 L92,8 Z" fill="#A78BFA" opacity={0.85} />
    <Path d="M5,95 L8,92 L11,95 L8,98 Z" fill="#A78BFA" opacity={0.85} />
    <Path d="M89,95 L92,92 L95,95 L92,98 Z" fill="#A78BFA" opacity={0.85} />
    {/* Glow dots */}
    <Circle cx={5} cy={5} r={1.5} fill="#BBA0FF" opacity={0.4} />
    <Circle cx={95} cy={5} r={1.5} fill="#BBA0FF" opacity={0.4} />
    <Circle cx={5} cy={95} r={1.5} fill="#BBA0FF" opacity={0.4} />
    <Circle cx={95} cy={95} r={1.5} fill="#BBA0FF" opacity={0.4} />
  </Svg>
));
RunicSealFrame.displayName = 'RunicSealFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 骨门 (Bone Gate) — 白骨交叉构成的边框，四角骨饰
// ═══════════════════════════════════════════════════════════════════════════════

export const BoneGateFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="boneGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#E0D8C8" stopOpacity={0.95} />
        <Stop offset="1" stopColor="#A89880" stopOpacity={0.9} />
      </LinearGradient>
    </Defs>
    {/* Outer bone border */}
    <Rect
      x={4}
      y={4}
      width={92}
      height={92}
      rx={18}
      fill="none"
      stroke="url(#boneGrad)"
      strokeWidth={3}
    />
    {/* Inner bone border */}
    <Rect
      x={9}
      y={9}
      width={82}
      height={82}
      rx={14}
      fill="none"
      stroke="#B8A890"
      strokeWidth={1.5}
      opacity={0.6}
    />
    {/* Cross bones — top-left */}
    <Line x1={1} y1={1} x2={16} y2={16} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={16} y1={1} x2={1} y2={16} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    {/* Cross bones — top-right */}
    <Line x1={84} y1={1} x2={99} y2={16} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={99} y1={1} x2={84} y2={16} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    {/* Cross bones — bottom-left */}
    <Line x1={1} y1={84} x2={16} y2={99} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    <Line x1={16} y1={84} x2={1} y2={99} stroke="#D8D0C0" strokeWidth={2.5} strokeLinecap="round" />
    {/* Cross bones — bottom-right */}
    <Line
      x1={84}
      y1={84}
      x2={99}
      y2={99}
      stroke="#D8D0C0"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    <Line
      x1={99}
      y1={84}
      x2={84}
      y2={99}
      stroke="#D8D0C0"
      strokeWidth={2.5}
      strokeLinecap="round"
    />
    {/* Bone joint knobs */}
    <Circle cx={1} cy={1} r={2} fill="#E0D8C8" />
    <Circle cx={16} cy={1} r={2} fill="#E0D8C8" />
    <Circle cx={1} cy={16} r={2} fill="#E0D8C8" />
    <Circle cx={16} cy={16} r={2} fill="#E0D8C8" />
    <Circle cx={84} cy={1} r={2} fill="#E0D8C8" />
    <Circle cx={99} cy={1} r={2} fill="#E0D8C8" />
    <Circle cx={84} cy={16} r={2} fill="#E0D8C8" />
    <Circle cx={99} cy={16} r={2} fill="#E0D8C8" />
    <Circle cx={1} cy={84} r={2} fill="#E0D8C8" />
    <Circle cx={16} cy={84} r={2} fill="#E0D8C8" />
    <Circle cx={1} cy={99} r={2} fill="#E0D8C8" />
    <Circle cx={16} cy={99} r={2} fill="#E0D8C8" />
    <Circle cx={84} cy={84} r={2} fill="#E0D8C8" />
    <Circle cx={99} cy={84} r={2} fill="#E0D8C8" />
    <Circle cx={84} cy={99} r={2} fill="#E0D8C8" />
    <Circle cx={99} cy={99} r={2} fill="#E0D8C8" />
    {/* Mini skull at top center */}
    <Circle cx={50} cy={4} r={3} fill="#D8D0C0" stroke="#3A3530" strokeWidth={0.6} />
    <Circle cx={48.5} cy={3.2} r={0.7} fill="#3A3530" />
    <Circle cx={51.5} cy={3.2} r={0.7} fill="#3A3530" />
    <Path d="M49,5.5 L50,6.5 L51,5.5" fill="none" stroke="#3A3530" strokeWidth={0.5} />
  </Svg>
));
BoneGateFrame.displayName = 'BoneGateFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 6. 狱焰 (Hell Fire) — 橙红火焰从框底升起
// ═══════════════════════════════════════════════════════════════════════════════

export const HellFireFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="hfireGrad" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#FF6B20" stopOpacity={0.95} />
        <Stop offset="0.3" stopColor="#CC2200" stopOpacity={0.9} />
        <Stop offset="0.6" stopColor="#4A1800" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#4A1800" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Single frame with fire gradient (bottom→top) */}
    <Rect
      x={5}
      y={5}
      width={90}
      height={90}
      rx={18}
      fill="none"
      stroke="url(#hfireGrad)"
      strokeWidth={2.5}
    />
    {/* Bottom flame tongues */}
    <Path d="M15,95 Q12,85 18,80 Q14,88 20,95" fill="#FF6B20" opacity={0.8} />
    <Path d="M30,95 Q26,82 33,76 Q28,84 35,95" fill="#CC2200" opacity={0.85} />
    <Path d="M45,95 Q42,80 50,72 Q46,82 52,95" fill="#FF8830" opacity={0.9} />
    <Path d="M60,95 Q56,78 63,73 Q58,82 65,95" fill="#FF6B20" opacity={0.85} />
    <Path d="M75,95 Q72,84 78,78 Q74,86 80,95" fill="#CC2200" opacity={0.8} />
    <Path d="M88,95 Q85,87 90,82 Q87,89 92,95" fill="#FF6B20" opacity={0.7} />
    {/* Side flame wisps */}
    <Path d="M5,80 Q0,74 5,68" fill="none" stroke="#FF6B20" strokeWidth={1.5} opacity={0.6} />
    <Path d="M95,80 Q100,74 95,68" fill="none" stroke="#FF6B20" strokeWidth={1.5} opacity={0.6} />
    {/* Ember particles */}
    <Circle cx={20} cy={88} r={1} fill="#FFB020" opacity={0.7} />
    <Circle cx={40} cy={82} r={0.8} fill="#FFCC40" opacity={0.6} />
    <Circle cx={65} cy={85} r={1} fill="#FFB020" opacity={0.7} />
    <Circle cx={85} cy={90} r={0.7} fill="#FFCC40" opacity={0.5} />
    <Circle cx={50} cy={78} r={0.8} fill="#FF8830" opacity={0.6} />
    {/* Top edge accent */}
    <Line x1={20} y1={5} x2={80} y2={5} stroke="#CC2200" strokeWidth={1} opacity={0.4} />
  </Svg>
));
HellFireFrame.displayName = 'HellFireFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 7. 暗藤 (Dark Vine) — 深绿藤蔓攀附方框，叶片点缀
// ═══════════════════════════════════════════════════════════════════════════════

export const DarkVineFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="vineGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#1A5A2A" stopOpacity={0.95} />
        <Stop offset="1" stopColor="#0A3018" stopOpacity={0.9} />
      </LinearGradient>
    </Defs>
    {/* Base frame */}
    <Rect
      x={5}
      y={5}
      width={90}
      height={90}
      rx={18}
      fill="none"
      stroke="url(#vineGrad)"
      strokeWidth={2.5}
    />
    {/* Vine along top */}
    <Path
      d="M15,5 C20,0 30,10 40,5 C50,0 60,10 70,5 C80,0 88,8 90,5"
      fill="none"
      stroke="#2D8B4A"
      strokeWidth={1.8}
      opacity={0.7}
    />
    {/* Vine along bottom */}
    <Path
      d="M10,95 C20,100 30,90 40,95 C50,100 60,90 70,95 C80,100 90,92 95,95"
      fill="none"
      stroke="#2D8B4A"
      strokeWidth={1.8}
      opacity={0.7}
    />
    {/* Vine along left */}
    <Path
      d="M5,15 C0,25 10,35 5,45 C0,55 10,65 5,75 C0,82 8,88 5,90"
      fill="none"
      stroke="#2D8B4A"
      strokeWidth={1.8}
      opacity={0.7}
    />
    {/* Vine along right */}
    <Path
      d="M95,10 C100,20 90,30 95,40 C100,50 90,60 95,70 C100,78 92,85 95,90"
      fill="none"
      stroke="#2D8B4A"
      strokeWidth={1.8}
      opacity={0.7}
    />
    {/* Leaves at corners */}
    <Path d="M8,8 Q3,3 8,3 Q13,3 8,8 Z" fill="#34D399" opacity={0.7} />
    <Path d="M12,5 Q10,1 14,3 Z" fill="#2AAA70" opacity={0.5} />
    <Path d="M92,8 Q97,3 92,3 Q87,3 92,8 Z" fill="#34D399" opacity={0.7} />
    <Path d="M88,5 Q90,1 86,3 Z" fill="#2AAA70" opacity={0.5} />
    <Path d="M8,92 Q3,97 8,97 Q13,97 8,92 Z" fill="#34D399" opacity={0.7} />
    <Path d="M92,92 Q97,97 92,97 Q87,97 92,92 Z" fill="#34D399" opacity={0.7} />
    {/* Berries */}
    <Circle cx={25} cy={4} r={1.5} fill="#8B1A1A" opacity={0.7} />
    <Circle cx={55} cy={96} r={1.5} fill="#8B1A1A" opacity={0.7} />
    <Circle cx={4} cy={40} r={1.5} fill="#8B1A1A" opacity={0.7} />
    <Circle cx={96} cy={60} r={1.5} fill="#8B1A1A" opacity={0.7} />
  </Svg>
));
DarkVineFrame.displayName = 'DarkVineFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 8. 霜晶 (Frost Crystal) — 冰蓝结晶棱角框，切角八边形
// ═══════════════════════════════════════════════════════════════════════════════

export const FrostCrystalFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="frostGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#A0D8F0" stopOpacity={0.9} />
        <Stop offset="0.5" stopColor="#5090C0" stopOpacity={0.95} />
        <Stop offset="1" stopColor="#203850" stopOpacity={0.85} />
      </LinearGradient>
    </Defs>
    {/* Rounded frame */}
    <Rect
      x={2}
      y={2}
      width={96}
      height={96}
      rx={18}
      fill="none"
      stroke="url(#frostGrad)"
      strokeWidth={2.5}
    />
    {/* Inner rounded line */}
    <Rect
      x={8}
      y={8}
      width={84}
      height={84}
      rx={14}
      fill="none"
      stroke="#5090C0"
      strokeWidth={1}
      opacity={0.4}
    />
    {/* Crystal spikes at corners */}
    <Path d="M16,2 L9,-3 L2,2 L9,9 Z" fill="#A0D8F0" opacity={0.5} />
    <Path d="M84,2 L91,-3 L98,2 L91,9 Z" fill="#A0D8F0" opacity={0.5} />
    <Path d="M2,84 L-3,91 L2,98 L9,91 Z" fill="#A0D8F0" opacity={0.5} />
    <Path d="M98,84 L103,91 L98,98 L91,91 Z" fill="#A0D8F0" opacity={0.5} />
    {/* Frost lines */}
    <Line x1={30} y1={2} x2={28} y2={-1} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    <Line x1={50} y1={2} x2={50} y2={-1} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    <Line x1={70} y1={2} x2={72} y2={-1} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    <Line x1={30} y1={98} x2={28} y2={101} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    <Line x1={50} y1={98} x2={50} y2={101} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    <Line x1={70} y1={98} x2={72} y2={101} stroke="#A0D8F0" strokeWidth={0.8} opacity={0.5} />
    {/* Ice dots */}
    <Circle cx={50} cy={2} r={1.2} fill="#C8E8FF" opacity={0.7} />
    <Circle cx={50} cy={98} r={1.2} fill="#C8E8FF" opacity={0.7} />
    <Circle cx={2} cy={50} r={1.2} fill="#C8E8FF" opacity={0.7} />
    <Circle cx={98} cy={50} r={1.2} fill="#C8E8FF" opacity={0.7} />
  </Svg>
));
FrostCrystalFrame.displayName = 'FrostCrystalFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 9. 墓金 (Pharaoh Gold) — 暗金埃及风三层阶梯边框
// ═══════════════════════════════════════════════════════════════════════════════

export const PharaohGoldFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#D4AA30" stopOpacity={0.95} />
        <Stop offset="0.5" stopColor="#B8942A" stopOpacity={1} />
        <Stop offset="1" stopColor="#8A6E18" stopOpacity={0.95} />
      </LinearGradient>
    </Defs>
    {/* Triple-layer frame */}
    <Rect
      x={2}
      y={2}
      width={96}
      height={96}
      rx={18}
      fill="none"
      stroke="url(#goldGrad)"
      strokeWidth={2}
    />
    <Rect
      x={6}
      y={6}
      width={88}
      height={88}
      rx={15}
      fill="none"
      stroke="#B8942A"
      strokeWidth={1.5}
      opacity={0.8}
    />
    <Rect
      x={10}
      y={10}
      width={80}
      height={80}
      rx={12}
      fill="none"
      stroke="#8A6E18"
      strokeWidth={1}
      opacity={0.6}
    />
    {/* Corner pyramidal triangles */}
    <Path d="M2,2 L14,2 L2,14 Z" fill="#D4AA30" opacity={0.6} />
    <Path d="M86,2 L98,2 L98,14 Z" fill="#D4AA30" opacity={0.6} />
    <Path d="M2,86 L2,98 L14,98 Z" fill="#D4AA30" opacity={0.6} />
    <Path d="M86,98 L98,98 L98,86 Z" fill="#D4AA30" opacity={0.6} />
    {/* Inner corner triangles */}
    <Path d="M6,6 L12,6 L6,12 Z" fill="#B8942A" opacity={0.4} />
    <Path d="M88,6 L94,6 L94,12 Z" fill="#B8942A" opacity={0.4} />
    <Path d="M6,88 L6,94 L12,94 Z" fill="#B8942A" opacity={0.4} />
    <Path d="M88,94 L94,94 L94,88 Z" fill="#B8942A" opacity={0.4} />
    {/* Edge pyramid marks */}
    <Path d="M40,2 L44,0 L48,2" fill="none" stroke="#D4AA30" strokeWidth={1} />
    <Path d="M52,2 L56,0 L60,2" fill="none" stroke="#D4AA30" strokeWidth={1} />
    <Path d="M40,98 L44,100 L48,98" fill="none" stroke="#D4AA30" strokeWidth={1} />
    <Path d="M52,98 L56,100 L60,98" fill="none" stroke="#D4AA30" strokeWidth={1} />
    <Path d="M2,40 L0,44 L2,48" fill="none" stroke="#D4AA30" strokeWidth={1} />
    <Path d="M98,40 L100,44 L98,48" fill="none" stroke="#D4AA30" strokeWidth={1} />
    {/* Center-edge scarab diamonds */}
    <Path d="M50,1 L52,3 L50,5 L48,3 Z" fill="#DDBB40" opacity={0.8} />
    <Path d="M50,95 L52,97 L50,99 L48,97 Z" fill="#DDBB40" opacity={0.8} />
    <Path d="M1,50 L3,48 L5,50 L3,52 Z" fill="#DDBB40" opacity={0.8} />
    <Path d="M95,50 L97,48 L99,50 L97,52 Z" fill="#DDBB40" opacity={0.8} />
  </Svg>
));
PharaohGoldFrame.displayName = 'PharaohGoldFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 10. 虚裂 (Void Rift) — 暗紫渐变方框，边缘裂缝蔓延
// ═══════════════════════════════════════════════════════════════════════════════

export const VoidRiftFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <RadialGradient id="voidGrad" cx="50%" cy="50%" r="70%">
        <Stop offset="0" stopColor="#301060" stopOpacity={0.3} />
        <Stop offset="0.7" stopColor="#4A1880" stopOpacity={0.7} />
        <Stop offset="1" stopColor="#6030A0" stopOpacity={0.9} />
      </RadialGradient>
      <LinearGradient id="riftGlow" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#A060E0" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#6030A0" stopOpacity={0.7} />
      </LinearGradient>
    </Defs>
    {/* Main frame */}
    <Rect
      x={4}
      y={4}
      width={92}
      height={92}
      rx={18}
      fill="none"
      stroke="url(#riftGlow)"
      strokeWidth={2.5}
    />
    {/* Inner frame */}
    <Rect
      x={9}
      y={9}
      width={82}
      height={82}
      rx={14}
      fill="none"
      stroke="#4A1880"
      strokeWidth={1}
      opacity={0.5}
    />
    {/* Rift cracks from edges */}
    <Path
      d="M25,4 L23,10 L26,14"
      fill="none"
      stroke="#A060E0"
      strokeWidth={1.2}
      opacity={0.7}
      strokeLinecap="round"
    />
    <Path
      d="M60,4 L62,12 L59,16"
      fill="none"
      stroke="#C080FF"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
    <Path
      d="M80,4 L78,9 L81,13"
      fill="none"
      stroke="#A060E0"
      strokeWidth={0.8}
      opacity={0.5}
      strokeLinecap="round"
    />
    <Path
      d="M40,96 L42,90 L39,86"
      fill="none"
      stroke="#A060E0"
      strokeWidth={1.2}
      opacity={0.7}
      strokeLinecap="round"
    />
    <Path
      d="M70,96 L68,89 L71,85"
      fill="none"
      stroke="#C080FF"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
    <Path
      d="M4,35 L10,33 L14,36"
      fill="none"
      stroke="#A060E0"
      strokeWidth={1.2}
      opacity={0.7}
      strokeLinecap="round"
    />
    <Path
      d="M4,65 L11,67 L15,64"
      fill="none"
      stroke="#C080FF"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
    <Path
      d="M96,30 L90,28 L86,31"
      fill="none"
      stroke="#A060E0"
      strokeWidth={1}
      opacity={0.6}
      strokeLinecap="round"
    />
    <Path
      d="M96,70 L89,72 L85,69"
      fill="none"
      stroke="#A060E0"
      strokeWidth={1.2}
      opacity={0.7}
      strokeLinecap="round"
    />
    {/* Void eye diamonds at corners */}
    <Path
      d="M4,4 L8,1 L12,4 L8,7 Z"
      fill="#6030A0"
      stroke="#A060E0"
      strokeWidth={0.6}
      opacity={0.8}
    />
    <Path
      d="M88,4 L92,1 L96,4 L92,7 Z"
      fill="#6030A0"
      stroke="#A060E0"
      strokeWidth={0.6}
      opacity={0.8}
    />
    <Path
      d="M4,96 L8,93 L12,96 L8,99 Z"
      fill="#6030A0"
      stroke="#A060E0"
      strokeWidth={0.6}
      opacity={0.8}
    />
    <Path
      d="M88,96 L92,93 L96,96 L92,99 Z"
      fill="#6030A0"
      stroke="#A060E0"
      strokeWidth={0.6}
      opacity={0.8}
    />
    {/* Void particles */}
    <Circle cx={15} cy={8} r={0.8} fill="#C080FF" opacity={0.5} />
    <Circle cx={85} cy={92} r={0.8} fill="#C080FF" opacity={0.5} />
    <Circle cx={8} cy={50} r={0.6} fill="#A060E0" opacity={0.4} />
    <Circle cx={92} cy={50} r={0.6} fill="#A060E0" opacity={0.4} />
  </Svg>
));
VoidRiftFrame.displayName = 'VoidRiftFrame';
