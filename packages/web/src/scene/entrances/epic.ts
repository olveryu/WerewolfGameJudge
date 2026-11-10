/**
 * Epic seat entrances: 40 catalog ids over eight archetypes, ports of the previous client's
 * `seatAnimations/epic` templates and their configs. Effects are drawn behind the avatar inside
 * the square animation box; the avatar settles with a 600 ms spring.
 */
import type { SceneColor } from '@/scene/decoration';
import { type AvatarPose, type EntranceArt, type EntranceSpec, pose } from '@/scene/entrance';
import {
  Easing,
  settleMs,
  type Track,
  track,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from '@/scene/timeline';

import { fillCircle, fillPath, strokeCircle, strokeLine } from './draw';

const EPIC_DURATION = 3000;
const outCubic = Easing.out(Easing.cubic);
const outQuad = Easing.out(Easing.quad);

interface ParticleBurstConfig {
  archetype: 'particleBurst';
  color: string;
  accentColor: string;
  particleCount: number;
  shape: 'circle' | 'shard';
  spiral: boolean;
}

interface SlashRevealConfig {
  archetype: 'slashReveal';
  color: string;
  accentColor: string;
  slashCount: number;
  /** Degrees; 0 = horizontal. */
  baseAngle: number;
}

interface RingPortalConfig {
  archetype: 'ringPortal';
  color: string;
  glowColor: string;
  ringCount: number;
  pulse: boolean;
}

interface RisingElementConfig {
  archetype: 'risingElement';
  color: string;
  accentColor: string;
  elementCount: number;
  direction: 'up' | 'down';
  shape: 'circle' | 'diamond' | 'leaf';
}

interface VortexSwirlConfig {
  archetype: 'vortexSwirl';
  color: string;
  accentColor: string;
  particleCount: number;
  direction: 1 | -1;
  rotations: number;
}

interface FlameEnvelopeConfig {
  archetype: 'flameEnvelope';
  color: string;
  accentColor: string;
  flameCount: number;
  direction: 'inward' | 'outward';
}

interface CreatureSwarmConfig {
  archetype: 'creatureSwarm';
  color: string;
  accentColor: string;
  creatureCount: number;
  shape: 'bat' | 'bird' | 'wisp';
}

interface PhaseShiftConfig {
  archetype: 'phaseShift';
  color: string;
  accentColor: string;
  pattern: 'horizontal' | 'vertical' | 'radial';
}

type EpicConfig =
  | ParticleBurstConfig
  | SlashRevealConfig
  | RingPortalConfig
  | RisingElementConfig
  | VortexSwirlConfig
  | FlameEnvelopeConfig
  | CreatureSwarmConfig
  | PhaseShiftConfig;

// prettier-ignore
const EPIC_CONFIGS: Readonly<Record<string, EpicConfig>> = {
  bloodMistEnter: { archetype: 'particleBurst', color: 'rgb(180,30,30)', accentColor: 'rgb(255,100,100)', particleCount: 12, shape: 'circle', spiral: false },
  poisonDripEnter: { archetype: 'particleBurst', color: 'rgb(80,180,50)', accentColor: 'rgb(180,255,100)', particleCount: 10, shape: 'circle', spiral: true },
  inkSplashEnter: { archetype: 'particleBurst', color: 'rgb(30,30,40)', accentColor: 'rgb(100,100,120)', particleCount: 14, shape: 'shard', spiral: false },
  sandstormEnter: { archetype: 'particleBurst', color: 'rgb(194,154,88)', accentColor: 'rgb(230,200,130)', particleCount: 16, shape: 'shard', spiral: true },
  petalStormEnter: { archetype: 'particleBurst', color: 'rgb(230,130,170)', accentColor: 'rgb(255,200,220)', particleCount: 12, shape: 'circle', spiral: true },
  phoenixAshEnter: { archetype: 'particleBurst', color: 'rgb(255,120,30)', accentColor: 'rgb(255,200,50)', particleCount: 14, shape: 'shard', spiral: false },
  prismRefractEnter: { archetype: 'particleBurst', color: 'rgb(100,200,255)', accentColor: 'rgb(255,150,200)', particleCount: 10, shape: 'shard', spiral: true },
  wolfClawEnter: { archetype: 'slashReveal', color: 'rgb(200,50,50)', accentColor: 'rgb(255,150,150)', slashCount: 3, baseAngle: 30 },
  shadowStepEnter: { archetype: 'slashReveal', color: 'rgb(60,0,80)', accentColor: 'rgb(150,80,200)', slashCount: 4, baseAngle: -20 },
  chainBreakEnter: { archetype: 'slashReveal', color: 'rgb(160,160,170)', accentColor: 'rgb(220,220,230)', slashCount: 5, baseAngle: 0 },
  mirrorCrackEnter: { archetype: 'slashReveal', color: 'rgb(180,220,255)', accentColor: 'rgb(255,255,255)', slashCount: 5, baseAngle: 45 },
  serpentCoilEnter: { archetype: 'slashReveal', color: 'rgb(50,130,50)', accentColor: 'rgb(100,200,80)', slashCount: 3, baseAngle: 60 },
  darkPortalEnter: { archetype: 'ringPortal', color: 'rgb(80,0,120)', glowColor: 'rgba(120,0,180,0.3)', ringCount: 3, pulse: true },
  mysticSealEnter: { archetype: 'ringPortal', color: 'rgb(200,180,50)', glowColor: 'rgba(255,230,100,0.3)', ringCount: 4, pulse: false },
  runeActivateEnter: { archetype: 'ringPortal', color: 'rgb(50,150,255)', glowColor: 'rgba(80,180,255,0.3)', ringCount: 3, pulse: true },
  gravityWellEnter: { archetype: 'ringPortal', color: 'rgb(100,50,150)', glowColor: 'rgba(150,80,200,0.2)', ringCount: 4, pulse: false },
  sonicBoomEnter: { archetype: 'ringPortal', color: 'rgb(200,200,220)', glowColor: 'rgba(220,220,240,0.2)', ringCount: 3, pulse: false },
  moonriseEnter: { archetype: 'risingElement', color: 'rgb(200,210,255)', accentColor: 'rgb(150,160,220)', elementCount: 6, direction: 'up', shape: 'circle' },
  tombRiseEnter: { archetype: 'risingElement', color: 'rgb(100,100,110)', accentColor: 'rgb(60,60,70)', elementCount: 5, direction: 'up', shape: 'diamond' },
  starfallEnter: { archetype: 'risingElement', color: 'rgb(255,230,100)', accentColor: 'rgb(255,200,50)', elementCount: 8, direction: 'down', shape: 'diamond' },
  vineGrowEnter: { archetype: 'risingElement', color: 'rgb(60,150,60)', accentColor: 'rgb(100,200,80)', elementCount: 6, direction: 'up', shape: 'leaf' },
  crystalFormEnter: { archetype: 'risingElement', color: 'rgb(150,220,255)', accentColor: 'rgb(200,240,255)', elementCount: 7, direction: 'up', shape: 'diamond' },
  oceanSurgeEnter: { archetype: 'risingElement', color: 'rgb(30,100,180)', accentColor: 'rgb(80,180,255)', elementCount: 8, direction: 'up', shape: 'circle' },
  shadowVortexEnter: { archetype: 'vortexSwirl', color: 'rgb(40,0,60)', accentColor: 'rgb(100,50,150)', particleCount: 10, direction: -1, rotations: 2 },
  auroraWaveEnter: { archetype: 'vortexSwirl', color: 'rgb(50,200,150)', accentColor: 'rgb(100,150,255)', particleCount: 12, direction: 1, rotations: 1.5 },
  stormEyeEnter: { archetype: 'vortexSwirl', color: 'rgb(150,160,180)', accentColor: 'rgb(100,120,160)', particleCount: 10, direction: 1, rotations: 2.5 },
  frostShatterEnter: { archetype: 'vortexSwirl', color: 'rgb(180,220,255)', accentColor: 'rgb(220,240,255)', particleCount: 8, direction: -1, rotations: 1 },
  lavaCrackEnter: { archetype: 'vortexSwirl', color: 'rgb(255,80,20)', accentColor: 'rgb(255,180,50)', particleCount: 8, direction: 1, rotations: 1 },
  fireRebirthEnter: { archetype: 'flameEnvelope', color: 'rgb(255,100,20)', accentColor: 'rgb(255,200,50)', flameCount: 10, direction: 'inward' },
  witchFireEnter: { archetype: 'flameEnvelope', color: 'rgb(80,200,80)', accentColor: 'rgb(150,255,100)', flameCount: 8, direction: 'outward' },
  emberTrailEnter: { archetype: 'flameEnvelope', color: 'rgb(200,80,30)', accentColor: 'rgb(255,150,50)', flameCount: 8, direction: 'outward' },
  thunderStrikeEnter: { archetype: 'flameEnvelope', color: 'rgb(200,200,255)', accentColor: 'rgb(255,255,200)', flameCount: 6, direction: 'inward' },
  duskFadeEnter: { archetype: 'flameEnvelope', color: 'rgb(150,80,40)', accentColor: 'rgb(200,130,80)', flameCount: 8, direction: 'outward' },
  batSwarmEnter: { archetype: 'creatureSwarm', color: 'rgb(40,30,50)', accentColor: 'rgb(80,60,100)', creatureCount: 6, shape: 'bat' },
  crowFlockEnter: { archetype: 'creatureSwarm', color: 'rgb(20,20,30)', accentColor: 'rgb(60,60,80)', creatureCount: 5, shape: 'bird' },
  spiritChainEnter: { archetype: 'creatureSwarm', color: 'rgb(150,200,255)', accentColor: 'rgb(200,230,255)', creatureCount: 6, shape: 'wisp' },
  clockworkEnter: { archetype: 'creatureSwarm', color: 'rgb(180,150,80)', accentColor: 'rgb(220,200,120)', creatureCount: 8, shape: 'wisp' },
  mirageFadeEnter: { archetype: 'phaseShift', color: 'rgb(200,180,150)', accentColor: 'rgba(200,180,150,0.3)', pattern: 'horizontal' },
  ghostPhaseEnter: { archetype: 'phaseShift', color: 'rgb(180,200,255)', accentColor: 'rgba(180,200,255,0.3)', pattern: 'vertical' },
  voidTearEnter: { archetype: 'phaseShift', color: 'rgb(60,0,80)', accentColor: 'rgba(120,0,200,0.3)', pattern: 'radial' },
};

/** The avatar's shared epic reveal: opacity after `delayMs`, scale springing from `initialScale`. */
function reveal(delayMs: number, durationMs: number, initialScale: number) {
  return {
    opacity: track(
      0,
      withDelay(delayMs, withTiming(1, { duration: durationMs, easing: outCubic })),
    ),
    scale: track(
      initialScale,
      withDelay(delayMs, withSpring(1, { dampingRatio: 0.6, duration: 600 })),
    ),
  };
}

interface EpicParts {
  effect: Track;
  opacity: Track;
  scale: Track;
  extra?: readonly Track[];
  avatar?: (ms: number, size: number) => readonly AvatarPose[];
  beneath: EntranceArt;
}

function epicSpec(id: string, parts: EpicParts): EntranceSpec {
  const { effect, opacity, scale, extra = [] } = parts;
  return {
    id,
    completeMs: opacity.endMs,
    settleMs: settleMs(effect, opacity, scale, ...extra),
    clip: 'square',
    avatar: parts.avatar ?? ((ms) => [pose({ opacity: opacity.at(ms), scale: scale.at(ms) })]),
    beneath: parts.beneath,
  };
}

function alternate(index: number, color: SceneColor, accent: SceneColor, every = 2): SceneColor {
  return index % every === 0 ? accent : color;
}

function particleBurst(id: string, config: ParticleBurstConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION * 0.7, easing: outQuad }));
  return epicSpec(id, {
    effect,
    ...reveal(EPIC_DURATION * 0.14, EPIC_DURATION * 0.3, 0.7),
    beneath: (context, ms, size) => {
      const t = effect.at(ms);
      for (let i = 0; i < config.particleCount; i += 1) {
        const angle = (i / config.particleCount) * Math.PI * 2 + i * 0.3;
        const color = alternate(i, config.color, config.accentColor, 3);
        const dist = t * size * 0.48;
        if (config.shape === 'shard') {
          const spiralOffset = config.spiral ? t * Math.PI * 0.5 : 0;
          const cx = size / 2 + Math.cos(angle + spiralOffset) * dist;
          const cy = size / 2 + Math.sin(angle + spiralOffset) * dist;
          const s = size * 0.05 * (1 - t * 0.6);
          fillPath(
            context,
            `M ${cx} ${cy - s} L ${cx + s * 0.8} ${cy + s * 0.5} L ${cx - s * 0.8} ${cy + s * 0.5} Z`,
            color,
            (1 - t) * 0.8,
          );
        } else {
          const spiralOffset = config.spiral ? t * Math.PI * 0.8 : 0;
          fillCircle(
            context,
            size / 2 + Math.cos(angle + spiralOffset) * dist,
            size / 2 + Math.sin(angle + spiralOffset) * dist,
            size * 0.025 * (1 - t * 0.5),
            color,
            (1 - t) * 0.8,
          );
        }
      }
    },
  });
}

