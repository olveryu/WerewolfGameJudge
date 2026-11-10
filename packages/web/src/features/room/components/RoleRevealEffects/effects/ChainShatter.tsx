/**
 * ChainShatter: a chained padlock in a torch-lit dungeon; each tap cracks it with sparks and a
 * shockwave until the sixth hit shatters it and the role card springs out.
 *
 * The old Skia lock, torches and debris sat beneath DOM text (hit counter, combo, torch brackets)
 * and the card, so they are SVG here; the canvas-free DOM parts port directly.
 */
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { RevealedCard } from '../common/RevealedCard';
import { BlurFilters, FULL_SCREEN } from '../common/svg';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useRevealFrame,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #050510 0%, #0a0a1e 50%, #050510 100%)';

const COLORS = {
  lockBody: '#2A3040',
  lockHighlight: '#4A5570',
  lockStroke: '#5A6580',
  shackle: '#7888A0',
  shackleHighlight: '#A0B0C8',
  keyhole: '#0A0A14',
  keyholeGlow: 'rgba(255, 180, 60, 0.35)',
  chainLinkFill: '#3A4255',
  chainLinkStroke: '#6A7890',
  rivetFill: '#8898B0',
  rivetHighlight: '#B0C0D8',
  breakFlash: 'rgba(255, 210, 100, 0.5)',
  sparkPalette: ['#FFD700', '#FFA500', '#FFFFFF', '#FFE066', '#FF8C00'],
  shardPalette: ['#4A5570', '#6A7890', '#8898B0', '#3A4255', '#5A6580', '#FFD080'],
  hitText: '#FFD700',
  comboText: 'rgba(255, 200, 0, 0.7)',
  dustParticle: 'rgba(180, 200, 230, 0.15)',
  shockwaveRing: 'rgba(255, 200, 80, 0.6)',
  radialBurst: 'rgba(255, 220, 100, 0.5)',
  stoneWall: 'rgba(50, 45, 40, 0.7)',
  stoneWallBorder: 'rgba(80, 70, 60, 0.5)',
  torchGlow: 'rgba(255, 140, 0, 0.3)',
  lightningArc: 'rgba(150, 200, 255, 0.8)',
  lightningGlow: 'rgba(100, 150, 255, 0.4)',
  lightPillar: 'rgba(255, 215, 0, 0.6)',
  springColor: 'rgba(160, 170, 180, 0.6)',
  debrisColor: 'rgba(100, 90, 80, 0.5)',
} as const;

const CS = CONFIG.chainShatter;
const SPARKS_PER_HIT = 10;
const SPARK_SLOTS = 6;
const BURST_LINE_ANGLES = Array.from({ length: 12 }, (_, index) => (index / 12) * Math.PI * 2);

type Phase = 'appear' | 'idle' | 'hitting' | 'shatter' | 'revealed';

interface LockGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
}

interface CrackData {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly length: number;
  readonly hitIndex: number;
}

interface SparkData {
  readonly vx: number;
  readonly vy: number;
  readonly color: string;
  readonly size: number;
}

interface SparkBurstData {
  readonly id: number;
  readonly sparks: readonly SparkData[];
}

function createTorchPositions(screenWidth: number, screenHeight: number) {
  return [
    { x: 20, y: screenHeight * 0.3 },
    { x: screenWidth - 50, y: screenHeight * 0.35 },
  ];
}

function createStoneBlocks(screenWidth: number, screenHeight: number) {
  return Array.from({ length: 6 }, (_, index) => ({
    x: (index % 3) * (screenWidth / 3),
    y: screenHeight * 0.3 + Math.floor(index / 3) * 80,
    width: screenWidth / 3 - 4,
    height: 70,
  }));
}

function createDebris(screenWidth: number, screenHeight: number) {
  return Array.from({ length: 10 }, () => ({
    x: screenWidth * 0.2 + Math.random() * screenWidth * 0.6,
    y: screenHeight * 0.65 + Math.random() * screenHeight * 0.1,
    size: 2 + Math.random() * 3,
  }));
}

function createDust(screenWidth: number, screenHeight: number) {
  return Array.from({ length: 10 }, () => ({
    x: Math.random() * screenWidth,
    y: Math.random() * screenHeight,
    driftX: 15 + Math.random() * 25,
    driftY: 8 + Math.random() * 15,
    radius: 1.5 + Math.random() * 2.5,
  }));
}

