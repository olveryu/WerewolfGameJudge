/**
 * Avatar Frame SVG Components
 *
 * 5 款暗黑奇幻风格的头像装饰框，用 react-native-svg 矢量绘制。
 * 每个框接收 `size` 按比例缩放。内部使用 100×100 viewBox 坐标系。
 * 不引入 React hooks、service、theme（颜色固定，确保跨主题一致的装饰效果）。
 */
import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

export interface FrameProps {
  size: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. 月轮 (Lunar Ring) — 银白双圈光晕
// ═══════════════════════════════════════════════════════════════════════════════

export const LunarFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    {/* Outer glow ring */}
    <Circle cx={50} cy={50} r={47} stroke="#B0B0C8" strokeWidth={1.2} fill="none" opacity={0.5} />
    {/* Main ring */}
    <Circle cx={50} cy={50} r={44.5} stroke="#D0D0E0" strokeWidth={2.5} fill="none" opacity={0.9} />
    {/* Inner highlight */}
    <Circle cx={50} cy={50} r={42} stroke="#FFFFFF" strokeWidth={0.8} fill="none" opacity={0.3} />
  </Svg>
));
LunarFrame.displayName = 'LunarFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 狼牙 (Wolf Fang) — 锯齿尖齿环
// ═══════════════════════════════════════════════════════════════════════════════

const FANG_COUNT = 16;
function buildFangPath(): string {
  const innerR = 41;
  const outerR = 49;
  const parts: string[] = [];
  for (let i = 0; i < FANG_COUNT; i++) {
    const baseAngle = (i / FANG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const tipAngle = ((i + 0.5) / FANG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const nextAngle = ((i + 1) / FANG_COUNT) * Math.PI * 2 - Math.PI / 2;
    const bx = 50 + innerR * Math.cos(baseAngle);
    const by = 50 + innerR * Math.sin(baseAngle);
    const tx = 50 + outerR * Math.cos(tipAngle);
    const ty = 50 + outerR * Math.sin(tipAngle);
    const nx = 50 + innerR * Math.cos(nextAngle);
    const ny = 50 + innerR * Math.sin(nextAngle);
    parts.push(`${i === 0 ? 'M' : 'L'}${bx},${by} L${tx},${ty} L${nx},${ny}`);
  }
  return parts.join(' ') + ' Z';
}
const FANG_PATH = buildFangPath();

export const WolfFangFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="fangGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#CC3333" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#4A4A5A" stopOpacity={0.8} />
      </LinearGradient>
    </Defs>
    <Path d={FANG_PATH} fill="url(#fangGrad)" />
    {/* Inner ring to clean edge */}
    <Circle cx={50} cy={50} r={41} stroke="#3A3A44" strokeWidth={1} fill="none" />
  </Svg>
));
WolfFangFrame.displayName = 'WolfFangFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 符文 (Arcane Rune) — 圆环 + 菱形符文标记
// ═══════════════════════════════════════════════════════════════════════════════

const RUNE_POSITIONS = [0, 90, 180, 270]; // degrees
function buildRuneDiamond(angleDeg: number): string {
  const r = 46;
  const dIn = 3;
  const dOut = 4;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Diamond points: center on circle, stretched radially
  const cx = 50 + r * cos;
  const cy = 50 + r * sin;
  const outX = cx + dOut * cos;
  const outY = cy + dOut * sin;
  const inX = cx - dIn * cos;
  const inY = cy - dIn * sin;
  const sideX1 = cx - 2.5 * sin;
  const sideY1 = cy + 2.5 * cos;
  const sideX2 = cx + 2.5 * sin;
  const sideY2 = cy - 2.5 * cos;
  return `M${outX},${outY} L${sideX1},${sideY1} L${inX},${inY} L${sideX2},${sideY2} Z`;
}
const RUNE_DIAMONDS = RUNE_POSITIONS.map(buildRuneDiamond).join(' ');

