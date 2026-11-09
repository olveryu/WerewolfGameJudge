/**
 * Legendary seat entrances (the role-themed choreographies), ports of the previous client's
 * `seatAnimations/legendary` components. All effects sit behind the avatar inside the square
 * animation box.
 */
import { svgPath } from '@/scene/art';
import { type EntranceSpec, pose } from '@/scene/entrance';
import { Easing, settleMs, track, withDelay, withSequence, withTiming } from '@/scene/timeline';

import { fillCircle, fillPath, fillRect, strokeCircle, strokeEllipse, strokeLine } from './draw';

const LEGENDARY_DURATION = 4000;
const outCubic = Easing.out(Easing.cubic);

/** The avatar reveal shared by most legendaries: opacity after `delayMs`. */
function revealTrack(delayMs: number, durationMs: number, easing = outCubic) {
  return track(0, withDelay(delayMs, withTiming(1, { duration: durationMs, easing })));
}

export function bloodMoonRise(): EntranceSpec {
  const moonY = track(
    1,
    withTiming(0.25, { duration: LEGENDARY_DURATION * 0.59, easing: outCubic }),
  );
  const eclipse = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.41,
      withSequence(
        withTiming(1, { duration: LEGENDARY_DURATION * 0.24 }),
        withTiming(0.5, { duration: LEGENDARY_DURATION * 0.18 }),
      ),
    ),
  );
  const mist = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.24,
      withSequence(
        withTiming(0.3, { duration: LEGENDARY_DURATION * 0.35 }),
        withTiming(0, { duration: LEGENDARY_DURATION * 0.47 }),
      ),
    ),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.53, LEGENDARY_DURATION * 0.47);
  return {
    id: 'bloodMoonRise',
    completeMs: reveal.endMs,
    settleMs: settleMs(moonY, eclipse, mist, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.7 + o * 0.3 })];
    },
    beneath: (context, ms, size) => {
      const o = reveal.at(ms);
      const cy = moonY.at(ms) * size;
      const ring = eclipse.at(ms);
      fillCircle(context, size / 2, size / 2, size * 0.4, 'rgb(80,0,0)', mist.at(ms));
      fillCircle(context, size / 2, cy, size * 0.12, 'rgb(180,30,30)', (1 - o) * 0.8);
      strokeCircle(context, size / 2, cy, size * 0.16 * ring, {
        color: 'rgb(220,50,50)',
        width: 2,
        opacity: ring * (1 - o) * 0.5,
      });
    },
  };
}

const CARD_BACK_BG = 'rgb(60,40,100)';
const CARD_FRONT_BG = 'rgb(240,230,200)';
const CARD_BORDER = 'rgb(180,150,80)';
const CARD_RADIUS = 8;
const CARD_BORDER_WIDTH = 2;
const SPARKLES = 8;

export function cardReveal(): EntranceSpec {
  const flip = track(
    0,
    withTiming(1, { duration: LEGENDARY_DURATION * 0.75, easing: Easing.inOut(Easing.cubic) }),
  );
  const sparkle = track(
    0,
    withDelay(LEGENDARY_DURATION * 0.31, withTiming(1, { duration: LEGENDARY_DURATION * 0.5 })),
  );
  const cardFade = track(
    1,
    withDelay(LEGENDARY_DURATION * 0.63, withTiming(0, { duration: LEGENDARY_DURATION * 0.31 })),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.56, LEGENDARY_DURATION * 0.44);
  return {
    id: 'cardReveal',
    completeMs: reveal.endMs,
    settleMs: settleMs(flip, sparkle, cardFade, reveal),
    clip: 'square',
    avatar: (ms) => [pose({ opacity: reveal.at(ms) })],
    beneath: (context, ms, size) => {
      const p = flip.at(ms);
      const fade = cardFade.at(ms);
      const width = size * 0.7;
      const height = size * 0.9;
      const card = (rotateDeg: number, fill: string, opacity: number) => {
        // Turned about its vertical centre line; the 800 px perspective is negligible at seat size.
        const squeeze = Math.abs(Math.cos((rotateDeg * Math.PI) / 180));
        if (opacity <= 0 || squeeze === 0) return;
        context.save();
        context.setTransform(squeeze, 0, 0, 1, size / 2, size * 0.05);
        const left = -width / 2;
        fillRect(context, left, 0, width, height, CARD_BORDER, opacity, CARD_RADIUS);
        fillRect(
          context,
          left + CARD_BORDER_WIDTH,
          CARD_BORDER_WIDTH,
          width - CARD_BORDER_WIDTH * 2,
          height - CARD_BORDER_WIDTH * 2,
          fill,
          opacity,
          CARD_RADIUS - CARD_BORDER_WIDTH,
        );
        context.restore();
      };
      const backRotate = p * 180;
      card(backRotate, CARD_BACK_BG, backRotate < 90 ? fade : 0);
      card(p * 180 - 180, CARD_FRONT_BG, p > 0.5 ? fade : 0);
      const t = sparkle.at(ms);
      for (let i = 0; i < SPARKLES; i += 1) {
        const angle = (i / SPARKLES) * Math.PI * 2;
        const dist = t * size * 0.35;
        fillCircle(
          context,
          size / 2 + Math.cos(angle) * dist,
          size / 2 + Math.sin(angle) * dist,
          size * 0.015 * (1 - t * 0.7),
          i % 2 === 0 ? 'rgb(255,220,80)' : 'rgb(255,180,50)',
          t > 0.05 ? (1 - t) * 0.8 : 0,
        );
      }
    },
  };
}