function createShards() {
  return Array.from({ length: CS.shardCount }, (_, index) => {
    const angle = (index / CS.shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const speed = 100 + Math.random() * 80;
    const size = 6 + Math.random() * 14;
    const halfWidth = size / 2;
    const halfHeight = (size * 0.6) / 2;
    const points = [
      [-halfWidth * 0.8, -halfHeight],
      [halfWidth * 0.6, -halfHeight * 0.7],
      [halfWidth, halfHeight * 0.3],
      [halfWidth * 0.4, halfHeight],
      [-halfWidth, halfHeight * 0.6],
    ];
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      color: COLORS.shardPalette[index % COLORS.shardPalette.length],
      spin: (Math.random() - 0.5) * 8,
      path: `M ${points.map(([x = 0, y = 0]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`,
    };
  });
}

function createSparks(): SparkData[] {
  return Array.from({ length: SPARKS_PER_HIT }, (_, index) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: COLORS.sparkPalette[index % COLORS.sparkPalette.length] ?? COLORS.hitText,
      size: 2 + Math.random() * 3,
    };
  });
}

function buildChainLinkPaths({ cx, cy, width }: LockGeometry): string[] {
  const rx = width * 0.11;
  const ry = width * 0.065;
  const startOffset = width * 0.7;
  const spacing = width * 0.22;
  return [-1, 1].flatMap((side) =>
    Array.from({ length: 4 }, (_, index) => {
      const x = cx + side * (startOffset + index * spacing);
      const y = cy + Math.sin(index * 0.8) * (width * 0.05);
      return (
        `M ${(x - rx).toFixed(1)} ${y.toFixed(1)} ` +
        `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(x + rx).toFixed(1)} ${y.toFixed(1)} ` +
        `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(x - rx).toFixed(1)} ${y.toFixed(1)}`
      );
    }),
  );
}

/** Gold for the first crack, reddening towards the last required hit. */
function crackColor(hitIndex: number): string {
  const t = Math.min(hitIndex / Math.max(CS.requiredHits - 1, 1), 1);
  return `rgba(255, ${Math.round(200 - t * 120)}, ${Math.round(50 - t * 20)}, 0.9)`;
}

/** Drifting dust motes and the two wall-torch flames. */
function DungeonAmbience({
  torchFlicker,
  dustProgress,
}: {
  readonly torchFlicker: SharedValue;
  readonly dustProgress: SharedValue;
}) {
  const id = useId();
  const { width, height } = useViewportSize();
  const [dust] = useState(() => createDust(width, height));
  const torches = createTorchPositions(width, height);
  const dustRefs = useRef<(SVGCircleElement | null)[]>([]);
  const torchRefs = useRef<(SVGGElement | null)[]>([]);
  const blur = (sigma: number) => `url(#${id}-blur-${sigma})`;

  useRevealFrame(() => {
    const phase = dustProgress.get() * Math.PI * 2;
    dust.forEach((mote, index) => {
      const element = dustRefs.current[index];
      if (!element) return;
      element.setAttribute('cx', String(mote.x + Math.sin(phase) * mote.driftX));
      element.setAttribute('cy', String(mote.y + Math.cos(phase) * mote.driftY));
      element.setAttribute('opacity', String(0.08 + Math.sin(phase) * 0.07));
    });
    const flicker = torchFlicker.get();
    const sway = Math.sin(flicker * Math.PI * 2) * 3;
    const tipLift = Math.sin(flicker * Math.PI * 4) * 2;
    torchRefs.current.forEach((torch) => {
      if (!torch) return;
      const [glow, outer, mid, inner, tip] = Array.from(torch.children);
      glow?.setAttribute('opacity', String(0.15 + flicker * 0.15));
      for (const flame of [outer, mid]) {
        flame?.setAttribute('transform', `translate(${sway} 0)`);
        flame?.setAttribute('opacity', String(0.7 + flicker * 0.3));
      }
      for (const flame of [inner, tip]) {
        flame?.setAttribute('transform', `translate(${sway} ${tipLift})`);
        flame?.setAttribute('opacity', String(0.8 + flicker * 0.2));
      }
    });
  });

  return (
    <svg width={width} height={height} style={FULL_SCREEN}>
      <defs>
        <BlurFilters id={id} sigmas={[1, 2, 4, 6, 20]} />
      </defs>
      {dust.map((mote, index) => (
        <circle
          key={index}
          ref={(element) => {
            dustRefs.current[index] = element;
          }}
          cx={mote.x}
          cy={mote.y}
          r={mote.radius}
          fill={COLORS.dustParticle}
          opacity={0.08}
        />
      ))}
      {torches.map((torch, index) => (
        <g
          key={index}
          ref={(element) => {
            torchRefs.current[index] = element;
          }}
        >
          <circle
            cx={torch.x + 15}
            cy={torch.y + 5}
            r={35}
            fill={COLORS.torchGlow}
            filter={blur(20)}
          />
          <circle
            cx={torch.x + 15}
            cy={torch.y + 8}
            r={14}
            fill="rgba(255, 80, 20, 0.7)"
            filter={blur(6)}
          />
          <circle
            cx={torch.x + 15}
            cy={torch.y}
            r={10}
            fill="rgba(255, 160, 40, 0.85)"
            filter={blur(4)}
          />
          <circle
            cx={torch.x + 15}
            cy={torch.y - 8}
            r={6}
            fill="rgba(255, 230, 80, 0.9)"
            filter={blur(2)}
          />
          <circle
            cx={torch.x + 15}
            cy={torch.y - 8}
            r={3}
            fill="rgba(255, 255, 220, 0.95)"
            filter={blur(1)}
          />
        </g>
      ))}
    </svg>
  );
}

