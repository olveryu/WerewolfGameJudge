/**
 * Canvas 2D draw functions for all 12 seat pets.
 *
 * Each function draws in a 72×72 viewBox coordinate system.
 * The `s` param is the scale factor (size / 72).
 * progress[] comes from timer durations defined in PetDrawConfig.
 */
import type { PetDrawConfig } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function circle(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  rotation = 0,
) {
  ctx.beginPath();
  ctx.ellipse(cx * s, cy * s, rx * s, ry * s, rotation, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  lw: number,
) {
  ctx.beginPath();
  ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw * s;
  ctx.stroke();
}

function strokeEllipse(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stroke: string,
  lw: number,
  rotation = 0,
) {
  ctx.beginPath();
  ctx.ellipse(cx * s, cy * s, rx * s, ry * s, rotation, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw * s;
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.roundRect(x * s, y * s, w * s, h * s, r * s);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke: string,
  lw: number,
) {
  ctx.beginPath();
  ctx.roundRect(x * s, y * s, w * s, h * s, r * s);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw * s;
  ctx.stroke();
}

function line(
  ctx: CanvasRenderingContext2D,
  s: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  lw: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1 * s, y1 * s);
  ctx.lineTo(x2 * s, y2 * s);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw * s;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  s: number,
  points: [number, number][],
  fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(points[0]![0] * s, points[0]![1] * s);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0] * s, points[i]![1] * s);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function rotated(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  angleDeg: number,
  fn: () => void,
) {
  ctx.save();
  ctx.translate(cx * s, cy * s);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.translate(-cx * s, -cy * s);
  fn();
  ctx.restore();
}

// ─── 1. CapsulePet — 蛋仔 ──────────────────────────────────────────────────