const RAYS = 5;

export function dawnBreak(): EntranceSpec {
  const rays = track(0, withTiming(1, { duration: LEGENDARY_DURATION * 0.67, easing: outCubic }));
  const glow = track(
    0,
    withSequence(
      withTiming(0.5, { duration: LEGENDARY_DURATION * 0.53 }),
      withTiming(0, { duration: LEGENDARY_DURATION * 0.4 }),
    ),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.47, LEGENDARY_DURATION * 0.53);
  return {
    id: 'dawnBreak',
    completeMs: reveal.endMs,
    settleMs: settleMs(rays, glow, reveal),
    clip: 'square',
    avatar: (ms, size) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, translateY: (1 - o) * size * 0.08 })];
    },
    beneath: (context, ms, size) => {
      fillCircle(context, size / 2, size * 0.85, size * 0.4, 'rgb(255,200,80)', glow.at(ms));
      const t = rays.at(ms);
      for (let i = 0; i < RAYS; i += 1) {
        const spread = (i / (RAYS - 1) - 0.5) * 1.2;
        const bx = size / 2 + spread * size * 0.3;
        const tx = size / 2 + spread * size * 0.5;
        const ty = size * (1 - t * 0.9);
        const w = size * 0.04 * (1 - t * 0.3);
        fillPath(
          context,
          `M ${bx - w} ${size} L ${tx} ${ty} L ${bx + w} ${size} Z`,
          'rgb(255,220,100)',
          t * (1 - Math.max(0, (t - 0.6) / 0.4)) * 0.5,
        );
      }
    },
  };
}

const SHIELD_SEGMENTS = 6;

export function guardShield(): EntranceSpec {
  const assemble = track(
    0,
    withTiming(1, { duration: LEGENDARY_DURATION * 0.42, easing: outCubic }),
  );
  const glow = track(
    0,
    withDelay(LEGENDARY_DURATION * 0.42, withTiming(0.6, { duration: LEGENDARY_DURATION * 0.21 })),
  );
  const shatter = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.63,
      withTiming(1, { duration: LEGENDARY_DURATION * 0.32, easing: Easing.out(Easing.quad) }),
    ),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.63, LEGENDARY_DURATION * 0.37);
  return {
    id: 'guardShield',
    completeMs: reveal.endMs,
    settleMs: settleMs(assemble, glow, shatter, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.7 + o * 0.3 })];
    },
    beneath: (context, ms, size) => {
      const assembleT = assemble.at(ms);
      const shatterT = shatter.at(ms);
      fillCircle(
        context,
        size / 2,
        size / 2,
        size * 0.25,
        'rgb(255,230,100)',
        glow.at(ms) * (1 - shatterT),
      );
      const opacity = assembleT * (1 - shatterT) * 0.6;
      const r = size * 0.35;
      const inR = size * 0.15;
      const offset = (1 - assembleT) * size * 0.3 + shatterT * size * 0.5;
      for (let i = 0; i < SHIELD_SEGMENTS; i += 1) {
        const angle = (i / SHIELD_SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((i + 1) / SHIELD_SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        const midAngle = (angle + nextAngle) / 2;
        const cx = size / 2 + Math.cos(midAngle) * offset;
        const cy = size / 2 + Math.sin(midAngle) * offset;
        const d =
          `M ${cx + Math.cos(angle) * r} ${cy + Math.sin(angle) * r} ` +
          `L ${cx + Math.cos(nextAngle) * r} ${cy + Math.sin(nextAngle) * r} ` +
          `L ${cx + Math.cos(nextAngle) * inR} ${cy + Math.sin(nextAngle) * inR} ` +
          `L ${cx + Math.cos(angle) * inR} ${cy + Math.sin(angle) * inR} Z`;
        if (opacity <= 0) continue;
        // Fill and 1 px stroke under one element opacity.
        context.path(svgPath(d)).fill({ color: 'rgb(220,180,50)', alpha: Math.min(1, opacity) });
        context.stroke({
          color: 'rgb(180,140,30)',
          width: 1,
          alpha: Math.min(1, opacity),
          miterLimit: 4,
        });
      }
    },
  };
}