/** The padlock with its shackle, keyhole, rivets and side chains. */
function Padlock({
  lock,
  opacity,
}: {
  readonly lock: LockGeometry;
  readonly opacity: SharedValue;
}) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const svgRef = useRef<SVGSVGElement>(null);
  useFrameStyle(svgRef, () => ({ opacity: opacity.get() }));
  const { cx, cy, width, height } = lock;
  const left = cx - width / 2;
  const top = cy - height / 2;
  const shackleRadius = width * 0.3;
  const shacklePath =
    `M ${(cx - shackleRadius).toFixed(1)} ${top.toFixed(1)} ` +
    `A ${shackleRadius.toFixed(1)} ${shackleRadius.toFixed(1)} 0 0 1 ${(cx + shackleRadius).toFixed(1)} ${top.toFixed(1)}`;
  const slotHalfWidth = width * 0.04;
  const rivetInset = width * 0.15;
  const rivets = [
    [left + rivetInset, top + rivetInset],
    [left + width - rivetInset, top + rivetInset],
    [left + rivetInset, top + height - rivetInset],
    [left + width - rivetInset, top + height - rivetInset],
  ];
  const rivetRadius = width * 0.035;
  return (
    <svg ref={svgRef} width={screenWidth} height={screenHeight} style={FULL_SCREEN}>
      <rect x={left} y={top} width={width} height={height} fill={COLORS.lockBody} />
      <rect
        x={left}
        y={top}
        width={width}
        height={height * 0.15}
        fill={COLORS.lockHighlight}
        opacity={0.5}
      />
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="none"
        stroke={COLORS.lockStroke}
        strokeWidth={2.5}
      />
      <path
        d={shacklePath}
        fill="none"
        stroke={COLORS.shackle}
        strokeWidth={width * 0.1}
        strokeLinecap="round"
      />
      <path
        d={shacklePath}
        fill="none"
        stroke={COLORS.shackleHighlight}
        strokeWidth={width * 0.03}
        strokeLinecap="round"
        opacity={0.4}
      />
      <circle cx={cx} cy={cy} r={width * 0.16} fill={COLORS.keyholeGlow} />
      <circle cx={cx} cy={cy} r={width * 0.1} fill={COLORS.keyhole} />
      <rect
        x={cx - slotHalfWidth}
        y={cy}
        width={slotHalfWidth * 2}
        height={width * 0.2}
        fill={COLORS.keyhole}
      />
      {rivets.map(([x = 0, y = 0]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={rivetRadius} fill={COLORS.rivetFill} />
          <circle
            cx={x}
            cy={y}
            r={rivetRadius}
            fill="none"
            stroke={COLORS.rivetHighlight}
            strokeWidth={1}
            opacity={0.5}
          />
          <circle
            cx={x - width * 0.01}
            cy={y - width * 0.01}
            r={width * 0.012}
            fill={COLORS.rivetHighlight}
            opacity={0.6}
          />
        </g>
      ))}
      {buildChainLinkPaths(lock).map((path) => (
        <g key={path}>
          <path d={path} fill={COLORS.chainLinkFill} />
          <path d={path} fill="none" stroke={COLORS.chainLinkStroke} strokeWidth={3} />
        </g>
      ))}
    </svg>
  );
}