function slashReveal(id: string, config: SlashRevealConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION * 0.6, easing: outQuad }));
  const rad = (config.baseAngle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return epicSpec(id, {
    effect,
    ...reveal(EPIC_DURATION * 0.3, EPIC_DURATION * 0.5, 0.85),
    beneath: (context, ms, size) => {
      const progress = effect.at(ms);
      for (let i = 0; i < config.slashCount; i += 1) {
        const offset = (i / config.slashCount) * size * 0.6 - size * 0.3;
        const t = Math.min(progress * (1 + i * 0.15), 1);
        const len = t * size * 1.5;
        const x1 = size / 2 - cos * size * 0.75 + sin * offset;
        const y1 = size / 2 - sin * size * 0.75 - cos * offset;
        strokeLine(context, x1, y1, x1 + cos * len, y1 + sin * len, {
          color: i % 2 === 0 ? config.color : config.accentColor,
          width: 3,
          opacity: t > 0.1 ? (1 - t) * 0.7 : 0,
          cap: 'round',
        });
      }
    },
  });
}

function ringPortal(id: string, config: RingPortalConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION * 0.7, easing: outCubic }));
  const glow = track(
    0,
    withSequence(
      withTiming(0.5, { duration: EPIC_DURATION * 0.3 }),
      withTiming(0, { duration: EPIC_DURATION * 0.4 }),
    ),
  );
  return epicSpec(id, {
    effect,
    extra: [glow],
    ...reveal(EPIC_DURATION * 0.3, EPIC_DURATION * 0.5, 0.5),
    beneath: (context, ms, size) => {
      fillCircle(context, size / 2, size / 2, size * 0.35, config.glowColor, glow.at(ms));
      const progress = effect.at(ms);
      for (let i = 0; i < config.ringCount; i += 1) {
        const phaseDelay = i * 0.15;
        const rawT = Math.max(0, Math.min((progress - phaseDelay) / (1 - phaseDelay), 1));
        const t = config.pulse ? rawT * (1 + 0.1 * Math.sin(rawT * Math.PI * 4)) : rawT;
        strokeCircle(context, size / 2, size / 2, t * size * (0.3 + i * 0.05), {
          color: config.color,
          width: 2 + (1 - rawT) * 2,
          opacity: (1 - rawT) * 0.6,
        });
      }
    },
  });
}

