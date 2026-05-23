/**
 * Overlay draw functions for all seat animation tiers.
 *
 * Each function draws ONE frame of the overlay effect given a progress value (0→1).
 * Organized by tier: common → rare → epic → legendary.
 */
import {
  circle,
  clamp01,
  easeOutCubic,
  easeOutQuad,
  ellipse,
  line,
  phase,
  triangle,
} from './helpers';
import type { OverlayDrawFn } from './types';

// ══════════════════════════════════════════════════════════════════════════════
// COMMON TIER
// ══════════════════════════════════════════════════════════════════════════════

/** Expanding ring burst from center (Pop, Bounce, ZoomOut, Spiral) */
export const burstRing: OverlayDrawFn = (ctx, p, size, color) => {
  const r = p * size * 0.5;
  const sw = 3 * (1 - p);
  if (sw < 0.1) return;
  ctx.globalAlpha = (1 - p) * 0.5;
  circle(ctx, size / 2, size / 2, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = sw;
  ctx.stroke();
};

/** Imploding ring from edge to center (ZoomIn) */
export const implodingRing: OverlayDrawFn = (ctx, p, size, color) => {
  const r = (1 - p) * size * 0.45;
  ctx.globalAlpha = (1 - p) * 0.4;
  circle(ctx, size / 2, size / 2, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

/** Static soft glow that fades in then out (Fade, Blur) */
export const staticGlow: OverlayDrawFn = (ctx, p, size, color) => {
  const fadeIn = clamp01(p * 4);
  const fadeOut = clamp01((1 - p) * 3);
  ctx.globalAlpha = fadeIn * fadeOut * 0.25;
  circle(ctx, size / 2, size / 2, size * 0.35);
  ctx.fillStyle = color;
  ctx.fill();
};

/** Vertical trail line (SlideUp, SlideDown) */
export const trailLine: OverlayDrawFn = (ctx, p, size, color, _ac, params) => {
  const direction = (params.direction as string) === 'down' ? 1 : -1;
  const y1 = direction === -1 ? size * (1 - p * 0.5) : size * p * 0.5;
  const y2 = direction === -1 ? size : 0;
  ctx.globalAlpha = (1 - p) * 0.5;
  line(ctx, size / 2, y1, size / 2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

/** Horizontal shimmer line sweeping across (Flip) */
export const shimmerLine: OverlayDrawFn = (ctx, p, size, color) => {
  const x = p * size;
  ctx.globalAlpha = (1 - p) * 0.4;
  line(ctx, x, 0, x, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

/** Arc sweep growing clockwise (Spin) */
export const arcSweep: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const angle = p * Math.PI * 2;
  ctx.globalAlpha = (1 - p) * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
};

// ══════════════════════════════════════════════════════════════════════════════
// RARE TIER
// ══════════════════════════════════════════════════════════════════════════════

/** Petal ellipses blooming outward (Bloom) */
export const petalBloom: OverlayDrawFn = (ctx, p, size, color, accentColor) => {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = p * size * 0.35;
    const cx = size / 2 + Math.cos(angle) * dist;
    const cy = size / 2 + Math.sin(angle) * dist;
    const rx = size * 0.06 * (0.3 + p * 0.7);
    const ry = size * 0.12 * (0.3 + p * 0.7);
    ctx.globalAlpha = 0.7 * (1 - p * 0.8);
    ellipse(ctx, cx, cy, rx, ry);
    ctx.fillStyle = i % 2 === 0 ? color : accentColor;
    ctx.fill();
  }
};

/** Triangular shards exploding outward (Shatter) */
export const shatterShards: OverlayDrawFn = (ctx, p, size, color, accentColor) => {
  const count = 8;
  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = p * size * 0.45;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const half = size * 0.08 * (1 - p * 0.5);
    ctx.globalAlpha = 1 - p;
    triangle(ctx, x, y, half);
    ctx.fillStyle = i % 2 === 0 ? color : accentColor;
    ctx.fill();
  }
};

/** Concentric ellipses pulsing (Portal) */
export const portalEllipses: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  // Outer ring (stroke)
  const outerRx = size * 0.35 * (0.6 + p * 0.4);
  const outerRy = size * 0.2 * (0.6 + p * 0.4);
  ctx.globalAlpha = (1 - p) * 0.4;
  ellipse(ctx, cx, cy, outerRx, outerRy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner fill
  const innerRx = outerRx * 0.6;
  const innerRy = outerRy * 0.6;
  ctx.globalAlpha = (1 - p) * 0.2;
  ellipse(ctx, cx, cy, innerRx, innerRy);
  ctx.fillStyle = color;
  ctx.fill();
};

/** Lightning zigzag bolt (Lightning) */
export const lightningBolt: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const startY = size * 0.15;
  const endY = size * 0.85;
  const segments = 5;
  const segH = (endY - startY) / segments;
  const drawLen = clamp01(p * 2.5); // bolt draws in first 40%, then fades

  ctx.globalAlpha = p < 0.4 ? 1 : (1 - (p - 0.4) / 0.6) * 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, startY);
  for (let i = 1; i <= segments; i++) {
    const prog = i / segments;
    if (prog > drawLen) break;
    const offsetX = (i % 2 === 0 ? 1 : -1) * size * 0.12;
    ctx.lineTo(cx + offsetX, startY + i * segH);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};

// ══════════════════════════════════════════════════════════════════════════════
// EPIC TIER
// ══════════════════════════════════════════════════════════════════════════════

/** Flame tongue shapes enveloping (FlameEnvelope) */
export const flameTongues: OverlayDrawFn = (ctx, p, size, color, accentColor, params) => {
  const count = (params.flameCount as number) || 8;
  const isInward = (params.direction as string) === 'inward';
  // Glow background
  ctx.globalAlpha = 0.3 * (isInward ? 1 - p : p * (1 - Math.max(0, (p - 0.7) / 0.3)));
  circle(ctx, size / 2, size / 2, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Flame tongues
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const flickerPhase = p * Math.PI * 6 + i;
    const flicker = Math.sin(flickerPhase) * 0.15;
    const baseRadius = isInward ? size * 0.5 * (1 - p * 0.8) : size * 0.1 + p * size * 0.35;
    const tipRadius = baseRadius + size * (0.08 + flicker);
    const cx = size / 2;
    const cy = size / 2;
    const bx = cx + Math.cos(angle) * baseRadius;
    const by = cy + Math.sin(angle) * baseRadius;
    const tx = cx + Math.cos(angle) * tipRadius;
    const ty = cy + Math.sin(angle) * tipRadius;
    const spread = size * 0.03;
    const perpX = -Math.sin(angle) * spread;
    const perpY = Math.cos(angle) * spread;
    ctx.globalAlpha = isInward ? 0.7 * (1 - p) : 0.7 * p * (1 - Math.max(0, (p - 0.7) / 0.3));
    ctx.beginPath();
    ctx.moveTo(bx + perpX, by + perpY);
    ctx.quadraticCurveTo(tx, ty, bx - perpX, by - perpY);
    ctx.fillStyle = i % 3 === 0 ? accentColor : color;
    ctx.fill();
  }
};

/** Dots swirling inward (VortexSwirl) */
export const vortexDots: OverlayDrawFn = (ctx, p, size, color, accentColor, params) => {
  const count = (params.particleCount as number) || 8;
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = easeOutCubic(p) * (1 - p) * 0.3;
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Particles spiraling inward
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const spiralAngle = baseAngle + p * Math.PI * 3;
    const dist = size * 0.4 * (1 - p * 0.8);
    const px = cx + Math.cos(spiralAngle) * dist;
    const py = cy + Math.sin(spiralAngle) * dist;
    const r = size * 0.02 * (1 - p * 0.5);
    ctx.globalAlpha = 0.7 * (1 - p * 0.5);
    circle(ctx, px, py, r);
    ctx.fillStyle = i % 2 === 0 ? color : accentColor;
    ctx.fill();
  }
};

/** Concentric expanding ring circles (RingPortal) */
export const concentricRings: OverlayDrawFn = (ctx, p, size, color, _ac, params) => {
  const count = (params.ringCount as number) || 3;
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = 0.2 * (1 - p);
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Rings expanding outward with stagger
  for (let i = 0; i < count; i++) {
    const stagger = i * 0.15;
    const rp = clamp01((p - stagger) / (1 - stagger));
    if (rp <= 0) continue;
    const r = rp * size * 0.5;
    const sw = 2 * (1 - rp);
    if (sw < 0.1) continue;
    ctx.globalAlpha = (1 - rp) * 0.5;
    circle(ctx, cx, cy, r);
    ctx.strokeStyle = color;
    ctx.lineWidth = sw;
    ctx.stroke();
  }
};

/** Simple glow behind ghost copies (PhaseShift) */
export const phaseGlow: OverlayDrawFn = (ctx, p, size, color) => {
  const fadeIn = clamp01(p * 5);
  const fadeOut = clamp01((1 - p) * 2.5);
  ctx.globalAlpha = fadeIn * fadeOut * 0.3;
  circle(ctx, size / 2, size / 2, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
};

/** Particle dots exploding outward (ParticleBurst) */
export const burstParticles: OverlayDrawFn = (ctx, p, size, color, accentColor, params) => {
  const count = (params.particleCount as number) || 12;
  const shape = (params.shape as string) || 'circle';
  const spiral = (params.spiral as boolean) || false;
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = 0.25 * (1 - p);
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Particles
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = spiral ? baseAngle + p * Math.PI * 1.5 : baseAngle;
    const dist = p * size * 0.45;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    ctx.globalAlpha = (1 - p) * 0.7;
    if (shape === 'shard') {
      const half = size * 0.04 * (1 - p * 0.5);
      triangle(ctx, px, py, half);
    } else {
      circle(ctx, px, py, size * 0.02 * (1 - p * 0.3));
    }
    ctx.fillStyle = i % 3 === 0 ? accentColor : color;
    ctx.fill();
  }
};

/** Diagonal slash lines (SlashReveal) */
export const slashLines: OverlayDrawFn = (ctx, p, size, color, _ac, params) => {
  const count = (params.slashCount as number) || 3;
  const baseAngle = ((params.baseAngle as number) || 30) * (Math.PI / 180);
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = 0.2 * (1 - p);
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Slashes
  const slashP = clamp01(p * 1.5); // slashes draw quickly
  const fadeP = clamp01((p - 0.5) / 0.5);
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * size * 0.15;
    const angle = baseAngle;
    const len = slashP * size * 0.7;
    const startX = cx + offset * Math.cos(angle + Math.PI / 2) - Math.cos(angle) * len * 0.5;
    const startY = cy + offset * Math.sin(angle + Math.PI / 2) - Math.sin(angle) * len * 0.5;
    const endX = startX + Math.cos(angle) * len;
    const endY = startY + Math.sin(angle) * len;
    ctx.globalAlpha = (1 - fadeP) * 0.7;
    line(ctx, startX, startY, endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
};

/** Diamond/leaf/drop shapes rising (RisingElement) */
export const risingShapes: OverlayDrawFn = (ctx, p, size, color, accentColor, params) => {
  const count = (params.elementCount as number) || 6;
  const shape = (params.shape as string) || 'diamond';
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = 0.2 * (1 - p);
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Rising elements
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2;
    const dist = size * 0.15 + p * size * 0.3;
    const riseY = -p * size * 0.2;
    const px = cx + Math.cos(baseAngle) * dist;
    const py = cy + Math.sin(baseAngle) * dist + riseY;
    const elemSize = size * 0.04 * (1 - p * 0.3);
    ctx.globalAlpha = (1 - p) * 0.7;
    if (shape === 'leaf') {
      ellipse(ctx, px, py, elemSize * 0.5, elemSize * 1.5);
    } else if (shape === 'drop') {
      circle(ctx, px, py, elemSize);
    } else {
      // diamond
      ctx.beginPath();
      ctx.moveTo(px, py - elemSize);
      ctx.lineTo(px + elemSize * 0.6, py);
      ctx.lineTo(px, py + elemSize);
      ctx.lineTo(px - elemSize * 0.6, py);
      ctx.closePath();
    }
    ctx.fillStyle = i % 2 === 0 ? color : accentColor;
    ctx.fill();
  }
};

/** Creature shapes swarming inward (CreatureSwarm) */
export const creatureSwarm: OverlayDrawFn = (ctx, p, size, color, accentColor, params) => {
  const count = (params.creatureCount as number) || 6;
  const cx = size / 2;
  const cy = size / 2;
  // Glow
  ctx.globalAlpha = 0.2 * (1 - p);
  circle(ctx, cx, cy, size * 0.45);
  ctx.fillStyle = color;
  ctx.fill();
  // Creatures converging
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2 + p * Math.PI;
    const dist = size * 0.45 * (1 - p * 0.7);
    const px = cx + Math.cos(baseAngle) * dist;
    const py = cy + Math.sin(baseAngle) * dist;
    const wingSpan = size * 0.04;
    // Simple bat/bird shape: V with body
    ctx.globalAlpha = 0.7 * (1 - Math.max(0, (p - 0.7) / 0.3));
    ctx.beginPath();
    const wingAngle = baseAngle + Math.PI;
    ctx.moveTo(
      px - Math.cos(wingAngle + 0.8) * wingSpan,
      py - Math.sin(wingAngle + 0.8) * wingSpan,
    );
    ctx.lineTo(px, py);
    ctx.lineTo(
      px - Math.cos(wingAngle - 0.8) * wingSpan,
      py - Math.sin(wingAngle - 0.8) * wingSpan,
    );
    ctx.strokeStyle = i % 2 === 0 ? color : accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// LEGENDARY TIER
// ══════════════════════════════════════════════════════════════════════════════

/** Wolf eyes + X slashes + shockwave (WolfKingEntry) */
export const wolfKingOverlay: OverlayDrawFn = (ctx, p, size) => {
  const eyeP = phase(p, 0, 0.36);
  const slashP = phase(p, 0.36, 0.68);
  const waveP = phase(p, 0.68, 1);
  const cx = size / 2;
  const cy = size / 2;
  // Eyes
  if (eyeP > 0) {
    const eyeR = size * 0.03;
    const eyeAlpha = eyeP < 0.6 ? eyeP / 0.6 : 0.5 + 0.4 * (0.6 - (eyeP - 0.6) / 0.4);
    ctx.globalAlpha = eyeAlpha * 0.9;
    circle(ctx, size * 0.38, size * 0.38, eyeR);
    ctx.fillStyle = 'rgb(255,50,50)';
    ctx.fill();
    circle(ctx, size * 0.62, size * 0.38, eyeR);
    ctx.fillStyle = 'rgb(255,50,50)';
    ctx.fill();
  }
  // Slashes
  if (slashP > 0) {
    const sAlpha = (1 - waveP) * 0.7;
    ctx.globalAlpha = sAlpha;
    const len = slashP * size * 0.7;
    // Slash 1: top-left to bottom-right
    line(ctx, size * 0.15, size * 0.15, size * 0.15 + len, size * 0.15 + len);
    ctx.strokeStyle = 'rgb(200,30,30)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Slash 2: top-right to bottom-left
    line(ctx, size * 0.85, size * 0.15, size * 0.85 - len, size * 0.15 + len);
    ctx.strokeStyle = 'rgb(200,30,30)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // Shockwave
  if (waveP > 0) {
    ctx.globalAlpha = (1 - waveP) * 0.4;
    circle(ctx, cx, cy, waveP * size * 0.55);
    ctx.strokeStyle = 'rgb(180,20,20)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

/** Bubbles rising (WitchBrew) */
export const witchBubbles: OverlayDrawFn = (ctx, p, size, color) => {
  const count = 8;
  const cx = size / 2;
  // Glow
  ctx.globalAlpha = 0.2 * (1 - p);
  circle(ctx, cx, size / 2, size * 0.4);
  ctx.fillStyle = color;
  ctx.fill();
  // Bubbles
  for (let i = 0; i < count; i++) {
    const delay = i * 0.08;
    const bp = clamp01((p - delay) / (1 - delay));
    if (bp <= 0) continue;
    const xOff = Math.sin(i * 1.7) * size * 0.25;
    const bx = cx + xOff;
    const by = size * 0.8 - bp * size * 0.7;
    const r = size * (0.015 + (i % 3) * 0.008) * (1 - bp * 0.3);
    ctx.globalAlpha = (1 - bp) * 0.6;
    circle(ctx, bx, by, r);
    ctx.fillStyle = color;
    ctx.fill();
  }
};

/** Eye shape with iris (SeerVision) */
export const seerEye: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const openP = clamp01(p * 2.5); // eye opens in first 40%
  const fadeP = clamp01((p - 0.6) / 0.4); // fades in last 40%
  // Eye shape (ellipse)
  const rx = size * 0.3 * openP;
  const ry = size * 0.15 * openP;
  ctx.globalAlpha = (1 - fadeP) * 0.5;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Iris
  if (openP > 0.3) {
    const irisR = size * 0.06 * openP;
    ctx.globalAlpha = (1 - fadeP) * 0.7;
    circle(ctx, cx, cy, irisR);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Ripple ring
  if (p > 0.3) {
    const rp = (p - 0.3) / 0.7;
    ctx.globalAlpha = (1 - rp) * 0.3;
    circle(ctx, cx, cy, rp * size * 0.45);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
};

/** Crosshair lines + flash + shockwave (HunterShot) */
export const hunterCrosshair: OverlayDrawFn = (ctx, p, size) => {
  const cx = size / 2;
  const cy = size / 2;
  const aimP = phase(p, 0, 0.4);
  const shotP = phase(p, 0.4, 0.6);
  const waveP = phase(p, 0.6, 1);
  // Crosshair
  if (aimP > 0) {
    const len = aimP * size * 0.35;
    ctx.globalAlpha = (1 - shotP) * 0.6;
    ctx.strokeStyle = 'rgb(200,60,60)';
    ctx.lineWidth = 1.5;
    line(ctx, cx - len, cy, cx + len, cy);
    ctx.stroke();
    line(ctx, cx, cy - len, cx, cy + len);
    ctx.stroke();
  }
  // Flash
  if (shotP > 0) {
    ctx.globalAlpha = shotP * (1 - shotP) * 2;
    circle(ctx, cx, cy, size * 0.15);
    ctx.fillStyle = 'rgb(255,200,50)';
    ctx.fill();
  }
  // Shockwave
  if (waveP > 0) {
    ctx.globalAlpha = (1 - waveP) * 0.4;
    circle(ctx, cx, cy, waveP * size * 0.5);
    ctx.strokeStyle = 'rgb(200,60,60)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};

/** Hexagonal shield segments (GuardShield) */
export const guardHexShield: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const formP = phase(p, 0, 0.5);
  const glowP = phase(p, 0.3, 0.7);
  const fadeP = phase(p, 0.6, 1);
  // Hex outline
  if (formP > 0) {
    const r = size * 0.38 * easeOutQuad(formP);
    ctx.globalAlpha = (1 - fadeP) * 0.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const drawTo = i <= Math.floor(formP * 6) ? 1 : formP * 6 - i + 1;
      if (drawTo <= 0) continue;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Glow
  if (glowP > 0) {
    ctx.globalAlpha = glowP * (1 - fadeP) * 0.25;
    circle(ctx, cx, cy, size * 0.35);
    ctx.fillStyle = color;
    ctx.fill();
  }
};

/** Stars + moon glow (NightFall) */
export const nightFallStars: OverlayDrawFn = (ctx, p, size) => {
  const cx = size / 2;
  const cy = size / 2;
  // Moon glow
  const moonP = phase(p, 0, 0.5);
  if (moonP > 0) {
    ctx.globalAlpha = moonP * (1 - phase(p, 0.7, 1)) * 0.3;
    circle(ctx, cx, cy * 0.7, size * 0.12);
    ctx.fillStyle = 'rgb(200,200,255)';
    ctx.fill();
  }
  // Stars
  const starCount = 6;
  for (let i = 0; i < starCount; i++) {
    const delay = i * 0.1;
    const sp = clamp01((p - delay) / 0.5);
    const fadeOut = clamp01((p - 0.6) / 0.4);
    if (sp <= 0) continue;
    const angle = (i / starCount) * Math.PI * 2 + 0.5;
    const dist = size * (0.2 + (i % 3) * 0.08);
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    ctx.globalAlpha = sp * (1 - fadeOut) * 0.6;
    circle(ctx, sx, sy, size * 0.012);
    ctx.fillStyle = 'rgb(220,220,255)';
    ctx.fill();
  }
};

/** Radial light rays expanding (DawnBreak) */
export const dawnRays: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const rayCount = 8;
  const rayP = easeOutCubic(clamp01(p * 1.5));
  const fadeP = clamp01((p - 0.5) / 0.5);
  // Glow
  ctx.globalAlpha = 0.25 * (1 - fadeP);
  circle(ctx, cx, cy, size * 0.35 * rayP);
  ctx.fillStyle = color;
  ctx.fill();
  // Rays
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const innerR = size * 0.1;
    const outerR = innerR + rayP * size * 0.35;
    ctx.globalAlpha = (1 - fadeP) * 0.5;
    line(
      ctx,
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR,
      cx + Math.cos(angle) * outerR,
      cy + Math.sin(angle) * outerR,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
};

/** Moon rising + eclipse ring + mist (BloodMoonRise) */
export const bloodMoonRise: OverlayDrawFn = (ctx, p, size) => {
  const cx = size / 2;
  const riseP = easeOutCubic(clamp01(p * 1.5));
  const fadeP = clamp01((p - 0.6) / 0.4);
  // Moon rising from bottom
  const moonY = size * 0.8 - riseP * size * 0.4;
  const moonR = size * 0.1;
  ctx.globalAlpha = (1 - fadeP) * 0.6;
  circle(ctx, cx, moonY, moonR);
  ctx.fillStyle = 'rgb(180,30,30)';
  ctx.fill();
  // Eclipse ring
  if (p > 0.3) {
    const ep = (p - 0.3) / 0.7;
    ctx.globalAlpha = (1 - fadeP) * 0.4;
    circle(ctx, cx, moonY, moonR + ep * size * 0.08);
    ctx.strokeStyle = 'rgb(255,80,80)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Mist circles
  for (let i = 0; i < 4; i++) {
    const mp = clamp01((p - i * 0.15) / 0.5);
    if (mp <= 0) continue;
    const mx = cx + Math.sin(i * 2.3) * size * 0.2;
    const my = size * 0.7 - mp * size * 0.15;
    ctx.globalAlpha = (1 - mp) * (1 - fadeP) * 0.2;
    circle(ctx, mx, my, size * 0.06);
    ctx.fillStyle = 'rgb(100,20,20)';
    ctx.fill();
  }
};

/** Wisps converging inward (SpiritSummon) */
export const spiritWisps: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const count = 6;
  // Glow
  ctx.globalAlpha = easeOutCubic(p) * (1 - p) * 0.3;
  circle(ctx, cx, cy, size * 0.35);
  ctx.fillStyle = color;
  ctx.fill();
  // Wisps
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + p * Math.PI * 0.5;
    const dist = size * 0.4 * (1 - easeOutCubic(p) * 0.8);
    const wx = cx + Math.cos(angle) * dist;
    const wy = cy + Math.sin(angle) * dist;
    const r = size * 0.02 * (1 - p * 0.3);
    ctx.globalAlpha = (1 - p * 0.5) * 0.6;
    circle(ctx, wx, wy, r);
    ctx.fillStyle = color;
    ctx.fill();
  }
};

/** Sparkle dots radiating outward (CardReveal) */
export const cardSparkles: OverlayDrawFn = (ctx, p, size, color) => {
  const cx = size / 2;
  const cy = size / 2;
  const count = 8;
  for (let i = 0; i < count; i++) {
    const delay = i * 0.06;
    const sp = clamp01((p - delay) / 0.6);
    if (sp <= 0) continue;
    const angle = (i / count) * Math.PI * 2;
    const dist = sp * size * 0.4;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    const fadeOut = clamp01((p - 0.5) / 0.5);
    ctx.globalAlpha = (1 - fadeOut) * 0.7;
    circle(ctx, sx, sy, size * 0.015 * (1 - sp * 0.5));
    ctx.fillStyle = color;
    ctx.fill();
  }
};
