/**
 * RoleHunt: a moonlit forest seen through a rifle scope. Animals carrying role names wander
 * across the clearing; aim, release to shoot, and hitting the animal with the player's own role
 * captures it and reveals the role card.
 *
 * The old Skia canvas (forest, fireflies, scope and shot burst) sat beneath the DOM animals,
 * hint, celebration emoji and card, so it is SVG here and the DOM parts port directly.
 */
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import type { RevealRoleData } from '../../../model/RevealRoleData';
import { HintWithWarning } from '../common/HintWithWarning';
import { RevealedCard } from '../common/RevealedCard';
import { BlurFilters, FULL_SCREEN } from '../common/svg';
import { CELEBRATION_EMOJIS, CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  interpolate,
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useRevealFrame,
  useRevealScene,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const SCOPE_RADIUS = 45;
const HIT_RADIUS = 35;
const ANIMAL_SIZE = 60;
const GROUND_TOP_RATIO = 0.52;
const GROUND_BOTTOM_PADDING_RATIO = 0.16;
const SPAWN_INTERVAL_MS = 1200;
const TARGET_SPAWN_INTERVAL_MS = 3500;
const INITIAL_RANDOM_ANIMALS = 3;
const CELEBRATION_COUNT = 28;

const HUNT_ANIMAL_EMOJIS = [
  '🐰',
  '🦌',
  '🐻',
  '🦊',
  '🐗',
  '🦝',
  '🐿️',
  '🦉',
  '🦔',
  '🐇',
  '🦡',
  '🐑',
  '🦢',
  '🕊️',
  '🐈‍⬛',
  '🐒',
] as const;

const SKY_COLORS = {
  top: '#0b1a2d',
  mid1: '#132844',
  mid2: '#1a3a3a',
  mid3: '#1a4428',
  bottom: '#0d2818',
} as const;

const SCOPE_COLORS = {
  overlay: 'rgba(0, 0, 0, 0.55)',
  ring: 'rgba(180, 200, 220, 0.6)',
  outerRing: 'rgba(100, 130, 160, 0.3)',
  crosshair: 'rgba(255, 80, 80, 0.7)',
  centerDot: 'rgba(255, 80, 80, 0.8)',
} as const;

const HUNT_COLORS = {
  animalName: '#ffffff',
  animalNameBg: 'rgba(0, 0, 0, 0.5)',
  hitFlash: 'rgba(100, 255, 150, 0.6)',
  burstRay: 'rgba(255, 255, 200, 0.8)',
  shockwave: 'rgba(200, 230, 255, 0.6)',
  firefly: [
    'rgba(180, 220, 255, 0.6)',
    'rgba(150, 200, 255, 0.5)',
    'rgba(200, 230, 255, 0.7)',
    'rgba(100, 180, 255, 0.5)',
    'rgba(180, 255, 220, 0.4)',
  ],
} as const;

const CROSSHAIR_SEGMENTS = [
  [-(SCOPE_RADIUS - 10), 0, -12, 0],
  [12, 0, SCOPE_RADIUS - 10, 0],
  [0, -(SCOPE_RADIUS - 10), 0, -12],
  [0, 12, 0, SCOPE_RADIUS - 10],
] as const;

type Phase = 'hunting' | 'capturing' | 'revealing' | 'revealed';
type AnimalState = 'alive' | 'hit-target' | 'hit-miss';

interface AnimalData {
  readonly id: number;
  readonly role: RevealRoleData;
  readonly isTarget: boolean;
  readonly startX: number;
  readonly y: number;
  readonly speed: number;
  readonly scale: number;
  readonly facingLeft: boolean;
  readonly spawnTimeMs: number;
  readonly emoji: string;
}

interface FireflyData {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly color: string;
  readonly driftRadius: number;
  readonly driftPhase: number;
  readonly driftDuration: number;
  readonly flickerDuration: number;
  readonly baseOpacity: number;
}

interface BurstRayData {
  readonly angle: number;
  readonly length: number;
}

interface CelebrationParticleConfig {
  readonly id: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly emoji: string;
  readonly duration: number;
}

function roleIdToAnimalEmoji(roleId: string): string {
  let hash = 0;
  for (let index = 0; index < roleId.length; index++) {
    hash = (hash * 31 + roleId.charCodeAt(index)) | 0;
  }
  return HUNT_ANIMAL_EMOJIS[Math.abs(hash) % HUNT_ANIMAL_EMOJIS.length] ?? HUNT_ANIMAL_EMOJIS[0];
}

function pickRandom<T>(items: readonly T[], fallback: T): T {
  return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

function createAnimal(
  id: number,
  role: RevealRoleData,
  targetRole: RevealRoleData,
  screenWidth: number,
  screenHeight: number,
  spawnTimeMs: number,
): AnimalData {
  const fromLeft = Math.random() > 0.5;
  const minY = screenHeight * GROUND_TOP_RATIO;
  const maxY = screenHeight * (1 - GROUND_BOTTOM_PADDING_RATIO);
  const speed = 40 + Math.random() * 60;
  return {
    id,
    role,
    isTarget: role.id === targetRole.id,
    startX: fromLeft ? -ANIMAL_SIZE : screenWidth + ANIMAL_SIZE,
    y: minY + Math.random() * (maxY - minY),
    speed: fromLeft ? speed : -speed,
    scale: 0.85 + Math.random() * 0.3,
    facingLeft: !fromLeft,
    spawnTimeMs,
    emoji: roleIdToAnimalEmoji(role.id),
  };
}

/** Where an animal walking linearly across the screen is at `nowMs`. */
function animalXAt(animal: AnimalData, screenWidth: number, nowMs: number): number {
  const travelDistance = screenWidth + ANIMAL_SIZE * 4;
  const totalDuration = (travelDistance / Math.abs(animal.speed)) * 1000;
  const progress = Math.min(1, Math.max(0, nowMs - animal.spawnTimeMs) / totalDuration);
  const endX = animal.speed > 0 ? screenWidth + ANIMAL_SIZE * 2 : -ANIMAL_SIZE * 2;
  return animal.startX + (endX - animal.startX) * progress;
}

function createFireflies(width: number, height: number): FireflyData[] {
  return Array.from({ length: 10 }, (_, index) => ({
    cx: Math.random() * width,
    cy: height * 0.3 + Math.random() * height * 0.5,
    radius: 1 + Math.random() * 1.5,
    color: HUNT_COLORS.firefly[index % HUNT_COLORS.firefly.length] ?? HUNT_COLORS.firefly[0],
    driftRadius: 15 + Math.random() * 25,
    driftPhase: Math.random() * Math.PI * 2,
    driftDuration: 3000 + Math.random() * 3000,
    flickerDuration: 400 + Math.random() * 600,
    baseOpacity: 0.3 + Math.random() * 0.5,
  }));
}

function createBurstRays(): BurstRayData[] {
  return Array.from({ length: 12 }, (_, index) => ({
    angle: (Math.PI * 2 * index) / 12 + (Math.random() - 0.5) * 0.3,
    length: 60 + Math.random() * 60,
  }));
}

function createCelebrations(): CelebrationParticleConfig[] {
  return Array.from({ length: CELEBRATION_COUNT }, (_, index) => {
    const angle = (Math.PI * 2 * index) / CELEBRATION_COUNT + (Math.random() - 0.5) * 0.4;
    const distance = 60 + Math.random() * 180;
    return {
      id: index,
      targetX: Math.cos(angle) * distance,
      targetY: Math.sin(angle) * distance - 20,
      emoji: CELEBRATION_EMOJIS[index % CELEBRATION_EMOJIS.length] ?? CELEBRATION_EMOJIS[0],
      duration: 500 + Math.random() * 500,
    };
  });
}

interface ForestData {
  readonly stars: readonly { x: number; y: number; radius: number; opacity: number }[];
  readonly hillPath: string;
  readonly farTreeLine: string;
  readonly nearTreeLine: string;
  readonly grassPaths: readonly string[];
  readonly silhouettes: readonly { x: number; topY: number; direction: number }[];
  readonly fogBanks: readonly { x: number; y: number; radius: number }[];
}

function createTreeLinePath(
  width: number,
  height: number,
  baseY: number,
  density: number,
  minHeight: number,
  maxHeight: number,
): string {
  let path = `M0 ${height}`;
  for (let x = -10; x <= width + 10; x += 12 + Math.random() * 8) {
    if (Math.random() > density) continue;
    const treeHeight = minHeight + Math.random() * maxHeight;
    const treeWidth = 6 + Math.random() * 10;
    const treeBaseY = baseY + Math.sin(x * 0.01) * 20;
    path += ` L${x - treeWidth / 2} ${treeBaseY} L${x} ${treeBaseY - treeHeight} L${x + treeWidth / 2} ${treeBaseY}`;
  }
  return `${path} L${width + 10} ${height} Z`;
}

function createForest(width: number, height: number): ForestData {
  const groundY = height * 0.72;
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.45,
    radius: 0.5 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.7,
  }));
  let hillPath = `M0 ${height * 0.55}`;
  for (let x = 0; x <= width; x += 20) {
    hillPath += ` L${x} ${height * 0.55 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.015) * 15}`;
  }
  hillPath += ` L${width} ${height} L0 ${height} Z`;
  const farTreeLine = createTreeLinePath(width, height, height * 0.5, 0.6, 25, 60);
  const nearTreeLine = createTreeLinePath(width, height, height * 0.58, 0.8, 18, 80);
  const grassPaths = Array.from({ length: 80 }, () => {
    const x = Math.random() * width;
    const y = groundY + Math.random() * (height - groundY) * 0.3;
    const bladeHeight = 8 + Math.random() * 14;
    const controlX = x + (Math.random() - 0.5) * 10;
    const tipX = x + (Math.random() - 0.5) * 6;
    return `M${x} ${y} Q${controlX} ${y - bladeHeight} ${tipX} ${y - bladeHeight}`;
  });
  const silhouettes = [
    { x: -20, topY: height * 0.25, direction: 1 },
    { x: width - 40, topY: height * 0.2, direction: -1 },
    ...(width > 350
      ? [
          { x: width * 0.15, topY: height * 0.35, direction: 1 },
          { x: width * 0.78, topY: height * 0.3, direction: -1 },
        ]
      : []),
  ];
  const fogBanks = Array.from({ length: 6 }, () => ({
    x: Math.random() * width,
    y: groundY - 10 + Math.random() * 40,
    radius: 80 + Math.random() * 120,
  }));
  return { stars, hillPath, farTreeLine, nearTreeLine, grassPaths, silhouettes, fogBanks };
}