function risingElement(id: string, config: RisingElementConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION * 0.7, easing: outCubic }));
  const { opacity, scale } = reveal(EPIC_DURATION * 0.25, EPIC_DURATION * 0.5, 0.8);
  const isUp = config.direction === 'up';
  return epicSpec(id, {
    effect,
    opacity,
    scale,
    avatar: (ms, size) => {
      const o = opacity.at(ms);
      return [
        pose({
          opacity: o,
          translateY: (1 - o) * (isUp ? size * 0.15 : -size * 0.15),
          scale: scale.at(ms),
        }),
      ];
    },
    beneath: (context, ms, size) => {
      const progress = effect.at(ms);
      const fade = 1 - Math.max(0, (progress - 0.7) / 0.3);
      for (let i = 0; i < config.elementCount; i += 1) {
        const phase = i * 0.1;
        const t = Math.max(0, Math.min((progress - phase) / (1 - phase), 1));
        const x =
          size * (0.1 + (i / config.elementCount) * 0.8) + Math.sin(t * Math.PI * 2) * size * 0.05;
        const startY = isUp ? size * 1.1 : -size * 0.1;
        const y = startY + (size * (0.2 + (i % 3) * 0.2) - startY) * t;
        const color = i % 2 === 0 ? config.color : config.accentColor;
        if (config.shape === 'circle') {
          fillCircle(context, x, y, size * 0.02 * (0.5 + t * 0.5), color, t * fade);
        } else {
          const s = size * 0.04;
          const d =
            config.shape === 'diamond'
              ? `M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`
              : `M ${x} ${y - s} Q ${x + s * 1.5} ${y} ${x} ${y + s} Q ${x - s * 1.5} ${y} ${x} ${y - s}`;
          fillPath(context, d, color, t * fade);
        }
      }
    },
  });
}