interface HitArtProps {
  readonly lock: LockGeometry;
  readonly cracks: readonly CrackData[];
  readonly crackOpacities: readonly SharedValue[];
  readonly sparkBursts: readonly SparkBurstData[];
  readonly sparkProgresses: readonly SharedValue[];
  readonly shockwaveProgress: SharedValue | null;
  readonly lightningFlash: SharedValue;
  readonly debrisVisible: SharedValue;
}

/** Everything a hit leaves on the lock: cracks, sparks, the shockwave, lightning and debris. */
function HitArt({
  lock,
  cracks,
  crackOpacities,
  sparkBursts,
  sparkProgresses,
  shockwaveProgress,
  lightningFlash,
  debrisVisible,
}: HitArtProps) {
  const id = useId();
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const [debris] = useState(() => createDebris(screenWidth, screenHeight));
  const { cx, cy, width, height } = lock;
  const crackRefs = useRef<(SVGGElement | null)[]>([]);
  const sparkRefs = useRef<(SVGCircleElement | null)[]>([]);
  const shockwaveRef = useRef<SVGCircleElement>(null);
  const lightningRef = useRef<SVGGElement>(null);
  const debrisRef = useRef<SVGGElement>(null);

  useRevealFrame(() => {
    cracks.forEach((_, index) => {
      const opacity = crackOpacities[Math.min(index, crackOpacities.length - 1)];
      crackRefs.current[index]?.setAttribute('opacity', String(opacity?.get() ?? 0));
    });
    sparkBursts.forEach((burst, burstIndex) => {
      const progress = sparkProgresses[burstIndex % sparkProgresses.length]?.get() ?? 1;
      burst.sparks.forEach((spark, sparkIndex) => {
        const element = sparkRefs.current[burstIndex * SPARKS_PER_HIT + sparkIndex];
        if (!element) return;
        element.setAttribute('cx', String(cx + spark.vx * progress));
        element.setAttribute('cy', String(cy + spark.vy * progress + 60 * progress * progress));
        element.setAttribute('r', String(spark.size * Math.max(0, 1 - progress)));
        element.setAttribute('opacity', String(Math.max(0, 1 - progress * 1.5)));
      });
    });
    if (shockwaveProgress && shockwaveRef.current) {
      const progress = shockwaveProgress.get();
      shockwaveRef.current.setAttribute('r', String(progress * width * 0.8));
      shockwaveRef.current.setAttribute('opacity', String(Math.max(0, 0.6 - progress * 0.8)));
    }
    lightningRef.current?.setAttribute('opacity', String(lightningFlash.get()));
    debrisRef.current?.setAttribute('opacity', String(debrisVisible.get()));
  });

  const arcs = [
    [cx - width * 0.25, cy - height * 0.2, cx + width * 0.15, cy + height * 0.15],
    [cx + width * 0.2, cy - height * 0.15, cx - width * 0.1, cy + height * 0.2],
  ] as const;

  return (
    <svg width={screenWidth} height={screenHeight} style={FULL_SCREEN}>
      <defs>
        <BlurFilters id={id} sigmas={[4]} />
      </defs>
      {cracks.map((crack, index) => {
        const color = crackColor(crack.hitIndex);
        const endX = crack.x + Math.cos(crack.angle) * crack.length;
        const endY = crack.y + Math.sin(crack.angle) * crack.length;
        return (
          <g
            key={index}
            ref={(element) => {
              crackRefs.current[index] = element;
            }}
            opacity={0}
            stroke={color}
            strokeLinecap="round"
          >
            <line x1={crack.x} y1={crack.y} x2={endX} y2={endY} strokeWidth={6} opacity={0.4} />
            <line x1={crack.x} y1={crack.y} x2={endX} y2={endY} strokeWidth={2} />
          </g>
        );
      })}
      {sparkBursts.map((burst, burstIndex) =>
        burst.sparks.map((spark, sparkIndex) => (
          <circle
            key={`${burst.id}-${sparkIndex}`}
            ref={(element) => {
              sparkRefs.current[burstIndex * SPARKS_PER_HIT + sparkIndex] = element;
            }}
            cx={cx}
            cy={cy}
            r={0}
            fill={spark.color}
          />
        )),
      )}
      {shockwaveProgress && (
        <circle
          ref={shockwaveRef}
          cx={cx}
          cy={cy}
          r={0}
          fill="none"
          stroke={COLORS.shockwaveRing}
          strokeWidth={2}
        />
      )}
      <g ref={lightningRef} opacity={0}>
        {arcs.map(([x1, y1, x2, y2]) => (
          <line
            key={x1}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={COLORS.lightningArc}
            strokeWidth={2}
          />
        ))}
        <line
          x1={arcs[0][0]}
          y1={arcs[0][1]}
          x2={arcs[0][2]}
          y2={arcs[0][3]}
          stroke={COLORS.lightningGlow}
          strokeWidth={6}
          filter={`url(#${id}-blur-4)`}
        />
      </g>
      <g ref={debrisRef} opacity={0} fill={COLORS.debrisColor}>
        {debris.map((piece) => (
          <circle key={`${piece.x}-${piece.y}`} cx={piece.x} cy={piece.y} r={piece.size} />
        ))}
      </g>
    </svg>
  );
}

