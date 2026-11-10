/**
 * Draws the capsule machine on the stage overlay root with PixiJS Graphics: a static machine
 * drawn once, and per-frame layers for the balls, gate, chute and particles. The physics runs in
 * 400x600 reference coordinates; `setLayout` scales the root to the canvas host.
 */
import { type Container, Graphics } from 'pixi.js';

import {
  BALL_COLORS,
  BODY_B,
  BODY_L,
  BODY_R,
  BODY_T,
  CHUTE_BOT,
  CHUTE_TOP,
  DIAL_Y,
  DOME_CX,
  DOME_CY,
  DOME_R,
  FLOOR_Y,
  HOLE_CX,
  HOLE_HALF_W,
  HOLE_Y,
  MACHINE,
  NUM_BALLS,
  REF_H,
  REF_W,
} from './gachaConstants';
import {
  BALL_STRIDE,
  F_ESCAPED,
  F_OPENED,
  type GachaPhysics,
  SHELL_STRIDE,
  SPARKLE_STRIDE,
} from './gachaPhysics';

/** Sparkle colours by rarity index (common, rare, epic, legendary, mythic). */
const SPARKLE_COLORS = ['#9E9E9E', '#4A90D9', '#9B59B6', '#F5A623', '#C73D5C'];
const WHITE = '#FFFFFF';
const BALL_CENTER_LINE = 'rgba(0,0,0,0.15)';
const BALL_OUTLINE = 'rgba(0,0,0,0.12)';
const BALL_HIGHLIGHT = 'rgba(255,255,255,0.3)';
const BALL_RING = 'rgba(255,255,255,0.2)';

function color(colors: readonly string[], index: number): string {
  const value = colors[index % colors.length];
  if (value === undefined) {
    throw new Error(`Capsule colour ${index} is missing`);
  }
  return value;
}

function drawBall(graphics: Graphics, x: number, y: number, radius: number, ballIndex: number) {
  graphics
    .moveTo(x, y)
    .arc(x, y, radius, Math.PI, Math.PI * 2)
    .closePath()
    .fill(color(BALL_COLORS, ballIndex));
  graphics.moveTo(x, y).arc(x, y, radius, 0, Math.PI).closePath().fill(WHITE);
  graphics
    .moveTo(x - radius, y)
    .lineTo(x + radius, y)
    .stroke({ color: BALL_CENTER_LINE, width: 1.5 });
  graphics.circle(x - radius * 0.28, y - radius * 0.35, radius * 0.22).fill(BALL_HIGHLIGHT);
  graphics.circle(x, y - radius * 0.08, radius * 0.28).stroke({ color: BALL_RING, width: 1.5 });
  graphics.circle(x, y, radius).stroke({ color: BALL_OUTLINE, width: 1 });
}

function drawBackdrop(graphics: Graphics): void {
  const centerX = REF_W / 2;
  const glowY = REF_H * 0.32;
  graphics.rect(0, 0, REF_W, REF_H).fill(MACHINE.bg);
  graphics.circle(centerX, glowY, REF_H * 0.55).fill({ color: MACHINE.bgLight, alpha: 0.2 });
  graphics.circle(centerX, glowY, REF_H * 0.35).fill({ color: MACHINE.bgLight, alpha: 0.35 });
  graphics.circle(centerX, glowY, REF_H * 0.2).fill({ color: MACHINE.bgLight, alpha: 0.15 });
  graphics.rect(0, FLOOR_Y, REF_W, REF_H - FLOOR_Y).fill(MACHINE.floor);
  graphics
    .moveTo(30, FLOOR_Y)
    .lineTo(REF_W - 30, FLOOR_Y)
    .stroke({ color: MACHINE.floorLine, width: 1 });
  graphics.ellipse(centerX, BODY_B + 24, 148, 14).fill(MACHINE.shadow);
  graphics
    .roundRect(BODY_L, BODY_T, BODY_R - BODY_L, BODY_B - BODY_T, 6)
    .fill(MACHINE.bodyMid)
    .stroke({ color: MACHINE.bodyEdge, width: 2 });
}

/** The glass over the dome balls: outline, tint, inner shadow and highlights. */
function drawGlass(graphics: Graphics): void {
  graphics.circle(DOME_CX, DOME_CY, DOME_R).stroke({ color: MACHINE.domeStroke, width: 3 });
  graphics.circle(DOME_CX, DOME_CY, DOME_R).fill(MACHINE.dome);
  graphics
    .circle(DOME_CX, DOME_CY, DOME_R - 3)
    .stroke({ color: MACHINE.domeStroke, width: 6, alpha: 0.08 });
  graphics.ellipse(DOME_CX - 55, DOME_CY - 15, 16, 72).fill('rgba(255,255,255,0.13)');
  graphics.ellipse(DOME_CX + 45, DOME_CY - 55, 10, 22).fill('rgba(255,255,255,0.07)');
  graphics.ellipse(DOME_CX, DOME_CY + 75, 60, 25).fill('rgba(255,255,255,0.06)');
  graphics.circle(DOME_CX - 10, DOME_CY - 65, 8).fill({ color: WHITE, alpha: 0.12 });
}