function vortexSwirl(id: string, config: VortexSwirlConfig): EntranceSpec {
  const effect = track(
    0,
    withTiming(1, { duration: EPIC_DURATION * 0.7, easing: Easing.inOut(Easing.cubic) }),
  );
  const { opacity, scale } = reveal(EPIC_DURATION * 0.4, EPIC_DURATION * 0.4, 0.6);
  return epicSpec(id, {
    effect,
    opacity,
    scale,
    avatar: (ms) => {
      const o = opacity.at(ms);
      return [
        pose({ opacity: o, rotateDeg: (1 - o) * 90 * config.direction, scale: scale.at(ms) }),
      ];
    },
    beneath: (context, ms, size) => {
      const t = effect.at(ms);
      for (let i = 0; i < config.particleCount; i += 1) {
        const angle =
          (i / config.particleCount) * Math.PI * 2 +
          t * Math.PI * 2 * config.rotations * config.direction;
        const radius = size * 0.45 * (1 - t * 0.9);
        fillCircle(
          context,
          size / 2 + Math.cos(angle) * radius,
          size / 2 + Math.sin(angle) * radius,
          size * 0.02 * (0.5 + (1 - t) * 0.5),
          i % 2 === 0 ? config.color : config.accentColor,
          0.8 * (1 - t * 0.7),
        );
      }
    },
  });
}