/** The static night forest: sky, stars, moon, hills, tree lines, grass, trees, fog, vignette. */
function ForestArt({ id }: { readonly id: string }) {
  const { width, height } = useViewportSize();
  const [forest] = useState(() => createForest(width, height));
  const groundY = height * 0.72;
  const moonX = width * 0.8;
  const moonY = height * 0.12;
  return (
    <>
      <defs>
        <linearGradient
          id={`${id}-sky`}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={0}
          y2={height}
        >
          <stop offset={0} stopColor={SKY_COLORS.top} />
          <stop offset={0.3} stopColor={SKY_COLORS.mid1} />
          <stop offset={0.55} stopColor={SKY_COLORS.mid2} />
          <stop offset={0.75} stopColor={SKY_COLORS.mid3} />
          <stop offset={1} stopColor={SKY_COLORS.bottom} />
        </linearGradient>
        <radialGradient
          id={`${id}-moon`}
          gradientUnits="userSpaceOnUse"
          cx={moonX}
          cy={moonY}
          r={60}
        >
          <stop offset={0} stopColor="rgba(200,220,255,0.3)" />
          <stop offset={0.5} stopColor="rgba(200,220,255,0.08)" />
          <stop offset={1} stopColor="rgba(200,220,255,0)" />
        </radialGradient>
        <linearGradient
          id={`${id}-ground`}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={groundY}
          x2={0}
          y2={height}
        >
          <stop offset={0} stopColor="#122a1a" />
          <stop offset={0.5} stopColor="#0d1f12" />
          <stop offset={1} stopColor="#080f08" />
        </linearGradient>
        <radialGradient id={`${id}-fog`}>
          <stop offset={0} stopColor="rgba(100,140,120,0.15)" />
          <stop offset={1} stopColor="rgba(100,140,120,0)" />
        </radialGradient>
        <radialGradient
          id={`${id}-vignette`}
          gradientUnits="userSpaceOnUse"
          cx={width / 2}
          cy={height / 2}
          r={Math.max(width, height) * 0.7}
        >
          <stop offset={0} stopColor="rgba(0,0,0,0)" />
          <stop offset={1} stopColor="rgba(0,0,0,0.6)" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-sky)`} />
      {forest.stars.map((star) => (
        <circle
          key={`${star.x}-${star.y}`}
          cx={star.x}
          cy={star.y}
          r={star.radius}
          fill={`rgba(200, 220, 255, ${star.opacity})`}
        />
      ))}
      <circle cx={moonX} cy={moonY} r={60} fill={`url(#${id}-moon)`} />
      <circle cx={moonX} cy={moonY} r={14} fill="rgba(230, 240, 255, 0.92)" />
      <circle cx={moonX + 6} cy={moonY - 3} r={11} fill={SKY_COLORS.top} />
      <path d={forest.hillPath} fill="#0a2018" />
      <path d={forest.farTreeLine} fill="#071510" />
      <path d={forest.nearTreeLine} fill="#0a1f15" />
      <rect y={groundY} width={width} height={height - groundY} fill={`url(#${id}-ground)`} />
      <g fill="none" stroke="rgba(40, 80, 50, 0.6)" strokeWidth={1.5} strokeLinecap="round">
        {forest.grassPaths.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
      <g fill="#040d08">
        {forest.silhouettes.map(({ x, topY, direction }) => (
          <g key={x}>
            <rect x={x + 20 * direction} y={topY + 40} width={18} height={height - topY - 40} />
            {[0, 1, 2].map((tier) => {
              const tierY = topY + tier * 35;
              const halfWidth = 50 - tier * 8;
              const apexX = x + 28 * direction;
              return (
                <path
                  key={tier}
                  d={`M${apexX - halfWidth} ${tierY + 50} L${apexX} ${tierY} L${apexX + halfWidth} ${tierY + 50} Z`}
                />
              );
            })}
          </g>
        ))}
      </g>
      {forest.fogBanks.map((fog) => (
        <circle
          key={`${fog.x}-${fog.y}`}
          cx={fog.x}
          cy={fog.y}
          r={fog.radius}
          fill={`url(#${id}-fog)`}
        />
      ))}
      <rect width={width} height={height} fill={`url(#${id}-vignette)`} />
    </>
  );
}

/** One drifting, flickering firefly, dimmed with the rest of the atmosphere on reveal. */
function Firefly({
  firefly,
  masterOpacity,
  glowFilter,
}: {
  readonly firefly: FireflyData;
  readonly masterOpacity: SharedValue;
  readonly glowFilter: string;
}) {
  const drift = useSharedValue(0);
  const flicker = useSharedValue(0);
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    drift.animate(
      withRepeat(withTiming(1, { duration: firefly.driftDuration, easing: Easing.linear }), -1),
    );
    flicker.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: firefly.flickerDuration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: firefly.flickerDuration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [drift, flicker, firefly]);

  useRevealFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const angle = drift.get() * Math.PI * 2 + firefly.driftPhase;
    const cx = String(firefly.cx + Math.cos(angle) * firefly.driftRadius);
    const cy = String(firefly.cy + Math.sin(angle) * firefly.driftRadius);
    for (const circle of Array.from(group.children)) {
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
    }
    const flickerValue = 0.5 + Math.sin(flicker.get() * Math.PI * 2) * 0.5;
    const opacity =
      masterOpacity.get() * interpolate(flickerValue, [0, 1], [0.2, 1]) * firefly.baseOpacity;
    group.setAttribute('opacity', String(opacity));
  });

  return (
    <g ref={groupRef} opacity={0} fill={firefly.color}>
      <circle cx={firefly.cx} cy={firefly.cy} r={firefly.radius * 2.5} filter={glowFilter} />
      <circle cx={firefly.cx} cy={firefly.cy} r={firefly.radius} />
    </g>
  );
}