export const ArcaneRuneFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="runeGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#9B6BFF" stopOpacity={0.8} />
        <Stop offset="1" stopColor="#6B3FA0" stopOpacity={0.9} />
      </LinearGradient>
    </Defs>
    {/* Main ring */}
    <Circle cx={50} cy={50} r={44} stroke="url(#runeGrad)" strokeWidth={2} fill="none" />
    {/* Rune diamonds */}
    <Path d={RUNE_DIAMONDS} fill="#A78BFA" opacity={0.9} />
    {/* Subtle outer ring */}
    <Circle cx={50} cy={50} r={48} stroke="#A78BFA" strokeWidth={0.6} fill="none" opacity={0.3} />
  </Svg>
));
ArcaneRuneFrame.displayName = 'ArcaneRuneFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 荆棘 (Bramble) — 藤蔓缠绕环
// ═══════════════════════════════════════════════════════════════════════════════

const THORN_COUNT = 12;
function buildBramblePath(): string {
  const baseR = 44;
  const thornR = 49;
  const segments: string[] = [];
  for (let i = 0; i < THORN_COUNT; i++) {
    const a0 = (i / THORN_COUNT) * Math.PI * 2 - Math.PI / 2;
    const aMid = ((i + 0.35) / THORN_COUNT) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / THORN_COUNT) * Math.PI * 2 - Math.PI / 2;
    const x0 = 50 + baseR * Math.cos(a0);
    const y0 = 50 + baseR * Math.sin(a0);
    const xT = 50 + thornR * Math.cos(aMid);
    const yT = 50 + thornR * Math.sin(aMid);
    const x1 = 50 + baseR * Math.cos(a1);
    const y1 = 50 + baseR * Math.sin(a1);
    // Quadratic curve through thorn point
    segments.push(`${i === 0 ? 'M' : 'L'}${x0},${y0} Q${xT},${yT} ${x1},${y1}`);
  }
  return segments.join(' ') + ' Z';
}
const BRAMBLE_PATH = buildBramblePath();

export const BrambleFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <G>
      {/* Vine base */}
      <Circle cx={50} cy={50} r={44} stroke="#2D6B3F" strokeWidth={2} fill="none" opacity={0.7} />
      {/* Thorns */}
      <Path d={BRAMBLE_PATH} fill="none" stroke="#34D399" strokeWidth={1.5} opacity={0.6} />
      {/* Thorn tips (small dots) */}
      {Array.from({ length: THORN_COUNT }, (_, i) => {
        const aMid = ((i + 0.35) / THORN_COUNT) * Math.PI * 2 - Math.PI / 2;
        return (
          <Circle
            key={i}
            cx={50 + 48 * Math.cos(aMid)}
            cy={50 + 48 * Math.sin(aMid)}
            r={1.2}
            fill="#34D399"
            opacity={0.8}
          />
        );
      })}
    </G>
  </Svg>
));
BrambleFrame.displayName = 'BrambleFrame';

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 血焰 (Blood Flame) — 火焰轮廓环
// ═══════════════════════════════════════════════════════════════════════════════

const FLAME_COUNT = 8;
function buildFlamePath(): string {
  const baseR = 42;
  const flameR = 50;
  const parts: string[] = [];
  for (let i = 0; i < FLAME_COUNT; i++) {
    const a0 = (i / FLAME_COUNT) * Math.PI * 2 - Math.PI / 2;
    const aMid = ((i + 0.5) / FLAME_COUNT) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / FLAME_COUNT) * Math.PI * 2 - Math.PI / 2;
    const x0 = 50 + baseR * Math.cos(a0);
    const y0 = 50 + baseR * Math.sin(a0);
    // Control point for flame curve (higher = taller flame)
    const cpx = 50 + flameR * Math.cos(aMid);
    const cpy = 50 + flameR * Math.sin(aMid);
    const x1 = 50 + baseR * Math.cos(a1);
    const y1 = 50 + baseR * Math.sin(a1);
    parts.push(`${i === 0 ? 'M' : 'L'}${x0},${y0} Q${cpx},${cpy} ${x1},${y1}`);
  }
  return parts.join(' ') + ' Z';
}
const FLAME_PATH = buildFlamePath();

export const BloodFlameFrame = memo<FrameProps>(({ size }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FF6B35" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#CC2222" stopOpacity={0.85} />
      </LinearGradient>
    </Defs>
    {/* Flame tongues */}
    <Path d={FLAME_PATH} fill="url(#flameGrad)" />
    {/* Inner ring */}
    <Circle cx={50} cy={50} r={42} stroke="#AA1111" strokeWidth={1} fill="none" opacity={0.5} />
  </Svg>
));
BloodFlameFrame.displayName = 'BloodFlameFrame';