function flameEnvelope(id: string, config: FlameEnvelopeConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION * 0.7, easing: outCubic }));
  const isInward = config.direction === 'inward';
  return epicSpec(id, {
    effect,
    ...reveal(EPIC_DURATION * 0.3, EPIC_DURATION * 0.5, 0.8),
    beneath: (context, ms, size) => {
      const t = effect.at(ms);
      const cx = size / 2;
      const cy = size / 2;
      const spread = size * 0.03;
      for (let i = 0; i < config.flameCount; i += 1) {
        const angle = (i / config.flameCount) * Math.PI * 2;
        const flicker = Math.sin(t * Math.PI * 6 + i) * 0.15;
        const baseRadius = isInward ? size * 0.5 * (1 - t * 0.8) : size * 0.1 + t * size * 0.35;
        const tipRadius = baseRadius + size * (0.08 + flicker);
        const bx = cx + Math.cos(angle) * baseRadius;
        const by = cy + Math.sin(angle) * baseRadius;
        const tx = cx + Math.cos(angle) * tipRadius;
        const ty = cy + Math.sin(angle) * tipRadius;
        const perpX = -Math.sin(angle) * spread;
        const perpY = Math.cos(angle) * spread;
        fillPath(
          context,
          `M ${bx + perpX} ${by + perpY} Q ${tx} ${ty} ${bx - perpX} ${by - perpY}`,
          alternate(i, config.color, config.accentColor, 3),
          isInward ? 0.7 * (1 - t) : 0.7 * t * (1 - Math.max(0, (t - 0.7) / 0.3)),
        );
      }
    },
  });
}