export function hunterShot(): EntranceSpec {
  const aim = track(0, withTiming(1, { duration: LEGENDARY_DURATION * 0.47, easing: outCubic }));
  const flash = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.47,
      withSequence(
        withTiming(1, { duration: LEGENDARY_DURATION * 0.11 }),
        withTiming(0, { duration: LEGENDARY_DURATION * 0.2 }),
      ),
    ),
  );
  const wave = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.53,
      withTiming(1, { duration: LEGENDARY_DURATION * 0.47, easing: outCubic }),
    ),
  );
  const reveal = track(
    0,
    withDelay(LEGENDARY_DURATION * 0.53, withTiming(1, { duration: LEGENDARY_DURATION * 0.47 })),
  );
  return {
    id: 'hunterShot',
    completeMs: reveal.endMs,
    settleMs: settleMs(aim, flash, wave, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.8 + o * 0.2 })];
    },
    beneath: (context, ms, size) => {
      const c = size / 2;
      const r = size * 0.3 * (2 - aim.at(ms));
      const w = wave.at(ms);
      const cross = { color: 'rgb(255,80,80)', width: 1.5, opacity: (1 - w) * 0.6 };
      strokeLine(context, c, c - r, c, c + r, cross);
      strokeLine(context, c - r, c, c + r, c, cross);
      const f = flash.at(ms);
      fillCircle(context, c, c, size * 0.15 * f, 'rgb(255,255,200)', f * 0.8);
      strokeCircle(context, c, c, w * size * 0.5, {
        color: 'rgb(255,200,100)',
        width: 2,
        opacity: (1 - w) * 0.4,
      });
    },
  };
}

const NIGHT_STARS = Array.from({ length: 6 }, (_, i) => ({
  x: 0.15 + Math.sin(i * 2.3) * 0.3 + 0.35,
  y: 0.1 + (i / 6) * 0.5,
  delay: i * 0.08,
}));

export function nightFall(): EntranceSpec {
  const darkness = track(
    0,
    withTiming(1, { duration: LEGENDARY_DURATION * 0.3, easing: outCubic }),
  );
  const stars = track(
    0,
    withDelay(LEGENDARY_DURATION * 0.2, withTiming(1, { duration: LEGENDARY_DURATION * 0.4 })),
  );
  const moon = track(
    0,
    withDelay(LEGENDARY_DURATION * 0.4, withTiming(0.7, { duration: LEGENDARY_DURATION * 0.25 })),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.65, LEGENDARY_DURATION * 0.35);
  return {
    id: 'nightFall',
    completeMs: reveal.endMs,
    settleMs: settleMs(darkness, stars, moon, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.8 + o * 0.2 })];
    },
    beneath: (context, ms, size) => {
      const o = reveal.at(ms);
      fillRect(context, 0, 0, size, size, 'rgb(10,10,30)', darkness.at(ms) * (1 - o) * 0.6);
      const progress = stars.at(ms);
      for (const star of NIGHT_STARS) {
        const t = Math.max(0, Math.min((progress - star.delay) / (1 - star.delay), 1));
        fillCircle(
          context,
          star.x * size,
          star.y * size,
          size * 0.01 * t,
          'rgb(255,255,200)',
          t * 0.8,
        );
      }
      fillCircle(
        context,
        size * 0.75,
        size * 0.2,
        size * 0.08,
        'rgb(255,250,200)',
        moon.at(ms) * (1 - o),
      );
    },
  };
}