/** Radial light streaks and steel shards flung out under gravity when the lock breaks. */
function ShatterArt({
  lock,
  shatterProgress,
  burstProgress,
}: {
  readonly lock: LockGeometry;
  readonly shatterProgress: SharedValue;
  readonly burstProgress: SharedValue;
}) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const [shards] = useState(createShards);
  const gravity = screenHeight * 0.18;
  const maxRadius = screenWidth * 0.5;
  const { cx, cy } = lock;
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const shardRefs = useRef<(SVGGElement | null)[]>([]);

  useRevealFrame(() => {
    const burst = burstProgress.get();
    BURST_LINE_ANGLES.forEach((angle, index) => {
      const element = lineRefs.current[index];
      if (!element) return;
      const inner = burst * maxRadius * 0.2;
      const outer = burst * maxRadius;
      element.setAttribute('x1', String(cx + Math.cos(angle) * inner));
      element.setAttribute('y1', String(cy + Math.sin(angle) * inner));
      element.setAttribute('x2', String(cx + Math.cos(angle) * outer));
      element.setAttribute('y2', String(cy + Math.sin(angle) * outer));
      element.setAttribute('opacity', String(Math.max(0, 0.5 - burst * 0.7)));
    });
    const progress = shatterProgress.get();
    shards.forEach((shard, index) => {
      const element = shardRefs.current[index];
      if (!element) return;
      const x = cx + shard.vx * progress;
      const y = cy + shard.vy * progress + gravity * progress * progress;
      element.setAttribute(
        'transform',
        `translate(${x} ${y}) rotate(${(shard.spin * progress * 180) / Math.PI})`,
      );
      element.setAttribute('opacity', String(Math.max(0, 1 - progress * 1.2)));
    });
  });

  return (
    <svg width={screenWidth} height={screenHeight} style={FULL_SCREEN}>
      {BURST_LINE_ANGLES.map((angle, index) => (
        <line
          key={angle}
          ref={(element) => {
            lineRefs.current[index] = element;
          }}
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy}
          stroke={COLORS.radialBurst}
          strokeWidth={2}
        />
      ))}
      {shards.map((shard, index) => (
        <g
          key={index}
          ref={(element) => {
            shardRefs.current[index] = element;
          }}
          transform={`translate(${cx} ${cy})`}
        >
          <path d={shard.path} fill={shard.color} />
          <path d={shard.path} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        </g>
      ))}
    </svg>
  );
}

function createHitState() {
  return { count: 0, lastHitMs: 0, shattered: false, nextSparkId: 0 };
}

const CENTERED_OVERLAY: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
};