function drawDialAndFeet(graphics: Graphics): void {
  const dialX = REF_W / 2;
  graphics
    .circle(dialX, DIAL_Y, 32)
    .fill(MACHINE.dialBody)
    .stroke({ color: MACHINE.dialStroke, width: 2 });
  graphics.circle(dialX, DIAL_Y - 23, 8).fill(MACHINE.dialHighlight);
  graphics.circle(dialX - 1, DIAL_Y - 22, 3).fill(MACHINE.dialKnob);
  graphics
    .moveTo(dialX - 9, DIAL_Y)
    .lineTo(dialX + 9, DIAL_Y)
    .moveTo(dialX, DIAL_Y - 9)
    .lineTo(dialX, DIAL_Y + 9)
    .stroke({ color: 'rgba(255,255,255,0.12)', width: 2 });
  graphics.roundRect(BODY_L + 18, BODY_B, 28, 22, 3).fill(MACHINE.body);
  graphics.roundRect(BODY_R - 46, BODY_B, 28, 22, 3).fill(MACHINE.body);
}

/** The machine's Pixi layers, redrawn from `physics` on every `render`. */
export class CapsuleMachineRenderer {
  private readonly domeBalls = new Graphics();
  private readonly chute = new Graphics();
  private readonly front = new Graphics();

  constructor(
    readonly root: Container,
    private readonly physics: GachaPhysics,
  ) {
    const backdrop = new Graphics();
    drawBackdrop(backdrop);
    const domeMask = new Graphics().circle(DOME_CX, DOME_CY, DOME_R).fill(WHITE);
    this.domeBalls.mask = domeMask;
    const glass = new Graphics();
    drawGlass(glass);
    const dial = new Graphics();
    drawDialAndFeet(dial);
    root.addChild(backdrop, domeMask, this.domeBalls, glass, this.chute, dial, this.front);
  }

  /** Scales the reference drawing to a canvas host `width` CSS pixels wide. */
  setLayout(width: number): void {
    this.root.scale.set(width / REF_W);
  }

  render(): void {
    const { physics } = this;
    const data = physics.balls;
    this.domeBalls.clear();
    this.front.clear();
    for (let i = 0; i < NUM_BALLS; i++) {
      const base = i * BALL_STRIDE;
      const flags = data[base + 5] ?? 0;
      if ((flags & F_OPENED) !== 0) continue;
      const target = (flags & F_ESCAPED) !== 0 ? this.front : this.domeBalls;
      drawBall(target, data[base] ?? 0, data[base + 1] ?? 0, data[base + 4] ?? 0, i);
    }

    this.chute.clear();
    if (physics.gateOpen) {
      this.chute.rect(HOLE_CX - HOLE_HALF_W, HOLE_Y - 4, HOLE_HALF_W * 2, 8).fill(MACHINE.gate);
    }
    const chuteHalfWidth = physics.gateOpen ? 40 : 28;
    const centerX = REF_W / 2;
    this.chute
      .moveTo(centerX - chuteHalfWidth, CHUTE_TOP)
      .lineTo(centerX - chuteHalfWidth + 4, CHUTE_BOT)
      .quadraticCurveTo(centerX, CHUTE_BOT + 12, centerX + chuteHalfWidth - 4, CHUTE_BOT)
      .lineTo(centerX + chuteHalfWidth, CHUTE_TOP)
      .closePath()
      .fill(MACHINE.chute)
      .stroke({ color: MACHINE.chuteStroke, width: 1.5 });

    this.drawParticles();
    if (physics.flashAlpha > 0.01) {
      this.front.rect(0, 0, REF_W, REF_H).fill({ color: WHITE, alpha: physics.flashAlpha });
    }
  }

  private drawParticles(): void {
    const shells = this.physics.shellPieces;
    for (let i = 0; i < shells.length; i += SHELL_STRIDE) {
      const alpha = shells[i + 7] ?? 0;
      if (alpha <= 0) continue;
      const colorIndex = shells[i + 8] ?? -1;
      this.front.circle(shells[i] ?? 0, shells[i + 1] ?? 0, shells[i + 4] ?? 0).fill({
        color: colorIndex < 0 ? WHITE : color(BALL_COLORS, colorIndex),
        alpha,
      });
    }
    const sparkles = this.physics.sparkles;
    for (let i = 0; i < sparkles.length; i += SPARKLE_STRIDE) {
      const life = sparkles[i + 4] ?? 0;
      if (life <= 0) continue;
      const x = sparkles[i] ?? 0;
      const y = sparkles[i + 1] ?? 0;
      const size = (sparkles[i + 5] ?? 0) * life;
      const sparkleColor = color(SPARKLE_COLORS, sparkles[i + 6] ?? 0);
      const arm = size * 1.8;
      this.front.circle(x, y, size * 0.5).fill({ color: sparkleColor, alpha: life });
      this.front
        .moveTo(x - arm, y)
        .lineTo(x + arm, y)
        .moveTo(x, y - arm)
        .lineTo(x, y + arm)
        .stroke({ color: sparkleColor, width: 1, alpha: life });
    }
  }
}