const SEER_PHASE1 = LEGENDARY_DURATION * 0.4;
const SEER_PHASE2 = LEGENDARY_DURATION * 0.3;
const SEER_PHASE3 = LEGENDARY_DURATION * 0.3;

export function seerVision(): EntranceSpec {
  const eyeOpen = track(0, withTiming(1, { duration: SEER_PHASE1, easing: outCubic }));
  const iris = track(
    0,
    withDelay(
      SEER_PHASE1,
      withSequence(
        withTiming(1, { duration: SEER_PHASE2 * 0.6 }),
        withTiming(0.7, { duration: SEER_PHASE2 * 0.4 }),
      ),
    ),
  );
  const ripple = track(
    0,
    withDelay(
      SEER_PHASE1 + SEER_PHASE2,
      withTiming(1, { duration: SEER_PHASE3, easing: outCubic }),
    ),
  );
  const reveal = revealTrack(SEER_PHASE1 + SEER_PHASE2 * 0.5, SEER_PHASE3);
  return {
    id: 'seerVision',
    completeMs: reveal.endMs,
    settleMs: settleMs(eyeOpen, iris, ripple, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.6 + o * 0.4 })];
    },
    beneath: (context, ms, size) => {
      const c = size / 2;
      const open = eyeOpen.at(ms);
      const focus = iris.at(ms);
      const r = ripple.at(ms);
      strokeEllipse(context, c, c, size * 0.35 * open, size * 0.2 * open, {
        color: 'rgb(100,150,255)',
        width: 2,
        opacity: (1 - r) * 0.5,
      });
      fillCircle(context, c, c, size * 0.12 * (1 - focus * 0.4), 'rgb(80,130,220)', (1 - r) * 0.8);
      fillCircle(context, c, c, size * 0.05 * (0.5 + focus * 0.5), 'rgb(20,20,40)', (1 - r) * 0.9);
      strokeCircle(context, c, c, r * size * 0.5, {
        color: 'rgb(150,200,255)',
        width: 1.5,
        opacity: (1 - r) * 0.4,
      });
    },
  };
}

const WISPS = 6;

export function spiritSummon(): EntranceSpec {
  const wisps = track(
    0,
    withTiming(1, { duration: LEGENDARY_DURATION * 0.78, easing: Easing.inOut(Easing.cubic) }),
  );
  const glow = track(
    0,
    withDelay(
      LEGENDARY_DURATION * 0.22,
      withSequence(
        withTiming(0.5, { duration: LEGENDARY_DURATION * 0.33 }),
        withTiming(0, { duration: LEGENDARY_DURATION * 0.33 }),
      ),
    ),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.56, LEGENDARY_DURATION * 0.44);
  return {
    id: 'spiritSummon',
    completeMs: reveal.endMs,
    settleMs: settleMs(wisps, glow, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.5 + o * 0.5 })];
    },
    beneath: (context, ms, size) => {
      const g = glow.at(ms);
      fillCircle(context, size / 2, size / 2, size * 0.3, 'rgb(100,150,255)', g);
      strokeCircle(context, size / 2, size / 2, size * 0.38, {
        color: 'rgb(150,180,255)',
        width: 1.5,
        opacity: g * 0.4,
      });
      const t = wisps.at(ms);
      for (let i = 0; i < WISPS; i += 1) {
        const angle = (i / WISPS) * Math.PI * 2 + t * Math.PI * 4;
        const radius = size * 0.45 * (1 - t * 0.9);
        fillCircle(
          context,
          size / 2 + Math.cos(angle) * radius,
          size / 2 + Math.sin(angle) * radius,
          size * 0.025 * (1 - t * 0.5),
          i % 2 === 0 ? 'rgb(150,200,255)' : 'rgb(200,220,255)',
          0.7 * (1 - t * 0.5),
        );
      }
    },
  };
}

