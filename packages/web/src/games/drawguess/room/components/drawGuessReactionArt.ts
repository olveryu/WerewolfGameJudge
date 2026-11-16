import type { DrawGuessReaction } from '@game-judge/game-engine/games/drawguess/public';

import { reactionArtColors as palette } from '@/theme/colors';

export interface DrawGuessReactionMessage {
  readonly kind: DrawGuessReaction;
  readonly sender: string;
}

interface ReactionParticle {
  readonly index: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly radius: number;
  readonly spin: number;
}

export interface DrawGuessReactionAnimation extends DrawGuessReactionMessage {
  readonly startedAt: number;
  readonly particles: readonly ReactionParticle[];
}

function ellipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string,
  rotation = 0,
): void {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
}

function paintGift(
  context: CanvasRenderingContext2D,
  kind: DrawGuessReaction,
  x: number,
  y: number,
  size: number,
  rotation = 0,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(size / 64, size / 64);
  if (kind === 'tomato') {
    ellipse(context, 0, 3, 26, 23, palette.tomato);
    ellipse(context, -8, -4, 12, 14, palette.tomatoLight);
    ellipse(context, -11, -9, 5, 3, palette.tomatoHighlight, -0.5);
    for (let leaf = 0; leaf < 5; leaf += 1) {
      const angle = (leaf / 5) * Math.PI * 2;
      ellipse(
        context,
        Math.cos(angle) * 9,
        -17 + Math.sin(angle) * 5,
        11,
        3.5,
        palette.leaf,
        angle,
      );
    }
    context.strokeStyle = palette.stem;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -17);
    context.quadraticCurveTo(-3, -26, 5, -29);
    context.stroke();
  } else if (kind === 'egg') {
    context.beginPath();
    context.moveTo(0, -29);
    context.bezierCurveTo(22, -29, 33, 18, 17, 26);
    context.bezierCurveTo(-5, 40, -33, 23, -22, -2);
    context.bezierCurveTo(-16, -18, -9, -29, 0, -29);
    context.fillStyle = palette.shell;
    context.fill();
    ellipse(context, -5, -4, 14, 21, palette.shellLight, 0.15);
    ellipse(context, -10, -11, 4, 9, palette.shellHighlight, 0.25);
  } else {
    context.strokeStyle = palette.flowerStem;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, -3);
    context.quadraticCurveTo(-6, 12, 2, 30);
    context.stroke();
    ellipse(context, 10, 15, 11, 4, palette.flowerLeaf, -0.55);
    ellipse(context, -8, 21, 10, 4, palette.flowerStem, 0.55);
    for (let petal = 0; petal < 7; petal += 1) {
      const angle = (petal / 7) * Math.PI * 2;
      ellipse(
        context,
        Math.cos(angle) * 13,
        -12 + Math.sin(angle) * 13,
        11,
        7,
        petal % 2 ? palette.petalLight : palette.petal,
        angle,
      );
    }
    ellipse(context, 0, -12, 8, 8, palette.pollen);
    ellipse(context, -2, -14, 3, 3, palette.pollenHighlight);
  }
  context.restore();
}

function paintImpact(
  context: CanvasRenderingContext2D,
  animation: DrawGuessReactionAnimation,
  age: number,
): void {
  const { kind, particles } = animation;
  const bloom = Math.min(1, age / 160);
  const fade = Math.max(0, Math.min(1, (2400 - age) / 650));
  context.save();
  context.globalAlpha = fade;
  if (kind === 'flower') {
    paintGift(context, kind, -24, 4, 82 * bloom, -0.35);
    paintGift(context, kind, 18, -5, 94 * bloom, 0.3);
    paintGift(context, kind, 0, -18, 102 * bloom);
  } else {
    context.save();
    context.scale(bloom, bloom);
    const stain = kind === 'tomato' ? palette.tomatoStain : palette.white;
    for (let lobe = 0; lobe < 9; lobe += 1) {
      const angle = (lobe / 9) * Math.PI * 2;
      ellipse(
        context,
        Math.cos(angle) * 23,
        Math.sin(angle) * 20,
        23 + (lobe % 3) * 5,
        16,
        stain,
        angle,
      );
    }
    ellipse(context, 0, 0, 39, 31, stain);
    if (kind === 'egg') {
      ellipse(context, 0, 1, 23, 21, palette.yolk);
      ellipse(context, -6, -6, 10, 6, palette.yolkLight, -0.5);
    } else {
      ellipse(context, -10, -9, 17, 9, palette.tomatoSplatLight, -0.5);
    }
    for (let drip = 0; drip < 3; drip += 1) {
      const length = Math.min(36, age / 50) * (1 - drip * 0.18);
      ellipse(context, drip * 18 - 18, 24 + length / 2, 3.5, 7 + length / 2, stain);
    }
    context.restore();
  }
  for (const particle of particles) {
    const seconds = age / 1000;
    const x = particle.velocityX * seconds;
    const y = particle.velocityY * seconds + 140 * seconds * seconds;
    context.globalAlpha = fade * Math.max(0, 1 - age / (kind === 'flower' ? 1700 : 1100));
    if (kind === 'egg' && particle.index % 3 === 0) {
      context.save();
      context.translate(x, y);
      context.rotate(seconds * particle.spin);
      context.fillStyle = palette.shellParticle;
      context.beginPath();
      context.moveTo(-7, -5);
      context.lineTo(7, -3);
      context.lineTo(2, 8);
      context.closePath();
      context.fill();
      context.restore();
    } else {
      const color =
        kind === 'tomato'
          ? palette.tomatoStain
          : kind === 'egg'
            ? palette.yolkParticle
            : particle.index % 2
              ? palette.petalParticleLight
              : palette.petalParticle;
      ellipse(
        context,
        x,
        y,
        particle.radius,
        kind === 'flower' ? particle.radius * 0.55 : particle.radius,
        color,
        seconds * particle.spin,
      );
    }
  }
  context.restore();
}

/** Paints the arc and spin before a splat, cracked egg or flower bloom. */
export function paintDrawGuessReaction(
  context: CanvasRenderingContext2D,
  animation: DrawGuessReactionAnimation,
  elapsed: number,
  width: number,
  height: number,
  reducedMotion: boolean,
): void {
  const { kind } = animation;
  const targetX = width * (kind === 'flower' ? 0.5 : kind === 'egg' ? 0.45 : 0.62);
  const targetY = height * 0.48;
  if (reducedMotion) {
    paintGift(context, kind, targetX, targetY, 76);
  } else if (elapsed < 650) {
    const progress = elapsed / 650;
    const startX = width * 0.16;
    const startY = height + 40;
    const x = startX + (targetX - startX) * progress;
    const y =
      startY +
      (targetY - startY) * progress -
      Math.sin(progress * Math.PI) * Math.min(100, height * 0.3);
    paintGift(context, kind, x, y, 42 + progress * 28, progress * 5);
  } else {
    context.save();
    context.translate(targetX, targetY);
    paintImpact(context, animation, elapsed - 650);
    context.restore();
  }
}