/** Tap the chained lock six times to shatter it and release the role card. */
export default function ChainShatter({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const lockWidth = screenWidth * CS.lockWidthRatio;
  const lock: LockGeometry = {
    cx: screenWidth / 2,
    cy: screenHeight / 2,
    width: lockWidth,
    height: lockWidth * 0.8,
  };

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'appear');
  const [hitCount, setHitCount] = useState(0);
  const [cracks, setCracks] = useState<CrackData[]>([]);
  const [sparkBursts, setSparkBursts] = useState<SparkBurstData[]>([]);
  const hitStateRef = useRef(createHitState());
  const { fireComplete } = useRevealLifecycle(onComplete, CS.revealHoldDuration);

  const chainOpacity = useSharedValue(0);
  const chainScale = useSharedValue(0);
  const lockOpacity = useSharedValue(1);
  const hitFlashOpacity = useSharedValue(0);
  const shatterProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const comboOpacity = useSharedValue(0);
  const comboScale = useSharedValue(1);
  const dustProgress = useSharedValue(0);
  const shockwaveProgress = useSharedValue(0);
  const torchFlicker = useSharedValue(0);
  const lightningFlash = useSharedValue(0);
  const lightPillarOpacity = useSharedValue(0);
  const lightPillarScale = useSharedValue(0);
  const debrisVisible = useSharedValue(0);
  const radialBurstProgress = useSharedValue(0);
  const shatterDelay = useSharedValue(0);
  const sparkProgress0 = useSharedValue(0);
  const sparkProgress1 = useSharedValue(0);
  const sparkProgress2 = useSharedValue(0);
  const sparkProgress3 = useSharedValue(0);
  const sparkProgress4 = useSharedValue(0);
  const sparkProgress5 = useSharedValue(0);
  const crackOpacity0 = useSharedValue(0);
  const crackOpacity1 = useSharedValue(0);
  const crackOpacity2 = useSharedValue(0);
  const crackOpacity3 = useSharedValue(0);
  const crackOpacity4 = useSharedValue(0);
  const crackOpacity5 = useSharedValue(0);
  const sparkProgresses = [
    sparkProgress0,
    sparkProgress1,
    sparkProgress2,
    sparkProgress3,
    sparkProgress4,
    sparkProgress5,
  ];
  const crackOpacities = [
    crackOpacity0,
    crackOpacity1,
    crackOpacity2,
    crackOpacity3,
    crackOpacity4,
    crackOpacity5,
  ];

  const canvasRef = useRef<HTMLDivElement>(null);
  const chainLayerRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const hitFlashRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const pillarRef = useRef<HTMLDivElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    dustProgress.animate(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1));
    torchFlicker.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.8, { duration: 250, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 350, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    chainOpacity.animate(withTiming(1, { duration: CS.chainAppearDuration / 2 }));
    chainScale.animate(
      withTiming(1, {
        duration: CS.chainAppearDuration,
        easing: Easing.out(Easing.back(1.15)),
      }),
      () => setPhase('idle'),
    );
  }, [reducedMotion, dustProgress, torchFlicker, chainOpacity, chainScale]);

  const triggerShatter = () => {
    const hitState = hitStateRef.current;
    if (hitState.shattered) return;
    hitState.shattered = true;
    setPhase('shatter');
    lockOpacity.animate(withTiming(0, { duration: 150 }));
    flashOpacity.animate(
      withSequence(withTiming(0.7, { duration: 80 }), withTiming(0, { duration: 500 })),
    );
    radialBurstProgress.set(0);
    radialBurstProgress.animate(withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    shatterProgress.animate(
      withTiming(1, { duration: CS.shatterDuration, easing: Easing.out(Easing.cubic) }),
    );
    canvasOpacity.animate(withDelay(400, withTiming(0, { duration: 400 })));
    cardScale.animate(
      withDelay(
        500,
        withTiming(1, {
          duration: CS.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        }),
      ),
      () => setPhase('revealed'),
    );
    cardOpacity.animate(withDelay(500, withTiming(1, { duration: CS.cardRevealDuration })));
    lightPillarScale.animate(
      withDelay(300, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })),
    );
    lightPillarOpacity.animate(
      withDelay(
        300,
        withSequence(withTiming(0.8, { duration: 300 }), withTiming(0, { duration: 800 })),
      ),
    );
  };

  const autoTimeoutWarning = useAutoTimeout(
    phase === 'idle' || phase === 'hitting',
    triggerShatter,
  );

  const handlePress = () => {
    if (phase !== 'idle' && phase !== 'hitting') return;
    const hitState = hitStateRef.current;
    const nowMs = performance.now();
    let current = hitState.count;
    if (current > 0 && nowMs - hitState.lastHitMs > CS.comboTimeout) {
      current = Math.max(0, current - 1);
    }
    current++;
    hitState.count = current;
    hitState.lastHitMs = nowMs;
    setHitCount(current);
    if (phase === 'idle') setPhase('hitting');

    const crackIndex = Math.min(current - 1, crackOpacities.length - 1);
    setCracks((previous) => [
      ...previous,
      {
        x: lock.cx + (Math.random() - 0.5) * lock.width * 0.6,
        y: lock.cy + (Math.random() - 0.5) * lock.height * 0.6,
        angle: Math.random() * Math.PI * 2,
        length: lock.width * 0.2 + Math.random() * lock.width * 0.4,
        hitIndex: current - 1,
      },
    ]);
    crackOpacities[crackIndex]?.animate(
      withSequence(withTiming(1, { duration: 50 }), withTiming(0.85, { duration: 200 })),
    );

    const sparkId = hitState.nextSparkId++;
    setSparkBursts((previous) => [
      ...previous.slice(-(SPARK_SLOTS - 1)),
      { id: sparkId, sparks: createSparks() },
    ]);
    const sparkProgress = sparkProgresses[crackIndex % SPARK_SLOTS];
    sparkProgress?.set(0);
    sparkProgress?.animate(withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));

    shockwaveProgress.set(0);
    shockwaveProgress.animate(withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }));
    comboScale.animate(
      withSequence(withTiming(1.4, { duration: 80 }), withTiming(1, { duration: 150 })),
    );
    comboOpacity.animate(
      withSequence(withTiming(0.8, { duration: 50 }), withTiming(0, { duration: CS.comboTimeout })),
    );
    hitFlashOpacity.animate(
      withSequence(withTiming(0.35, { duration: 40 }), withTiming(0, { duration: 120 })),
    );
    if (current >= 3) {
      lightningFlash.animate(
        withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 200 })),
      );
    }
    debrisVisible.animate(withTiming(1, { duration: 200 }));

    const amplitude = 6 + Math.min(current / CS.requiredHits, 1) * 8;
    shakeX.animate(
      withSequence(
        withTiming(-amplitude, { duration: 25 }),
        withTiming(amplitude, { duration: 25 }),
        withTiming(-amplitude * 0.5, { duration: 25 }),
        withTiming(0, { duration: 25 }),
      ),
    );
    shakeY.animate(
      withSequence(
        withTiming(-amplitude * 0.5, { duration: 30 }),
        withTiming(amplitude * 0.3, { duration: 30 }),
        withTiming(0, { duration: 30 }),
      ),
    );

    if (current >= CS.requiredHits) {
      shatterDelay.animate(withDelay(200, withTiming(1, { duration: 1 })), triggerShatter);
    }
  };

  useFrameStyle(canvasRef, () => ({ opacity: canvasOpacity.get() }));
  useFrameStyle(chainLayerRef, () => ({
    opacity: chainOpacity.get(),
    transform: `scale(${chainScale.get()}) translateX(${shakeX.get()}px) translateY(${shakeY.get()}px)`,
  }));
  useFrameStyle(comboRef, () => ({
    opacity: comboOpacity.get(),
    transform: `scale(${comboScale.get()})`,
  }));
  useFrameStyle(hitFlashRef, () => ({ opacity: hitFlashOpacity.get() }));
  useFrameStyle(flashRef, () => ({ opacity: flashOpacity.get() }));
  useFrameStyle(pillarRef, () => ({
    opacity: lightPillarOpacity.get(),
    transform: `scaleY(${lightPillarScale.get()})`,
  }));
  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const hitsRemaining = Math.max(0, CS.requiredHits - hitCount);
  const hintText =
    phase === 'appear'
      ? '⛓️ 锁链封印中'
      : phase === 'idle' || phase === 'hitting'
        ? `⛓️ 连续点击击碎锁链${hitsRemaining > 0 ? `（剩 ${hitsRemaining} 次）` : ''}`
        : phase === 'shatter'
          ? '💥 锁链已碎！'
          : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: BG_GRADIENT }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {!reducedMotion && (
        <div style={FULL_SCREEN}>
          {createStoneBlocks(screenWidth, screenHeight).map((block) => (
            <div
              key={`${block.x}-${block.y}`}
              style={{
                position: 'absolute',
                left: block.x + 2,
                top: block.y,
                width: block.width,
                height: block.height,
                boxSizing: 'border-box',
                backgroundColor: COLORS.stoneWall,
                border: `1px solid ${COLORS.stoneWallBorder}`,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      )}

      {!reducedMotion &&
        createTorchPositions(screenWidth, screenHeight).map((torch) => (
          <span
            key={torch.x}
            style={{
              position: 'absolute',
              left: torch.x + 8,
              top: torch.y + 26,
              zIndex: 2,
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            🔩
          </span>
        ))}

      {phase !== 'revealed' && !reducedMotion && (
        <DungeonAmbience torchFlicker={torchFlicker} dustProgress={dustProgress} />
      )}

      <div
        data-testid={`${testIDPrefix}-tap-area`}
        onClick={handlePress}
        style={{ position: 'absolute', inset: 0 }}
      >
        {!reducedMotion && (
          <div ref={canvasRef} style={FULL_SCREEN}>
            <div ref={chainLayerRef} style={{ ...FULL_SCREEN, opacity: 0, transform: 'scale(0)' }}>
              <Padlock lock={lock} opacity={lockOpacity} />
              <HitArt
                lock={lock}
                cracks={cracks}
                crackOpacities={crackOpacities}
                sparkBursts={sparkBursts}
                sparkProgresses={sparkProgresses}
                shockwaveProgress={
                  phase === 'idle' || phase === 'hitting' ? shockwaveProgress : null
                }
                lightningFlash={lightningFlash}
                debrisVisible={debrisVisible}
              />
              {(phase === 'idle' || phase === 'hitting') && (
                <div style={{ ...CENTERED_OVERLAY, top: lock.cy + lock.height / 2 + 30 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: COLORS.hitText,
                      textShadow: '0px 1px 6px rgba(0, 0, 0, 0.8)',
                    }}
                  >
                    {hitCount} / {CS.requiredHits}
                  </span>
                </div>
              )}
              {phase === 'hitting' && hitCount > 0 && (
                <div
                  ref={comboRef}
                  style={{
                    ...CENTERED_OVERLAY,
                    top: lock.cy - lock.height / 2 - lock.width * 0.3 - 40,
                    opacity: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: COLORS.comboText,
                      textShadow: '0px 2px 8px rgba(0, 0, 0, 0.9)',
                    }}
                  >
                    × {hitCount}
                  </span>
                </div>
              )}
            </div>
            {phase === 'shatter' && (
              <ShatterArt
                lock={lock}
                shatterProgress={shatterProgress}
                burstProgress={radialBurstProgress}
              />
            )}
          </div>
        )}
        <div
          ref={hitFlashRef}
          style={{ ...FULL_SCREEN, backgroundColor: COLORS.breakFlash, opacity: 0 }}
        />
        <div
          ref={flashRef}
          style={{ ...FULL_SCREEN, backgroundColor: theme.glowColor, opacity: 0 }}
        />
      </div>

      <HintWithWarning hintText={hintText} showWarning={autoTimeoutWarning} />

      {phase === 'hitting' && hitCount >= 3 && (
        <div style={{ ...CENTERED_OVERLAY, top: '48%', zIndex: 3 }}>
          <span style={{ fontSize: 18, color: COLORS.springColor, letterSpacing: 4 }}>⌇⌇⌇</span>
        </div>
      )}

      {(phase === 'shatter' || phase === 'revealed') && (
        <div
          ref={pillarRef}
          style={{
            position: 'absolute',
            left: screenWidth / 2 - 20,
            top: 0,
            width: 40,
            height: '100%',
            backgroundColor: COLORS.lightPillar,
            zIndex: 1,
            pointerEvents: 'none',
            opacity: 0,
            transform: 'scaleY(0)',
          }}
        />
      )}

      {(phase === 'shatter' || phase === 'revealed') && (
        <div
          ref={cardWrapperRef}
          style={{
            position: 'absolute',
            inset: 0,
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