const BUBBLES = 8;

export function witchBrew(): EntranceSpec {
  const bubbles = track(0, withTiming(1, { duration: LEGENDARY_DURATION * 0.7, easing: outCubic }));
  const glow = track(
    0,
    withSequence(
      withTiming(0.5, { duration: LEGENDARY_DURATION * 0.4 }),
      withTiming(0, { duration: LEGENDARY_DURATION * 0.3 }),
    ),
  );
  const reveal = revealTrack(LEGENDARY_DURATION * 0.4, LEGENDARY_DURATION * 0.5);
  return {
    id: 'witchBrew',
    completeMs: reveal.endMs,
    settleMs: settleMs(bubbles, glow, reveal),
    clip: 'square',
    avatar: (ms, size) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, translateY: (1 - o) * size * 0.1, scale: 0.8 + o * 0.2 })];
    },
    beneath: (context, ms, size) => {
      fillCircle(context, size / 2, size * 0.6, size * 0.35, 'rgb(50,200,80)', glow.at(ms));
      const progress = bubbles.at(ms);
      for (let i = 0; i < BUBBLES; i += 1) {
        const delay = i * 0.08;
        const t = Math.max(0, Math.min((progress - delay) / (1 - delay), 1));
        fillCircle(
          context,
          size * (0.2 + (i / BUBBLES) * 0.6) + Math.sin(t * Math.PI * 3 + i) * size * 0.04,
          size * (0.9 - t * 0.7),
          size * (0.015 + (i % 3) * 0.008) * (1 - t * 0.3),
          i % 2 === 0 ? 'rgb(100,220,100)' : 'rgb(50,180,80)',
          t * (1 - Math.max(0, (t - 0.7) / 0.3)) * 0.7,
        );
      }
    },
  };
}

const WOLF_PHASE1 = LEGENDARY_DURATION * 0.36;
const WOLF_PHASE2 = LEGENDARY_DURATION * 0.32;
const WOLF_PHASE3 = LEGENDARY_DURATION * 0.32;

export function wolfKingEntry(): EntranceSpec {
  const eyes = track(
    0,
    withSequence(
      withTiming(1, { duration: WOLF_PHASE1 * 0.6 }),
      withTiming(0.5, { duration: WOLF_PHASE1 * 0.4 }),
    ),
  );
  const slash = track(
    0,
    withDelay(
      WOLF_PHASE1,
      withTiming(1, { duration: WOLF_PHASE2, easing: Easing.out(Easing.quad) }),
    ),
  );
  const wave = track(
    0,
    withDelay(
      WOLF_PHASE1 + WOLF_PHASE2,
      withTiming(1, { duration: WOLF_PHASE3, easing: outCubic }),
    ),
  );
  const reveal = revealTrack(WOLF_PHASE1 + WOLF_PHASE2 * 0.5, WOLF_PHASE3);
  return {
    id: 'wolfKingEntry',
    completeMs: reveal.endMs,
    settleMs: settleMs(eyes, slash, wave, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.5 + o * 0.5 })];
    },
    beneath: (context, ms, size) => {
      const glow = eyes.at(ms) * 0.9;
      fillCircle(context, size * 0.38, size * 0.38, size * 0.03, 'rgb(255,50,50)', glow);
      fillCircle(context, size * 0.62, size * 0.38, size * 0.03, 'rgb(255,50,50)', glow);
      const t = slash.at(ms);
      const w = wave.at(ms);
      const claw = {
        color: 'rgb(200,30,30)',
        width: 3,
        opacity: (1 - w) * 0.7,
        cap: 'round',
      } as const;
      strokeLine(
        context,
        size * 0.15,
        size * 0.15,
        size * (0.15 + t * 0.7),
        size * (0.15 + t * 0.7),
        claw,
      );
      strokeLine(
        context,
        size * 0.85,
        size * 0.15,
        size * (0.85 - t * 0.7),
        size * (0.15 + t * 0.7),
        claw,
      );
      strokeCircle(context, size / 2, size / 2, w * size * 0.55, {
        color: 'rgb(180,20,20)',
        width: 2,
        opacity: (1 - w) * 0.4,
      });
    },
  };
}