function creaturePath(
  shape: CreatureSwarmConfig['shape'],
  x: number,
  y: number,
  s: number,
): string {
  switch (shape) {
    case 'bat':
      return `M ${x} ${y} L ${x - s * 1.2} ${y - s * 0.6} L ${x - s * 0.5} ${y + s * 0.2} L ${x} ${y - s * 0.3} L ${x + s * 0.5} ${y + s * 0.2} L ${x + s * 1.2} ${y - s * 0.6} Z`;
    case 'bird':
      return `M ${x - s} ${y - s * 0.3} Q ${x - s * 0.3} ${y - s} ${x} ${y} Q ${x + s * 0.3} ${y - s} ${x + s} ${y - s * 0.3}`;
    case 'wisp':
      return `M ${x} ${y - s * 0.5} Q ${x + s * 0.5} ${y} ${x} ${y + s * 0.5} Q ${x - s * 0.5} ${y} ${x} ${y - s * 0.5}`;
  }
}

function creatureSwarm(id: string, config: CreatureSwarmConfig): EntranceSpec {
  const effect = track(
    0,
    withTiming(1, { duration: EPIC_DURATION * 0.75, easing: Easing.inOut(Easing.cubic) }),
  );
  return epicSpec(id, {
    effect,
    ...reveal(EPIC_DURATION * 0.5, EPIC_DURATION * 0.35, 0.7),
    beneath: (context, ms, size) => {
      const t = effect.at(ms);
      const opacity = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) / 0.15 : 0.8;
      for (let i = 0; i < config.creatureCount; i += 1) {
        const angle = (i / config.creatureCount) * Math.PI * 2 + t * Math.PI * 3;
        const radius = size * 0.55 * (1 - t * 0.85);
        const x = size / 2 + Math.cos(angle) * radius;
        const y = size / 2 + Math.sin(angle) * radius + Math.sin(t * Math.PI * 4) * size * 0.03;
        fillPath(
          context,
          creaturePath(config.shape, x, y, size * 0.04),
          i % 2 === 0 ? config.color : config.accentColor,
          opacity,
        );
      }
    },
  });
}

function phaseShift(id: string, config: PhaseShiftConfig): EntranceSpec {
  const effect = track(0, withTiming(1, { duration: EPIC_DURATION, easing: outCubic }));
  const scale = track(
    0.85,
    withDelay(EPIC_DURATION * 0.2, withSpring(1, { dampingRatio: 0.6, duration: 600 })),
  );
  const ghost = (t: number, size: number, sign: 1 | -1, opacity: number): AvatarPose => {
    const offset = (1 - t) * size * 0.12 * sign;
    return pose({
      opacity,
      translateX: config.pattern === 'horizontal' ? offset : 0,
      translateY: config.pattern === 'vertical' ? offset : 0,
      scale: config.pattern === 'radial' ? (sign === 1 ? 1.1 - t * 0.1 : 0.9 + t * 0.1) : 1,
    });
  };
  return {
    id,
    completeMs: effect.endMs,
    settleMs: settleMs(effect, scale),
    clip: 'square',
    avatar: (ms, size) => {
      const t = effect.at(ms);
      return [
        ghost(t, size, 1, (1 - t) * 0.4),
        ghost(t, size, -1, (1 - t) * 0.3),
        pose({ opacity: t, scale: scale.at(ms) }),
      ];
    },
    beneath: (context, ms, size) =>
      fillCircle(
        context,
        size / 2,
        size / 2,
        size * 0.4,
        config.accentColor,
        (1 - effect.at(ms)) * 0.25,
      ),
  };
}

function buildEpic(id: string, config: EpicConfig): EntranceSpec {
  switch (config.archetype) {
    case 'particleBurst':
      return particleBurst(id, config);
    case 'slashReveal':
      return slashReveal(id, config);
    case 'ringPortal':
      return ringPortal(id, config);
    case 'risingElement':
      return risingElement(id, config);
    case 'vortexSwirl':
      return vortexSwirl(id, config);
    case 'flameEnvelope':
      return flameEnvelope(id, config);
    case 'creatureSwarm':
      return creatureSwarm(id, config);
    case 'phaseShift':
      return phaseShift(id, config);
  }
}

const built = new Map<string, EntranceSpec>();

/** The entrance of epic catalog id `id`; throws for an id outside the 40. */
export function epicEntrance(id: string): EntranceSpec {
  let spec = built.get(id);
  if (!spec) {
    const config = EPIC_CONFIGS[id];
    if (!config) {
      throw new Error(`"${id}" is not an epic seat entrance`);
    }
    spec = buildEpic(id, config);
    built.set(id, spec);
  }
  return spec;
}