export const drawCapsule: PetDrawConfig = {
  floatDuration: 2600,
  durations: [2000],
  draw(ctx, s, [p0]) {
    const lidRot = Math.sin(p0 * Math.PI * 2) * -8;
    // Bottom half
    ctx.beginPath();
    ctx.moveTo(20 * s, 38 * s);
    ctx.quadraticCurveTo(20 * s, 56 * s, 36 * s, 56 * s);
    ctx.quadraticCurveTo(52 * s, 56 * s, 52 * s, 38 * s);
    ctx.closePath();
    ctx.fillStyle = '#ff6b81';
    ctx.fill();
    // Top half (lid) — rotated
    rotated(ctx, s, 36, 38, lidRot, () => {
      ctx.beginPath();
      ctx.moveTo(20 * s, 38 * s);
      ctx.quadraticCurveTo(20 * s, 20 * s, 36 * s, 18 * s);
      ctx.quadraticCurveTo(52 * s, 20 * s, 52 * s, 38 * s);
      ctx.closePath();
      ctx.fillStyle = '#ff4757';
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // Seam line
    line(ctx, s, 20, 38, 52, 38, '#c0392b', 1.5);
    // Eyes
    circle(ctx, s, 30, 36, 4, '#fff');
    circle(ctx, s, 42, 36, 4, '#fff');
    circle(ctx, s, 31, 36, 2.5, '#1a1a2e');
    circle(ctx, s, 43, 36, 2.5, '#1a1a2e');
    circle(ctx, s, 31.5, 35.5, 0.8, '#fff');
    circle(ctx, s, 43.5, 35.5, 0.8, '#fff');
    // Blush
    ellipse(ctx, s, 25, 40, 3, 2, 'rgba(255,150,150,0.5)');
    ellipse(ctx, s, 47, 40, 3, 2, 'rgba(255,150,150,0.5)');
    // Feet
    ellipse(ctx, s, 29, 56, 4, 2, '#e84a5f');
    ellipse(ctx, s, 43, 56, 4, 2, '#e84a5f');
  },
};

// ─── 2. CardSpritePet — 牌灵 ────────────────────────────────────────────────

export const drawCardSprite: PetDrawConfig = {
  floatDuration: 2700,
  durations: [1500],
  draw(ctx, s, [p0]) {
    const wingRot = Math.sin(p0 * Math.PI * 2) * 8;
    const wingRotR = Math.sin(p0 * Math.PI * 2 + 0.6) * 8;
    const sparkle1 = 0.5 + Math.sin(p0 * Math.PI * 4) * 0.5;
    const sparkle2 = 0.5 + Math.sin(p0 * Math.PI * 4 + 1) * 0.5;
    // Card base
    roundRect(ctx, s, 22, 28, 28, 38, 4, '#f0e6d3');
    strokeRoundRect(ctx, s, 22, 28, 28, 38, 4, '#c4a882', 1);
    // Spade symbol
    ctx.font = `${16 * s}px serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b0000';
    ctx.fillText('♠', 36 * s, 52 * s);
    // Sprite head
    circle(ctx, s, 36, 22, 10, '#a8e6cf');
    // Eyes
    circle(ctx, s, 33, 20, 2, '#1a1a2e');
    circle(ctx, s, 39, 20, 2, '#1a1a2e');
    circle(ctx, s, 33.5, 19.5, 0.6, '#fff');
    circle(ctx, s, 39.5, 19.5, 0.6, '#fff');
    // Smile
    ctx.beginPath();
    ctx.moveTo(33 * s, 24 * s);
    ctx.quadraticCurveTo(36 * s, 26.5 * s, 39 * s, 24 * s);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Wings
    rotated(ctx, s, 25, 22, wingRot, () => {
      ctx.globalAlpha = 0.6;
      ellipse(ctx, s, 25, 22, 4, 6, '#a8e6cf');
      ctx.globalAlpha = 1;
    });
    rotated(ctx, s, 47, 22, wingRotR, () => {
      ctx.globalAlpha = 0.6;
      ellipse(ctx, s, 47, 22, 4, 6, '#a8e6cf');
      ctx.globalAlpha = 1;
    });
    // Sparkles
    ctx.globalAlpha = sparkle1;
    circle(ctx, s, 50, 14, 1.2 * sparkle1 + 0.3, '#ffd700');
    ctx.globalAlpha = sparkle2;
    circle(ctx, s, 22, 16, 1.0 * sparkle2 + 0.2, '#ffd700');
    ctx.globalAlpha = 1;
  },
};

// ─── 3. ChainDragonPet — 锁龙 ──────────────────────────────────────────────

export const drawChainDragon: PetDrawConfig = {
  floatDuration: 2800,
  durations: [500, 2000],
  draw(ctx, s, [p0, p1]) {
    const chainDx = Math.sin(p0 * Math.PI * 2) * 1;
    const wingRot = Math.sin(p1! * Math.PI * 2) * 8;
    // Body
    ellipse(ctx, s, 36, 44, 14, 12, '#5b8c5a');
    // Tail
    ctx.beginPath();
    ctx.moveTo(50 * s, 44 * s);
    ctx.quadraticCurveTo(58 * s, 36 * s, 56 * s, 44 * s);
    ctx.quadraticCurveTo(54 * s, 50 * s, 52 * s, 46 * s);
    ctx.strokeStyle = '#5b8c5a';
    ctx.lineWidth = 4 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Head
    circle(ctx, s, 36, 28, 12, '#6aa66a');
    // Horns
    polygon(
      ctx,
      s,
      [
        [28, 20],
        [24, 12],
        [30, 18],
      ],
      '#8bc48a',
    );
    polygon(
      ctx,
      s,
      [
        [44, 20],
        [48, 12],
        [42, 18],
      ],
      '#8bc48a',
    );
    // Eyes
    circle(ctx, s, 32, 26, 3, '#fff');
    circle(ctx, s, 40, 26, 3, '#fff');
    circle(ctx, s, 33, 26, 1.8, '#c0392b');
    circle(ctx, s, 41, 26, 1.8, '#c0392b');
    // Nose
    circle(ctx, s, 34, 32, 0.8, '#4a5568');
    circle(ctx, s, 38, 32, 0.8, '#4a5568');
    // Chain left
    strokeEllipse(ctx, s, 22 + chainDx, 38, 3, 4, '#a8a8a8', 1.5);
    rotated(ctx, s, 18, 42, 20, () => {
      strokeEllipse(ctx, s, 18, 42, 3, 4, '#a8a8a8', 1.5);
    });
    // Chain right
    strokeEllipse(ctx, s, 50 + chainDx * 0.8, 36, 3, 4, '#a8a8a8', 1.5);
    rotated(ctx, s, 54, 40, -20, () => {
      strokeEllipse(ctx, s, 54, 40, 3, 4, '#a8a8a8', 1.5);
    });
    // Wings
    rotated(ctx, s, 24, 30, wingRot, () => {
      ctx.globalAlpha = 0.5;
      ellipse(ctx, s, 24, 30, 4, 3, '#6ba66a');
      ctx.globalAlpha = 1;
    });
    rotated(ctx, s, 48, 30, -wingRot, () => {
      ctx.globalAlpha = 0.5;
      ellipse(ctx, s, 48, 30, 4, 3, '#6ba66a');
      ctx.globalAlpha = 1;
    });
  },
};

// ─── 4. CrystalPet — 水晶球 ────────────────────────────────────────────────

export const drawCrystal: PetDrawConfig = {
  floatDuration: 3200,
  durations: [3000],
  draw(ctx, s, [p0]) {
    const nebulaA1 = 0.1 + Math.sin(p0 * Math.PI * 2) * 0.1;
    const nebulaA2 = 0.08 + Math.sin(p0 * Math.PI * 2 + 2) * 0.08;
    const star1 = 0.5 + Math.sin(p0 * Math.PI * 4) * 0.5;
    const star2 = 0.5 + Math.sin(p0 * Math.PI * 4 + 1.4) * 0.5;
    const star3 = 0.5 + Math.sin(p0 * Math.PI * 4 + 2.8) * 0.5;
    // Base
    ellipse(ctx, s, 36, 56, 14, 4, '#4a3d6e');
    roundRect(ctx, s, 28, 52, 16, 6, 2, '#5a4d7e');
    // Ball — radial gradient
    const grad = ctx.createRadialGradient(32 * s, 29 * s, 0, 36 * s, 36 * s, 16 * s);
    grad.addColorStop(0, '#c8b6ff');
    grad.addColorStop(0.5, '#7b68ee');
    grad.addColorStop(1, '#3d2b6e');
    ctx.beginPath();
    ctx.arc(36 * s, 36 * s, 16 * s, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    // Nebula
    ctx.globalAlpha = nebulaA1;
    circle(ctx, s, 32, 32, 6, 'rgba(200,180,255,0.6)');
    ctx.globalAlpha = nebulaA2;
    circle(ctx, s, 40, 38, 4, 'rgba(255,200,255,0.5)');
    ctx.globalAlpha = 1;
    // Stars
    ctx.globalAlpha = star1;
    circle(ctx, s, 30, 30, 1 * star1 + 0.5, '#fff');
    ctx.globalAlpha = star2;
    circle(ctx, s, 42, 34, 0.8 * star2 + 0.3, '#fff');
    ctx.globalAlpha = star3;
    circle(ctx, s, 35, 40, 0.6 * star3 + 0.2, '#fff');
    ctx.globalAlpha = 1;
    // Highlight
    ctx.save();
    ctx.globalAlpha = 0.25;
    rotated(ctx, s, 30, 28, -30, () => {
      ellipse(ctx, s, 30, 28, 5, 3, '#fff');
    });
    ctx.restore();
  },
};

// ─── 5. DicePet — 骰灵 ─────────────────────────────────────────────────────

export const drawDice: PetDrawConfig = {
  floatDuration: 2500,
  durations: [3000],
  draw(ctx, s, [p0]) {
    const eyeAlpha = 0.6 + Math.sin(p0 * Math.PI * 2) * 0.4;
    const sparkleS = 0.8 + Math.sin(p0 * Math.PI * 4) * 0.5;
    const sparkleA = 0.5 + Math.sin(p0 * Math.PI * 4) * 0.5;
    // Dice body
    roundRect(ctx, s, 18, 18, 36, 36, 6, '#e8e0f0');
    strokeRoundRect(ctx, s, 18, 18, 36, 36, 6, '#9b8ec4', 1.5);
    // Face dots
    circle(ctx, s, 28, 28, 3, '#4a3d6e');
    circle(ctx, s, 44, 28, 3, '#4a3d6e');
    circle(ctx, s, 36, 36, 3, '#4a3d6e');
    circle(ctx, s, 28, 44, 3, '#4a3d6e');
    circle(ctx, s, 44, 44, 3, '#4a3d6e');
    // Cute eyes
    ctx.globalAlpha = eyeAlpha;
    circle(ctx, s, 31, 23, 2.5, '#2d1b4e');
    ctx.globalAlpha = 1;
    ellipse(ctx, s, 41, 23, 2, 2.5, '#2d1b4e');
    // Smile
    ctx.beginPath();
    ctx.moveTo(33 * s, 26 * s);
    ctx.quadraticCurveTo(36 * s, 28.5 * s, 39 * s, 26 * s);
    ctx.strokeStyle = '#2d1b4e';
    ctx.lineWidth = 1 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Sparkle
    ctx.globalAlpha = sparkleA;
    circle(ctx, s, 52, 16, 1.5 * sparkleS, '#ffd700');
    ctx.globalAlpha = 1;
  },
};

// ─── 6. FilmBugPet — 胶片虫 ────────────────────────────────────────────────

export const drawFilmBug: PetDrawConfig = {
  floatDuration: 3000,
  durations: [1200],
  draw(ctx, s, [p0]) {
    const legLdx = Math.sin(p0 * Math.PI * 2) * -2;
    const legRdx = Math.sin(p0 * Math.PI * 2 + Math.PI) * 2;
    // Film strip body
    roundRect(ctx, s, 20, 26, 32, 24, 4, '#3d3d3d');
    // Sprocket holes — top
    for (let i = 0; i < 5; i++) {
      roundRect(ctx, s, 22 + i * 6, 27, 3, 3, 0.5, '#1a1a1a');
    }
    // Sprocket holes — bottom
    for (let i = 0; i < 5; i++) {
      roundRect(ctx, s, 22 + i * 6, 46, 3, 3, 0.5, '#1a1a1a');
    }
    // Frame window
    roundRect(ctx, s, 24, 32, 24, 12, 1, '#5a4a3a');
    // Face
    circle(ctx, s, 32, 37, 2, '#ffd700');
    circle(ctx, s, 40, 37, 2, '#ffd700');
    circle(ctx, s, 32, 37, 1, '#1a1a2e');
    circle(ctx, s, 40, 37, 1, '#1a1a2e');
    ctx.beginPath();
    ctx.moveTo(34 * s, 40 * s);
    ctx.quadraticCurveTo(36 * s, 41.5 * s, 38 * s, 40 * s);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();
    // Antennae
    line(ctx, s, 30, 26, 28, 18, '#5a5a5a', 1);
    circle(ctx, s, 28, 17, 2, '#ffd700');
    line(ctx, s, 42, 26, 44, 18, '#5a5a5a', 1);
    circle(ctx, s, 44, 17, 2, '#ffd700');
    // Legs — left pair
    line(ctx, s, 26, 50, 24 + legLdx, 58 + legLdx, '#3d3d3d', 2);
    line(ctx, s, 32, 50, 30 + legLdx, 58 + legLdx, '#3d3d3d', 2);
    // Legs — right pair
    line(ctx, s, 40, 50, 42 + legRdx, 58 + legRdx, '#3d3d3d', 2);
    line(ctx, s, 46, 50, 48 + legRdx, 58 + legRdx, '#3d3d3d', 2);
  },
};

// ─── 7. HoundPet — 猎犬 ────────────────────────────────────────────────────

export const drawHound: PetDrawConfig = {
  floatDuration: 3000,
  durations: [2000],
  draw(ctx, s, [p0]) {
    const earL = -15 + Math.sin(p0 * Math.PI * 2) * 10;
    const earR = 15 + Math.sin(p0 * Math.PI * 2 + 0.6) * 10;
    const tailWag = Math.sin(p0 * Math.PI * 4) * 6;
    // Body
    ellipse(ctx, s, 36, 46, 16, 12, '#c4956a');
    // Head
    circle(ctx, s, 36, 30, 14, '#d4a574');
    // Ears
    rotated(ctx, s, 24, 20, earL, () => {
      ellipse(ctx, s, 24, 20, 5, 8, '#a67a52');
    });
    rotated(ctx, s, 48, 20, earR, () => {
      ellipse(ctx, s, 48, 20, 5, 8, '#a67a52');
    });
    // Eyes
    circle(ctx, s, 31, 28, 3, '#2d1b1b');
    circle(ctx, s, 41, 28, 3, '#2d1b1b');
    circle(ctx, s, 32, 27, 1, '#fff');
    circle(ctx, s, 42, 27, 1, '#fff');
    // Nose
    ellipse(ctx, s, 36, 33, 3, 2, '#3d2b1b');
    // Magnifying glass
    strokeCircle(ctx, s, 52, 38, 6, '#7b8fa8', 2);
    ctx.globalAlpha = 0.3;
    circle(ctx, s, 52, 38, 4, '#add8e6');
    ctx.globalAlpha = 1;
    line(ctx, s, 56, 42, 60, 48, '#7b8fa8', 2);
    // Tail
    ctx.beginPath();
    ctx.moveTo(52 * s, 46 * s);
    ctx.quadraticCurveTo(58 * s, 38 * s, (56 + tailWag) * s, 44 * s);
    ctx.strokeStyle = '#c4956a';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  },
};

// ─── 8. LuckyStarPet — 幸运星 ──────────────────────────────────────────────

function starPath(
  ctx: CanvasRenderingContext2D,
  s: number,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 72 + 36 - 90) * Math.PI) / 180;
    const ox = cx + Math.cos(outerAngle) * outer;
    const oy = cy + Math.sin(outerAngle) * outer;
    const ix = cx + Math.cos(innerAngle) * inner;
    const iy = cy + Math.sin(innerAngle) * inner;
    if (i === 0) ctx.moveTo(ox * s, oy * s);
    else ctx.lineTo(ox * s, oy * s);
    ctx.lineTo(ix * s, iy * s);
  }
  ctx.closePath();
}

export const drawLuckyStar: PetDrawConfig = {
  floatDuration: 2500,
  durations: [6000, 1500],
  draw(ctx, s, [p0, p1]) {
    const wheelAngle = p0 * 360;
    const sparkle1 = 0.5 + Math.sin(p1! * Math.PI * 4) * 0.5;
    const sparkle2 = 0.5 + Math.sin(p1! * Math.PI * 4 + 1) * 0.5;
    // Star body
    starPath(ctx, s, 36, 36, 24, 10);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#daa520';
    ctx.lineWidth = 1 * s;
    ctx.stroke();
    // Face
    circle(ctx, s, 32, 30, 2, '#8b6508');
    circle(ctx, s, 40, 30, 2, '#8b6508');
    ctx.beginPath();
    ctx.moveTo(33 * s, 34 * s);
    ctx.quadraticCurveTo(36 * s, 36.5 * s, 39 * s, 34 * s);
    ctx.strokeStyle = '#8b6508';
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Belly wheel — spinning
    rotated(ctx, s, 36, 38, wheelAngle, () => {
      strokeCircle(ctx, s, 36, 38, 5, '#daa520', 1);
      line(ctx, s, 36, 33, 36, 43, '#daa520', 0.5);
      line(ctx, s, 31, 38, 41, 38, '#daa520', 0.5);
      line(ctx, s, 32.5, 34.5, 39.5, 41.5, '#daa520', 0.5);
      line(ctx, s, 39.5, 34.5, 32.5, 41.5, '#daa520', 0.5);
    });
    // Sparkles
    ctx.globalAlpha = sparkle1;
    circle(ctx, s, 56, 16, 1.5 * sparkle1 + 0.3, '#fff');
    ctx.globalAlpha = sparkle2;
    circle(ctx, s, 18, 18, 1.0 * sparkle2 + 0.2, '#fff');
    ctx.globalAlpha = 1;
  },
};

// ─── 9. MeteorBuddyPet — 陨石仔 ────────────────────────────────────────────

export const drawMeteorBuddy: PetDrawConfig = {
  floatDuration: 2000,
  durations: [800, 2000],
  draw(ctx, s, [p0, p1]) {
    const flameA1 = 0.7 + Math.sin(p0 * Math.PI * 2) * 0.3;
    const flameRy1 = 10 + Math.sin(p0 * Math.PI * 2) * 1.5;
    const flameA2 = 0.5 + Math.sin(p0 * Math.PI * 2 + 1) * 0.3;
    const flameRy2 = 8 + Math.sin(p0 * Math.PI * 2 + 1) * 1.2;
    const flameA3 = 0.4 + Math.sin(p0 * Math.PI * 2 + 2) * 0.3;
    const flameRy3 = 7 + Math.sin(p0 * Math.PI * 2 + 2) * 1;
    const glowA = 0.2 + Math.sin(p1! * Math.PI * 2) * 0.15;
    // Flames
    ctx.globalAlpha = flameA1;
    ellipse(ctx, s, 36, 58, 8, flameRy1, '#ff6b35');
    ctx.globalAlpha = flameA2;
    ellipse(ctx, s, 33, 60, 5, flameRy2, '#ff9a3c');
    ctx.globalAlpha = flameA3;
    ellipse(ctx, s, 39, 59, 4, flameRy3, '#ffcc02');
    ctx.globalAlpha = 1;
    // Meteor body — radial gradient
    const grad = ctx.createRadialGradient(30 * s, 26 * s, 0, 36 * s, 34 * s, 16 * s);
    grad.addColorStop(0, '#c4a882');
    grad.addColorStop(1, '#6b5340');
    ctx.beginPath();
    ctx.arc(36 * s, 34 * s, 16 * s, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    // Craters
    circle(ctx, s, 30, 38, 3, 'rgba(0,0,0,0.15)');
    circle(ctx, s, 42, 32, 2, 'rgba(0,0,0,0.1)');
    circle(ctx, s, 34, 44, 2, 'rgba(0,0,0,0.1)');
    // Face
    circle(ctx, s, 31, 31, 2.5, '#fff');
    circle(ctx, s, 41, 31, 2.5, '#fff');
    circle(ctx, s, 31.5, 31, 1.5, '#1a1a2e');
    circle(ctx, s, 41.5, 31, 1.5, '#1a1a2e');
    ctx.beginPath();
    ctx.moveTo(34 * s, 36 * s);
    ctx.quadraticCurveTo(36 * s, 38 * s, 38 * s, 36 * s);
    ctx.strokeStyle = '#4a3628';
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Glow ring
    ctx.globalAlpha = glowA;
    strokeCircle(ctx, s, 36, 34, 18, '#ff9a3c', 0.5);
    ctx.globalAlpha = 1;
  },
};

// ─── 10. ScratchCatPet — 刮刮猫 ────────────────────────────────────────────

export const drawScratchCat: PetDrawConfig = {
  floatDuration: 2800,
  durations: [1500],
  draw(ctx, s, [p0]) {
    const pawDy = -Math.sin(p0 * Math.PI * 2) * 3;
    // Body
    ellipse(ctx, s, 36, 50, 14, 10, '#f5deb3');
    // Head
    circle(ctx, s, 36, 32, 14, '#ffe4b5');
    // Ears outer
    polygon(
      ctx,
      s,
      [
        [24, 22],
        [20, 10],
        [30, 18],
      ],
      '#ffcc80',
    );
    polygon(
      ctx,
      s,
      [
        [48, 22],
        [52, 10],
        [42, 18],
      ],
      '#ffcc80',
    );
    // Ears inner
    polygon(
      ctx,
      s,
      [
        [25, 21],
        [22, 13],
        [29, 18],
      ],
      '#ffb6c1',
    );
    polygon(
      ctx,
      s,
      [
        [47, 21],
        [50, 13],
        [43, 18],
      ],
      '#ffb6c1',
    );
    // Eyes
    ellipse(ctx, s, 31, 30, 2.5, 3, '#2d4a1b');
    ellipse(ctx, s, 41, 30, 2.5, 3, '#2d4a1b');
    circle(ctx, s, 31.5, 29.5, 0.8, '#fff');
    circle(ctx, s, 41.5, 29.5, 0.8, '#fff');
    // Nose + mouth
    ellipse(ctx, s, 36, 35, 2, 1.5, '#ffb6c1');
    ctx.beginPath();
    ctx.moveTo(34 * s, 36.5 * s);
    ctx.quadraticCurveTo(36 * s, 38 * s, 38 * s, 36.5 * s);
    ctx.strokeStyle = '#c48a6e';
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();
    // Whiskers
    line(ctx, s, 18, 33, 28, 34, '#c4a882', 0.5);
    line(ctx, s, 18, 36, 28, 36, '#c4a882', 0.5);
    line(ctx, s, 54, 33, 44, 34, '#c4a882', 0.5);
    line(ctx, s, 54, 36, 44, 36, '#c4a882', 0.5);
    // Paw
    ellipse(ctx, s, 22, 46 + pawDy, 5, 4, '#ffe4b5');
    // Coin
    circle(ctx, s, 18, 42, 5, '#ffd700');
    strokeCircle(ctx, s, 18, 42, 5, '#daa520', 1);
    ctx.font = `bold ${6 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b8860b';
    ctx.fillText('¥', 18 * s, 42 * s);
  },
};

// ─── 11. SealBeastPet — 印兽 ────────────────────────────────────────────────

export const drawSealBeast: PetDrawConfig = {
  floatDuration: 3000,
  durations: [2500],
  draw(ctx, s, [p0]) {
    const eyeLA = 0.6 + Math.sin(p0 * Math.PI * 2) * 0.4;
    const eyeRA = 0.6 + Math.sin(p0 * Math.PI * 2 + 1) * 0.4;
    const runeA = 0.3 + Math.sin(p0 * Math.PI * 2 + 1) * 0.3;
    // Talisman paper
    roundRect(ctx, s, 22, 42, 28, 20, 2, '#f5e6c8');
    strokeRoundRect(ctx, s, 22, 42, 28, 20, 2, '#c4956a', 1);
    // Rune text
    ctx.font = `bold ${10 * s}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8b0000';
    ctx.fillText('封', 36 * s, 55 * s);
    // Rune glow
    ctx.globalAlpha = runeA;
    circle(ctx, s, 36, 48, 14, 'rgba(200,0,0,0.1)');
    ctx.globalAlpha = 1;
    // Beast body
    ellipse(ctx, s, 36, 36, 12, 10, '#6c7b95');
    // Head
    circle(ctx, s, 36, 26, 10, '#7b8da8');
    // Horn
    polygon(
      ctx,
      s,
      [
        [36, 14],
        [33, 22],
        [39, 22],
      ],
      '#a8c4d8',
    );
    // Eyes
    ctx.globalAlpha = eyeLA;
    circle(ctx, s, 32, 24, 2.5, '#ffd700');
    ctx.globalAlpha = eyeRA;
    circle(ctx, s, 40, 24, 2.5, '#ffd700');
    ctx.globalAlpha = 1;
    circle(ctx, s, 32, 24, 1.2, '#1a1a2e');
    circle(ctx, s, 40, 24, 1.2, '#1a1a2e');
    // Mouth
    ctx.beginPath();
    ctx.moveTo(33 * s, 29 * s);
    ctx.quadraticCurveTo(36 * s, 31 * s, 39 * s, 29 * s);
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  },
};

// ─── 12. VortexEyePet — 漩涡眼 ─────────────────────────────────────────────

export const drawVortexEye: PetDrawConfig = {
  floatDuration: 2500,
  durations: [3000, 2000],
  draw(ctx, s, [p0, p1]) {
    const irisAngle = p0 * 360;
    const wobbleT = p1! * Math.PI * 2;
    // Body blob
    ellipse(ctx, s, 36, 40, 18, 14, '#4a148c');
    // Tentacles
    const tentacles = [
      { x1: 22, y1: 48, phase: 0 },
      { x1: 28, y1: 50, phase: 0.6 },
      { x1: 44, y1: 50, phase: 1.2 },
      { x1: 50, y1: 48, phase: 1.8 },
    ];
    ctx.strokeStyle = '#6a1b9a';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    for (const tent of tentacles) {
      const w = Math.sin(wobbleT + tent.phase) * 3;
      const mirror = tent.x1 < 36 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(tent.x1 * s, tent.y1 * s);
      ctx.quadraticCurveTo(
        (tent.x1 + mirror * -4 + w) * s,
        (tent.y1 + 8) * s,
        (tent.x1 + w) * s,
        (tent.y1 + 10) * s,
      );
      ctx.stroke();
    }
    // Big eye
    circle(ctx, s, 36, 36, 12, '#e8e0f0');
    circle(ctx, s, 36, 36, 10, '#fff');
    // Vortex iris — spinning
    rotated(ctx, s, 36, 36, irisAngle, () => {
      circle(ctx, s, 36, 36, 7, '#7b1fa2');
      // Four vortex petals
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#9c27b0';
      // Top
      ctx.beginPath();
      ctx.moveTo(36 * s, 29 * s);
      ctx.quadraticCurveTo(40 * s, 33 * s, 36 * s, 36 * s);
      ctx.quadraticCurveTo(32 * s, 33 * s, 36 * s, 29 * s);
      ctx.fill();
      // Right
      ctx.beginPath();
      ctx.moveTo(43 * s, 36 * s);
      ctx.quadraticCurveTo(39 * s, 40 * s, 36 * s, 36 * s);
      ctx.quadraticCurveTo(39 * s, 32 * s, 43 * s, 36 * s);
      ctx.fill();
      // Bottom
      ctx.beginPath();
      ctx.moveTo(36 * s, 43 * s);
      ctx.quadraticCurveTo(32 * s, 39 * s, 36 * s, 36 * s);
      ctx.quadraticCurveTo(40 * s, 39 * s, 36 * s, 43 * s);
      ctx.fill();
      // Left
      ctx.beginPath();
      ctx.moveTo(29 * s, 36 * s);
      ctx.quadraticCurveTo(33 * s, 32 * s, 36 * s, 36 * s);
      ctx.quadraticCurveTo(33 * s, 40 * s, 29 * s, 36 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // Pupil + highlight
    circle(ctx, s, 36, 36, 3, '#1a1a2e');
    circle(ctx, s, 37, 35, 1, '#fff');
  },
};