/** The darkened view with the scope reticle following the aim point. */
function ScopeArt({
  scopeX,
  scopeY,
}: {
  readonly scopeX: SharedValue;
  readonly scopeY: SharedValue;
}) {
  const { width, height } = useViewportSize();
  const reticleRef = useRef<SVGGElement>(null);
  useRevealFrame(() => {
    reticleRef.current?.setAttribute('transform', `translate(${scopeX.get()} ${scopeY.get()})`);
  });
  return (
    <>
      <rect width={width} height={height} fill={SCOPE_COLORS.overlay} />
      <g ref={reticleRef} transform={`translate(${scopeX.get()} ${scopeY.get()})`}>
        <circle r={SCOPE_RADIUS} fill="none" stroke={SCOPE_COLORS.ring} strokeWidth={3} />
        <circle
          r={SCOPE_RADIUS + 6}
          fill="none"
          stroke={SCOPE_COLORS.outerRing}
          strokeWidth={1.5}
        />
        {CROSSHAIR_SEGMENTS.map(([x1, y1, x2, y2]) => (
          <line
            key={`${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={SCOPE_COLORS.crosshair}
            strokeWidth={1}
          />
        ))}
        <circle r={2} fill={SCOPE_COLORS.centerDot} />
      </g>
    </>
  );
}

/** Light rays and a shockwave ring bursting from the shot that captured the target. */
function ShotBurstArt({
  x,
  y,
  rays,
  progress,
  rayFilter,
  shockwaveFilter,
}: {
  readonly x: number;
  readonly y: number;
  readonly rays: readonly BurstRayData[];
  readonly progress: SharedValue;
  readonly rayFilter: string;
  readonly shockwaveFilter: string;
}) {
  const rayRefs = useRef<(SVGLineElement | null)[]>([]);
  const shockwaveRef = useRef<SVGCircleElement>(null);
  useRevealFrame(() => {
    const value = progress.get();
    const fade = Math.max(0, 1 - value);
    rays.forEach((ray, index) => {
      const element = rayRefs.current[index];
      if (!element) return;
      element.setAttribute('x2', String(x + Math.cos(ray.angle) * ray.length * value));
      element.setAttribute('y2', String(y + Math.sin(ray.angle) * ray.length * value));
      element.setAttribute('opacity', String(fade * 0.8));
    });
    shockwaveRef.current?.setAttribute('r', String(value * 120));
    shockwaveRef.current?.setAttribute('opacity', String(fade * 0.6));
  });
  return (
    <>
      {rays.map((ray, index) => (
        <line
          key={ray.angle}
          ref={(element) => {
            rayRefs.current[index] = element;
          }}
          x1={x}
          y1={y}
          x2={x}
          y2={y}
          stroke={HUNT_COLORS.burstRay}
          strokeWidth={3}
          strokeLinecap="round"
          filter={rayFilter}
          opacity={0}
        />
      ))}
      <circle
        ref={shockwaveRef}
        cx={x}
        cy={y}
        r={0}
        fill="none"
        stroke={HUNT_COLORS.shockwave}
        strokeWidth={2}
        filter={shockwaveFilter}
        opacity={0}
      />
    </>
  );
}

/** A wandering animal wearing its role's name; it pops and fades when shot or scattered. */
function Animal({ animal, state }: { readonly animal: AnimalData; readonly state: AnimalState }) {
  const scene = useRevealScene();
  const { width: screenWidth } = useViewportSize();
  const bob = useSharedValue(0);
  const hitScale = useSharedValue(1);
  const hitOpacity = useSharedValue(1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 600 + (animal.id % 10) * 50;
    bob.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [bob, animal.id]);

  useEffect(() => {
    if (state === 'hit-miss') {
      hitScale.animate(
        withSequence(
          withTiming(1.5, { duration: 150 }),
          withTiming(0.3, { duration: 300, easing: Easing.out(Easing.cubic) }),
        ),
      );
      hitOpacity.animate(
        withDelay(100, withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })),
      );
    } else if (state === 'hit-target') {
      hitScale.animate(
        withSequence(
          withTiming(1.8, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
        ),
      );
      hitOpacity.animate(withDelay(150, withTiming(0, { duration: 250 })));
    }
  }, [state, hitScale, hitOpacity]);

  useFrameStyle(ref, () => {
    const x = animalXAt(animal, screenWidth, scene.now());
    const bobOffset = interpolate(bob.get(), [0, 1], [0, -5]);
    return {
      transform:
        `translate(${x - ANIMAL_SIZE / 2}px, ${animal.y + bobOffset - ANIMAL_SIZE / 2}px) ` +
        `scale(${animal.scale * hitScale.get()}) scaleX(${animal.facingLeft ? -1 : 1})`,
      opacity: hitOpacity.get(),
    };
  });

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        transform: `translate(${animal.startX - ANIMAL_SIZE / 2}px, ${animal.y - ANIMAL_SIZE / 2}px)`,
      }}
    >
      <span style={{ fontSize: 44, textShadow: '0px 2px 4px rgba(0, 0, 0, 0.5)' }}>
        {animal.emoji}
      </span>
      <span
        style={{
          marginTop: 2,
          padding: '2px 8px',
          borderRadius: 6,
          background: HUNT_COLORS.animalNameBg,
          color: HUNT_COLORS.animalName,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          transform: animal.facingLeft ? 'scaleX(-1)' : undefined,
        }}
      >
        {animal.role.name}
      </span>
    </div>
  );
}

/** An emoji flung out from the card as it appears. */
function CelebrationParticle({ targetX, targetY, emoji, duration }: CelebrationParticleConfig) {
  const progress = useSharedValue(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    progress.animate(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [duration, progress]);
  useFrameStyle(ref, () => {
    const value = progress.get();
    const scale = interpolate(value, [0, 0.2, 0.4, 1], [0, 1.4, 1.1, 0]);
    return {
      transform:
        `translate(${value * targetX}px, ${value * targetY}px) scale(${scale}) ` +
        `rotate(${value * 180}deg)`,
      opacity: interpolate(value, [0, 0.5, 1], [1, 0.7, 0]),
    };
  });
  return (
    <span ref={ref} style={{ position: 'absolute', fontSize: 26, transform: 'scale(0)' }}>
      {emoji}
    </span>
  );
}

function createInitialAnimals(
  role: RevealRoleData,
  spawnRoles: readonly RevealRoleData[],
  screenWidth: number,
  screenHeight: number,
  nowMs: number,
): AnimalData[] {
  return [
    createAnimal(0, role, role, screenWidth, screenHeight, nowMs),
    ...Array.from({ length: INITIAL_RANDOM_ANIMALS }, (_, index) =>
      createAnimal(index + 1, pickRandom(spawnRoles, role), role, screenWidth, screenHeight, nowMs),
    ),
  ];
}

interface HuntState {
  nextAnimalId: number;
  clockStartMs: number | null;
  spawnTicks: number;
  targetTicks: number;
  aiming: boolean;
}

function createHuntState(): HuntState {
  return {
    nextAnimalId: INITIAL_RANDOM_ANIMALS + 1,
    clockStartMs: null,
    spawnTicks: 0,
    targetTicks: 0,
    aiming: false,
  };
}

/** Aim the scope at the wandering animals and shoot the one carrying your role to reveal it. */
export default function RoleHunt({
  role,
  allRoles,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const scene = useRevealScene();
  const filterId = useId();
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const spawnRoles = allRoles.some((entry) => entry.id === role.id)
    ? allRoles
    : [role, ...allRoles];

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'hunting');
  const [animals, setAnimals] = useState<readonly AnimalData[]>(() =>
    reducedMotion
      ? []
      : createInitialAnimals(role, spawnRoles, screenWidth, screenHeight, scene.now()),
  );
  const [animalStates, setAnimalStates] = useState<Readonly<Record<number, AnimalState>>>({});
  const [celebrations, setCelebrations] = useState<readonly CelebrationParticleConfig[]>([]);
  const [hitBurstPosition, setHitBurstPosition] = useState<{ x: number; y: number } | null>(null);
  const [fireflies] = useState(() => createFireflies(screenWidth, screenHeight));
  const [burstRays] = useState(createBurstRays);
  const huntStateRef = useRef(createHuntState());
  const { fireComplete } = useRevealLifecycle(onComplete, CONFIG.roleHunt.revealHoldDuration);

  const scopeX = useSharedValue(screenWidth / 2);
  const scopeY = useSharedValue(screenHeight / 2);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const atmosphereOpacity = useSharedValue(1);
  const hitFlashOpacity = useSharedValue(0);
  const burstProgress = useSharedValue(0);
  const hitRevealDelay = useSharedValue(0);

  const hitFlashRef = useRef<HTMLDivElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  const spawnAnimal = (spawnRole: RevealRoleData, nowMs: number) => {
    const animal = createAnimal(
      huntStateRef.current.nextAnimalId++,
      spawnRole,
      role,
      screenWidth,
      screenHeight,
      nowMs,
    );
    setAnimals((previous) => [...previous, animal]);
  };

  useRevealFrame((nowMs) => {
    if (reducedMotion) return;
    const hunt = huntStateRef.current;
    if (hunt.clockStartMs === null) {
      hunt.clockStartMs = nowMs;
      return;
    }
    const elapsed = nowMs - hunt.clockStartMs;
    while (elapsed >= (hunt.spawnTicks + 1) * SPAWN_INTERVAL_MS) {
      hunt.spawnTicks++;
      if (phase === 'hunting') spawnAnimal(pickRandom(spawnRoles, role), nowMs);
    }
    while (elapsed >= (hunt.targetTicks + 1) * TARGET_SPAWN_INTERVAL_MS) {
      hunt.targetTicks++;
      const hasLiveTarget = animals.some(
        (animal) => animal.isTarget && (animalStates[animal.id] ?? 'alive') === 'alive',
      );
      if (phase === 'hunting' && !hasLiveTarget) spawnAnimal(role, nowMs);
    }
  });

  const startReveal = () => {
    setPhase('revealing');
    setCelebrations(createCelebrations());
    atmosphereOpacity.animate(withTiming(0, { duration: 600 }));
    cardOpacity.animate(withTiming(1, { duration: 300 }));
    cardScale.animate(withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }), () =>
      setPhase('revealed'),
    );
  };

  const autoTimeoutWarning = useAutoTimeout(phase === 'hunting' && !reducedMotion, startReveal);

  const shoot = (shotX: number, shotY: number) => {
    if (phase !== 'hunting') return;
    hitFlashOpacity.animate(
      withSequence(withTiming(0.3, { duration: 50 }), withTiming(0, { duration: 200 })),
    );
    const nowMs = scene.now();
    let hitAnimal: AnimalData | null = null;
    let closestDistance = HIT_RADIUS;
    for (const animal of animals) {
      if ((animalStates[animal.id] ?? 'alive') !== 'alive') continue;
      const distance = Math.hypot(animalXAt(animal, screenWidth, nowMs) - shotX, animal.y - shotY);
      if (distance < closestDistance) {
        closestDistance = distance;
        hitAnimal = animal;
      }
    }
    if (!hitAnimal) return;
    const hitId = hitAnimal.id;
    if (!hitAnimal.isTarget) {
      setAnimalStates((previous) => ({ ...previous, [hitId]: 'hit-miss' }));
      hitFlashOpacity.animate(
        withSequence(withTiming(0.15, { duration: 50 }), withTiming(0, { duration: 200 })),
      );
      return;
    }
    setPhase('capturing');
    setAnimalStates((previous) => {
      const next: Record<number, AnimalState> = { ...previous, [hitId]: 'hit-target' };
      for (const animal of animals) {
        if (animal.id !== hitId && (next[animal.id] ?? 'alive') === 'alive') {
          next[animal.id] = 'hit-miss';
        }
      }
      return next;
    });
    setHitBurstPosition({ x: shotX, y: shotY });
    burstProgress.set(0);
    burstProgress.animate(withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    hitFlashOpacity.animate(
      withSequence(withTiming(0.5, { duration: 80 }), withTiming(0, { duration: 400 })),
    );
    hitRevealDelay.animate(
      withDelay(CONFIG.roleHunt.hitRevealDelay, withTiming(1, { duration: 1 })),
      startReveal,
    );
  };

  const aimAt = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    scopeX.set(x);
    scopeY.set(y);
    return { x, y };
  };

  useFrameStyle(hitFlashRef, () => ({ opacity: hitFlashOpacity.get() }));
  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const blur = (sigma: number) => `url(#${filterId}-blur-${sigma})`;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      onPointerDown={(event) => {
        if (reducedMotion) return;
        huntStateRef.current.aiming = true;
        aimAt(event);
      }}
      onPointerMove={(event) => {
        if (huntStateRef.current.aiming) aimAt(event);
      }}
      onPointerUp={(event) => {
        if (!huntStateRef.current.aiming) return;
        huntStateRef.current.aiming = false;
        const { x, y } = aimAt(event);
        shoot(x, y);
      }}
      onPointerCancel={() => {
        huntStateRef.current.aiming = false;
      }}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: reducedMotion
          ? `linear-gradient(180deg, ${SKY_COLORS.top}, ${SKY_COLORS.mid2}, ${SKY_COLORS.bottom})`
          : SKY_COLORS.top,
        touchAction: 'none',
      }}
    >
      {!reducedMotion && (
        <svg width={screenWidth} height={screenHeight} style={FULL_SCREEN}>
          <defs>
            <BlurFilters id={filterId} sigmas={[2, 4]} />
            <filter
              id={`${filterId}-ray`}
              filterUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={screenWidth}
              height={screenHeight}
            >
              <feGaussianBlur stdDeviation={3} />
            </filter>
          </defs>
          <ForestArt id={filterId} />
          {fireflies.map((firefly) => (
            <Firefly
              key={`${firefly.cx}-${firefly.cy}`}
              firefly={firefly}
              masterOpacity={atmosphereOpacity}
              glowFilter={blur(4)}
            />
          ))}
          {phase === 'hunting' && <ScopeArt scopeX={scopeX} scopeY={scopeY} />}
          {hitBurstPosition && (
            <ShotBurstArt
              x={hitBurstPosition.x}
              y={hitBurstPosition.y}
              rays={burstRays}
              progress={burstProgress}
              rayFilter={`url(#${filterId}-ray)`}
              shockwaveFilter={blur(2)}
            />
          )}
        </svg>
      )}

      <div
        ref={hitFlashRef}
        style={{ ...FULL_SCREEN, zIndex: 8, background: HUNT_COLORS.hitFlash, opacity: 0 }}
      />

      {!reducedMotion && (
        <div style={FULL_SCREEN}>
          {animals.map((animal) => (
            <Animal key={animal.id} animal={animal} state={animalStates[animal.id] ?? 'alive'} />
          ))}
        </div>
      )}

      <HintWithWarning
        hintText={
          phase === 'hunting' && !reducedMotion ? '🔫 移动瞄准，抬手射击 — 找到你的角色！' : null
        }
        showWarning={autoTimeoutWarning}
      />

      {celebrations.length > 0 && (
        <div
          style={{
            ...FULL_SCREEN,
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {celebrations.map((particle) => (
            <CelebrationParticle key={particle.id} {...particle} />
          ))}
        </div>
      )}

      {(phase === 'revealing' || phase === 'revealed') && (
        <div
          ref={cardWrapperRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: reducedMotion ? 1 : 0,
            transform: reducedMotion ? 'none' : 'scale(0)',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <RevealedCard
              role={role}
              theme={theme}
              width={cardWidth}
              height={cardHeight}
              revealed={phase === 'revealed'}
              reducedMotion={reducedMotion}
              onComplete={fireComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
