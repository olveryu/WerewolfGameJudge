/**
 * SealBreak: a wax seal ringed by runes and chains; holding or tapping it charges a progress ring
 * and spreads cracks until the seal shatters and the role card springs out.
 *
 * The old Skia seal sat beneath DOM rune text and the card, so it is SVG here: a static layer for
 * the seal itself and a per-frame layer for the charge-driven cracks, ring, beams and particles.
 */
import { type CSSProperties, type PointerEvent, useEffect, useId, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { FULL_SCREEN } from '../common/svg';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  interpolate,
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useRevealFrame,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #0a0810 0%, #100c1a 50%, #0a0810 100%)';

const COLORS = {
  waxDark: '#8B1A1A',
  waxMid: '#B22222',
  waxLight: '#CD5C5C',
  rune: '#FFD700',
  runeGlow: 'rgba(255, 215, 0, 0.4)',
  crack: '#FFE4B5',
  crackGlow: 'rgba(255, 228, 181, 0.6)',
  shardColors: ['#8B1A1A', '#B22222', '#CD5C5C', '#A52A2A', '#DC143C'],
  auraInner: 'rgba(255, 215, 0, 0.3)',
  auraOuter: 'rgba(139, 26, 26, 0.0)',
  progressRing: '#FFD700',
  progressRingBg: 'rgba(255, 215, 0, 0.15)',
  energyParticle: 'rgba(255, 215, 0, 0.6)',
  chargeGlow: 'rgba(255, 200, 50, 0.4)',
  fogColor: 'rgba(20, 10, 30, 0.6)',
  emberCore: '#FF6B00',
  energyBeam: 'rgba(255, 215, 0, 0.5)',
  ancientText: 'rgba(180, 160, 120, 0.4)',
  waxDrip: '#6B1010',
  sealPulse: 'rgba(255, 215, 0, 0.2)',
} as const;

const SB = CONFIG.sealBreak;
const PROGRESS_SEGMENT_COUNT = 36;
const PROGRESS_SEGMENT_GAP = 0.02;
const INNER_RUNES = ['\u263D', '\u2726', '\u269D', '\u25C8', '\u2727', '\u263F'];
const OUTER_RUNES = [
  '\u16A0',
  '\u16A2',
  '\u16A6',
  '\u16A8',
  '\u16B1',
  '\u16B2',
  '\u16B7',
  '\u16B9',
  '\u16BA',
  '\u16BE',
  '\u16C1',
  '\u16C3',
];
const ANCIENT_TEXT_SYMBOLS = ['𐤀', '𐤁', '𐤂', '𐤃', '𐤄', '𐤅', '𐤆', '𐤇', '𐤈', '𐤉'];
const ENERGY_BEAM_ANGLES = Array.from({ length: 8 }, (_, index) => ((Math.PI * 2) / 8) * index);
const CHAIN_ANGLES = Array.from(
  { length: 6 },
  (_, index) => ((Math.PI * 2) / 6) * index + Math.PI / 6,
);

type Phase = 'appear' | 'idle' | 'charging' | 'shatter' | 'revealed';

interface SealGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
}

function createEmbers(screenWidth: number, screenHeight: number) {
  return Array.from({ length: 14 }, () => ({
    startX: screenWidth * 0.3 + Math.random() * screenWidth * 0.4,
    startY: screenHeight * 0.5 + Math.random() * screenHeight * 0.15,
    drift: (Math.random() - 0.5) * 30,
    size: 2 + Math.random() * 2.5,
  }));
}

function createWaxDrips() {
  return Array.from({ length: 5 }, (_, index) => ({
    angle: Math.PI * 0.3 + ((Math.PI * 0.4) / 4) * index,
    length: 12 + Math.random() * 18,
  }));
}

function createShards({ cx, cy }: SealGeometry) {
  return Array.from({ length: SB.shardCount }, (_, index) => {
    const angle = ((Math.PI * 2) / SB.shardCount) * index + (Math.random() - 0.5) * 0.4;
    const distance = 120 + Math.random() * 200;
    return {
      endX: cx + Math.cos(angle) * distance,
      endY: cy + Math.sin(angle) * distance,
      size: 6 + Math.random() * 12,
      color: COLORS.shardColors[index % COLORS.shardColors.length],
    };
  });
}

function createEnergyParticles() {
  return Array.from({ length: SB.energyParticleCount }, (_, index) => ({
    startAngle: ((Math.PI * 2) / SB.energyParticleCount) * index,
    speed: 0.8 + Math.random() * 0.4,
    radiusOffset: Math.random() * 0.3,
  }));
}

function buildCrackPaths({ cx, cy, radius }: SealGeometry): string[] {
  return Array.from({ length: SB.crackCount }, (_, index) => {
    const angle = ((Math.PI * 2) / SB.crackCount) * index;
    let path = `M ${cx} ${cy}`;
    for (let segment = 1; segment <= 4; segment++) {
      const fraction = segment / 4;
      const drift = (Math.random() - 0.5) * radius * 0.15;
      const x = cx + Math.cos(angle) * radius * fraction + Math.cos(angle + Math.PI / 2) * drift;
      const y = cy + Math.sin(angle) * radius * fraction + Math.sin(angle + Math.PI / 2) * drift;
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  });
}

/** An arc clockwise from `startAngle` to `endAngle`, both measured from 12 o'clock. */
function buildArcPath(
  { cx, cy }: SealGeometry,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = startAngle - Math.PI / 2;
  const end = endAngle - Math.PI / 2;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${(cx + radius * Math.cos(start)).toFixed(1)} ${(cy + radius * Math.sin(start)).toFixed(1)} ` +
    `A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 ${largeArc} 1 ` +
    `${(cx + radius * Math.cos(end)).toFixed(1)} ${(cy + radius * Math.sin(end)).toFixed(1)}`
  );
}

function buildProgressSegments(seal: SealGeometry) {
  const segmentAngle = (Math.PI * 2) / PROGRESS_SEGMENT_COUNT;
  return Array.from({ length: PROGRESS_SEGMENT_COUNT }, (_, index) => ({
    path: buildArcPath(
      seal,
      seal.radius * 1.2,
      index * segmentAngle + PROGRESS_SEGMENT_GAP,
      (index + 1) * segmentAngle - PROGRESS_SEGMENT_GAP,
    ),
    threshold: index / PROGRESS_SEGMENT_COUNT,
  }));
}

/** The seal itself, which never changes once drawn. */
function StaticSeal({ seal }: { readonly seal: SealGeometry }) {
  const id = useId();
  const { width, height } = useViewportSize();
  const [waxDrips] = useState(createWaxDrips);
  const { cx, cy, radius } = seal;
  return (
    <svg width={width} height={height} style={FULL_SCREEN}>
      <defs>
        <linearGradient
          id={`${id}-aura`}
          gradientUnits="userSpaceOnUse"
          x1={cx}
          y1={cy - radius * 1.6}
          x2={cx}
          y2={cy + radius * 1.6}
        >
          <stop offset={0} stopColor={COLORS.auraInner} />
          <stop offset={1} stopColor={COLORS.auraOuter} />
        </linearGradient>
        <linearGradient
          id={`${id}-wax`}
          gradientUnits="userSpaceOnUse"
          x1={cx - radius}
          y1={cy - radius}
          x2={cx + radius}
          y2={cy + radius}
        >
          <stop offset={0} stopColor={COLORS.waxLight} />
          <stop offset={1} stopColor={COLORS.waxDark} />
        </linearGradient>
        <filter id={`${id}-pulse`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={8} />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={radius * 1.6} fill={`url(#${id}-aura)`} />
      {buildProgressSegments(seal).map((segment) => (
        <path
          key={segment.threshold}
          d={segment.path}
          fill="none"
          stroke={COLORS.progressRingBg}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={radius * 1.15}
        fill="none"
        stroke={COLORS.sealPulse}
        strokeWidth={6}
        filter={`url(#${id}-pulse)`}
      />
      <circle cx={cx} cy={cy} r={radius} fill={`url(#${id}-wax)`} />
      <circle cx={cx} cy={cy} r={radius - 2} fill="none" stroke={COLORS.waxDark} strokeWidth={4} />
      <circle
        cx={cx}
        cy={cy}
        r={radius * 0.85}
        fill="none"
        stroke={COLORS.rune}
        strokeWidth={2}
        opacity={0.3}
      />
      {waxDrips.map((drip) => {
        const x = cx + Math.cos(drip.angle) * radius;
        const y = cy + Math.sin(drip.angle) * radius;
        return (
          <g key={drip.angle} fill={COLORS.waxDrip}>
            <circle cx={x} cy={y + drip.length * 0.5} r={4} />
            <circle cx={x} cy={y + drip.length} r={3} />
            <circle cx={x} cy={y + drip.length * 0.25} r={3.5} />
          </g>
        );
      })}
      <g stroke={COLORS.rune} strokeWidth={3}>
        <line x1={cx - radius * 0.3} y1={cy} x2={cx + radius * 0.3} y2={cy} />
        <line x1={cx} y1={cy - radius * 0.3} x2={cx} y2={cy + radius * 0.3} />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={radius * 0.5}
        fill="none"
        stroke={COLORS.rune}
        strokeWidth={1.5}
        opacity={0.4}
      />
    </svg>
  );
}

interface ChargeArtProps {
  readonly seal: SealGeometry;
  readonly charge: SharedValue;
  readonly energyBeamOpacity: SharedValue;
  readonly energyRotation: SharedValue;
  readonly emberCycle: SharedValue;
}

/** The charge-driven layer: radial beams, progress ring, cracks, converging motes and embers. */
function ChargeArt({
  seal,
  charge,
  energyBeamOpacity,
  energyRotation,
  emberCycle,
}: ChargeArtProps) {
  const id = useId();
  const { width, height } = useViewportSize();
  const { cx, cy, radius } = seal;
  const [crackPaths] = useState(() => buildCrackPaths(seal));
  const [energyParticles] = useState(createEnergyParticles);
  const [embers] = useState(() => createEmbers(width, height));
  const progressSegments = buildProgressSegments(seal);

  const beamsRef = useRef<SVGGElement>(null);
  const segmentRefs = useRef<(SVGPathElement | null)[]>([]);
  const crackRefs = useRef<(SVGPathElement | null)[]>([]);
  const particleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const emberRefs = useRef<(SVGGElement | null)[]>([]);

  useRevealFrame(() => {
    const level = charge.get();
    beamsRef.current?.setAttribute('opacity', String(energyBeamOpacity.get()));
    progressSegments.forEach((segment, index) => {
      const opacity =
        level > segment.threshold
          ? interpolate(level, [segment.threshold, Math.min(segment.threshold + 0.05, 1)], [0.5, 1])
          : 0;
      segmentRefs.current[index]?.setAttribute('opacity', String(opacity));
    });
    crackRefs.current.forEach((crack) => {
      crack?.setAttribute('visibility', level > 0 ? 'visible' : 'hidden');
      crack?.setAttribute('stroke-dasharray', `${level} 2`);
    });
    const rotation = energyRotation.get();
    const particleOpacity = interpolate(level, [0, 0.1, 0.5], [0, 0.5, 0.9]);
    energyParticles.forEach((particle, index) => {
      const element = particleRefs.current[index];
      if (!element) return;
      const angle = particle.startAngle + rotation * particle.speed;
      const orbit =
        radius * (1.4 + particle.radiusOffset) - level * radius * (0.5 + particle.radiusOffset);
      element.setAttribute('cx', String(cx + Math.cos(angle) * orbit - 3));
      element.setAttribute('cy', String(cy + Math.sin(angle) * orbit - 3));
      element.setAttribute('opacity', String(particleOpacity));
    });
    const cycle = emberCycle.get();
    embers.forEach((ember, index) => {
      emberRefs.current[index]?.setAttribute(
        'transform',
        `translate(${Math.sin(cycle * Math.PI * 2) * ember.drift} ${-cycle * 180})`,
      );
      emberRefs.current[index]?.setAttribute(
        'opacity',
        String(interpolate(cycle, [0, 0.2, 0.7, 1], [0, 0.8 * level, 0.3, 0])),
      );
    });
  });

  return (
    <svg width={width} height={height} style={FULL_SCREEN}>
      <defs>
        <filter id={`${id}-ember`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
      </defs>
      <g ref={beamsRef} opacity={0} stroke={COLORS.energyBeam} strokeWidth={2}>
        {ENERGY_BEAM_ANGLES.map((angle) => (
          <line
            key={angle}
            x1={cx + Math.cos(angle) * radius * 0.5}
            y1={cy + Math.sin(angle) * radius * 0.5}
            x2={cx + Math.cos(angle) * radius * 1.8}
            y2={cy + Math.sin(angle) * radius * 1.8}
          />
        ))}
      </g>
      {progressSegments.map((segment, index) => (
        <path
          key={segment.threshold}
          ref={(element) => {
            segmentRefs.current[index] = element;
          }}
          d={segment.path}
          fill="none"
          stroke={COLORS.progressRing}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0}
        />
      ))}
      {[
        { color: COLORS.crack, width: 2.5, opacity: 1 },
        { color: COLORS.crackGlow, width: 6, opacity: 0.5 },
      ].flatMap((layer, layerIndex) =>
        crackPaths.map((path, index) => (
          <path
            key={`${layerIndex}-${index}`}
            ref={(element) => {
              crackRefs.current[layerIndex * crackPaths.length + index] = element;
            }}
            d={path}
            pathLength={1}
            fill="none"
            stroke={layer.color}
            strokeWidth={layer.width}
            strokeLinecap="round"
            strokeDasharray="0 2"
            visibility="hidden"
            opacity={layer.opacity}
          />
        )),
      )}
      {energyParticles.map((particle, index) => (
        <circle
          key={particle.startAngle}
          ref={(element) => {
            particleRefs.current[index] = element;
          }}
          r={3}
          fill={COLORS.energyParticle}
          opacity={0}
        />
      ))}
      {embers.map((ember, index) => (
        <g
          key={index}
          ref={(element) => {
            emberRefs.current[index] = element;
          }}
          opacity={0}
        >
          <circle cx={ember.startX} cy={ember.startY} r={ember.size} fill={COLORS.emberCore} />
          {/* The old Skia glow circle had no color, so it drew Skia's default black. */}
          <circle
            cx={ember.startX}
            cy={ember.startY}
            r={ember.size * 2}
            fill="#000000"
            filter={`url(#${id}-ember)`}
          />
        </g>
      ))}
    </svg>
  );
}

interface SealTextProps {
  readonly seal: SealGeometry;
  readonly runeRotation: SharedValue;
  readonly chainRattle: SharedValue;
  readonly ancientTextRotation: SharedValue;
}

const GLYPH_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  margin: 0,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

/** The rune, chain and ancient-script glyphs orbiting the seal. */
function SealText({ seal, runeRotation, chainRattle, ancientTextRotation }: SealTextProps) {
  const { cx, cy, radius } = seal;
  const outerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const chainRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ancientRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useRevealFrame(() => {
    const runeAngle = runeRotation.get();
    OUTER_RUNES.forEach((_, index) => {
      const angle = ((Math.PI * 2) / OUTER_RUNES.length) * index + runeAngle;
      const element = outerRefs.current[index];
      if (element) {
        element.style.transform = `translate(${cx + Math.cos(angle) * radius * 1.45 - 10}px, ${cy + Math.sin(angle) * radius * 1.45 - 10}px)`;
      }
    });
    const rattle = chainRattle.get();
    CHAIN_ANGLES.forEach((angle, index) => {
      const element = chainRefs.current[index];
      if (!element) return;
      const x = cx + Math.cos(angle) * radius * 1.7 - 12;
      const y = cy + Math.sin(angle) * radius * 1.7 - 12 + Math.sin(rattle * Math.PI * 6) * 3;
      element.style.transform = `translate(${x}px, ${y}px)`;
      element.style.opacity = String(interpolate(rattle, [0, 0.5, 1], [0.5, 0.8, 0.5]));
    });
    const ancientAngle = ancientTextRotation.get();
    ANCIENT_TEXT_SYMBOLS.forEach((_, index) => {
      const angle = ((Math.PI * 2) / ANCIENT_TEXT_SYMBOLS.length) * index - ancientAngle;
      const element = ancientRefs.current[index];
      if (element) {
        element.style.transform = `translate(${cx + Math.cos(angle) * radius * 1.05 - 8}px, ${cy + Math.sin(angle) * radius * 1.05 - 8}px)`;
      }
    });
  });

  return (
    <>
      {INNER_RUNES.map((symbol, index) => {
        const angle = ((Math.PI * 2) / INNER_RUNES.length) * index - Math.PI / 2;
        return (
          <span
            key={symbol}
            style={{
              ...GLYPH_STYLE,
              transform: `translate(${cx + Math.cos(angle) * radius * 0.65 - 12}px, ${cy + Math.sin(angle) * radius * 0.65 - 12}px)`,
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.rune,
              textShadow: `0px 0px 8px ${COLORS.runeGlow}`,
            }}
          >
            {symbol}
          </span>
        );
      })}
      {OUTER_RUNES.map((symbol, index) => (
        <span
          key={symbol}
          ref={(element) => {
            outerRefs.current[index] = element;
          }}
          style={{
            ...GLYPH_STYLE,
            fontSize: 16,
            fontWeight: 500,
            color: 'rgba(255, 215, 0, 0.5)',
            textShadow: '0px 0px 6px rgba(255, 215, 0, 0.3)',
          }}
        >
          {symbol}
        </span>
      ))}
      {CHAIN_ANGLES.map((angle, index) => (
        <span
          key={angle}
          ref={(element) => {
            chainRefs.current[index] = element;
          }}
          style={{
            ...GLYPH_STYLE,
            fontSize: 20,
            textShadow: '0px 0px 4px rgba(200, 200, 200, 0.3)',
          }}
        >
          ⛓
        </span>
      ))}
      {ANCIENT_TEXT_SYMBOLS.map((symbol, index) => (
        <span
          key={symbol}
          ref={(element) => {
            ancientRefs.current[index] = element;
          }}
          style={{ ...GLYPH_STYLE, fontSize: 12, fontWeight: 400, color: COLORS.ancientText }}
        >
          {symbol}
        </span>
      ))}
    </>
  );
}

/** Red shards of wax flying out from the seal's center. */
function Shards({
  seal,
  progress,
}: {
  readonly seal: SealGeometry;
  readonly progress: SharedValue;
}) {
  const { width, height } = useViewportSize();
  const [shards] = useState(() => createShards(seal));
  const shardRefs = useRef<(SVGRectElement | null)[]>([]);

  useRevealFrame(() => {
    const value = progress.get();
    const opacity = interpolate(value, [0, 0.5, 1], [1, 0.8, 0]);
    shards.forEach((shard, index) => {
      const element = shardRefs.current[index];
      if (!element) return;
      element.setAttribute(
        'x',
        String(interpolate(value, [0, 1], [seal.cx, shard.endX]) - shard.size / 2),
      );
      element.setAttribute(
        'y',
        String(interpolate(value, [0, 1], [seal.cy, shard.endY]) - shard.size / 2),
      );
      element.setAttribute('opacity', String(opacity));
    });
  });

  return (
    <svg width={width} height={height} style={FULL_SCREEN}>
      {shards.map((shard, index) => (
        <rect
          key={index}
          ref={(element) => {
            shardRefs.current[index] = element;
          }}
          x={seal.cx - shard.size / 2}
          y={seal.cy - shard.size / 2}
          width={shard.size}
          height={shard.size}
          fill={shard.color}
        />
      ))}
    </svg>
  );
}

function createChargeLoop() {
  return { lastFrameMs: 0, pressing: false, pressStartMs: 0, shattered: false };
}

/** Hold or tap the seal to charge it until it shatters and releases the role card. */
export default function SealBreak({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const seal: SealGeometry = {
    cx: screenWidth / 2,
    cy: screenHeight / 2,
    radius: screenWidth * SB.sealRadiusRatio,
  };
  const chargeRate = 1 / SB.chargeDuration;
  const decayRate = SB.decayRate / 1000;

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'appear');
  const { fireComplete } = useRevealLifecycle(onComplete, SB.revealHoldDuration);
  const chargeLoopRef = useRef(createChargeLoop());

  const sealScale = useSharedValue(0);
  const sealOpacity = useSharedValue(0);
  const charge = useSharedValue(0);
  // Follows `charge` from the charge loop only, so an auto or tap shatter leaves it where it was.
  const chargeGlowOpacity = useSharedValue(0);
  const shatterProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const runeRotation = useSharedValue(0);
  const energyRotation = useSharedValue(0);
  const fogPulse = useSharedValue(0);
  const emberCycle = useSharedValue(0);
  const chainRattle = useSharedValue(0);
  const energyBeamOpacity = useSharedValue(0);
  const ancientTextRotation = useSharedValue(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const sealLayerRef = useRef<HTMLDivElement>(null);
  const fogRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chargeGlowRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    sealOpacity.animate(withTiming(1, { duration: SB.sealAppearDuration / 2 }));
    sealScale.animate(
      withTiming(1, { duration: SB.sealAppearDuration, easing: Easing.out(Easing.back(1.2)) }),
      () => setPhase('idle'),
    );
    runeRotation.animate(withTiming(Math.PI * 20, { duration: 60000, easing: Easing.linear }));
    energyRotation.animate(withTiming(Math.PI * 40, { duration: 60000, easing: Easing.linear }));
    fogPulse.animate(
      withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    emberCycle.animate(withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1));
    chainRattle.animate(withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1));
    ancientTextRotation.animate(
      withTiming(Math.PI * 12, { duration: 60000, easing: Easing.linear }),
    );
  }, [
    reducedMotion,
    sealOpacity,
    sealScale,
    runeRotation,
    energyRotation,
    fogPulse,
    emberCycle,
    chainRattle,
    ancientTextRotation,
  ]);

  const triggerShatter = () => {
    const loop = chargeLoopRef.current;
    if (loop.shattered) return;
    loop.shattered = true;
    setPhase('shatter');
    flashOpacity.animate(
      withSequence(withTiming(0.7, { duration: 100 }), withTiming(0, { duration: 400 })),
    );
    shatterProgress.animate(
      withTiming(1, { duration: SB.shatterDuration, easing: Easing.out(Easing.cubic) }),
    );
    canvasOpacity.animate(withDelay(200, withTiming(0, { duration: 300 })));
    cardScale.animate(
      withDelay(
        300,
        withTiming(1, {
          duration: SB.cardRevealDuration,
          easing: Easing.out(Easing.back(1.15)),
        }),
      ),
      () => setPhase('revealed'),
    );
    cardOpacity.animate(withDelay(300, withTiming(1, { duration: SB.cardRevealDuration })));
  };

  useRevealFrame((nowMs) => {
    const loop = chargeLoopRef.current;
    if ((phase !== 'idle' && phase !== 'charging') || loop.shattered) return;
    const elapsed = loop.lastFrameMs ? nowMs - loop.lastFrameMs : 16;
    loop.lastFrameMs = nowMs;
    const level = loop.pressing
      ? Math.min(1, charge.get() + chargeRate * elapsed)
      : Math.max(0, charge.get() - decayRate * elapsed);
    charge.set(level);
    chargeGlowOpacity.set(level * 0.8);
    energyBeamOpacity.set(level > 0.3 ? (level - 0.3) / 0.7 : 0);
    if (percentRef.current) percentRef.current.textContent = `${Math.floor(level * 100)}%`;
    if (level >= 1) triggerShatter();
  });

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' || phase === 'charging', () => {
    if (chargeLoopRef.current.shattered) return;
    charge.set(1);
    triggerShatter();
  });

  const handlePressIn = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle' && phase !== 'charging') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const loop = chargeLoopRef.current;
    loop.pressStartMs = performance.now();
    loop.pressing = true;
    if (phase === 'idle') setPhase('charging');
  };

  const handlePressOut = () => {
    const loop = chargeLoopRef.current;
    if (!loop.pressing) return;
    loop.pressing = false;
    if (loop.shattered) return;
    if (performance.now() - loop.pressStartMs < SB.tapThreshold) {
      const boosted = Math.min(1, charge.get() + SB.tapBoost);
      charge.set(boosted);
      if (boosted >= 1) triggerShatter();
    }
  };

  useFrameStyle(canvasRef, () => ({ opacity: canvasOpacity.get() }));
  useFrameStyle(sealLayerRef, () => ({
    opacity: sealOpacity.get(),
    transform: `scale(${sealScale.get()})`,
  }));
  useRevealFrame(() => {
    const opacity = String(fogPulse.get());
    fogRefs.current.forEach((fog) => {
      if (fog) fog.style.opacity = opacity;
    });
  });
  useFrameStyle(chargeGlowRef, () => ({ opacity: chargeGlowOpacity.get() }));
  useFrameStyle(flashRef, () => ({ opacity: flashOpacity.get() }));
  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const fogCircles = [
    { x: 0, y: screenHeight * 0.65, r: 130 },
    { x: screenWidth, y: screenHeight * 0.7, r: 110 },
    { x: screenWidth * 0.3, y: screenHeight, r: 150 },
    { x: screenWidth * 0.7, y: screenHeight * 0.95, r: 120 },
  ];

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: BG_GRADIENT }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      <div
        data-testid={`${testIDPrefix}-press-area`}
        onPointerDown={handlePressIn}
        onPointerUp={handlePressOut}
        onPointerCancel={handlePressOut}
        style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      >
        {!reducedMotion && (
          <div ref={canvasRef} style={{ ...FULL_SCREEN }}>
            <div ref={sealLayerRef} style={{ ...FULL_SCREEN, opacity: 0, transform: 'scale(0)' }}>
              {fogCircles.map((fog, index) => (
                <div
                  key={index}
                  ref={(element) => {
                    fogRefs.current[index] = element;
                  }}
                  style={{
                    position: 'absolute',
                    left: fog.x - fog.r,
                    top: fog.y - fog.r,
                    width: fog.r * 2,
                    height: fog.r * 2,
                    borderRadius: '50%',
                    backgroundColor: COLORS.fogColor,
                    filter: 'blur(40px)',
                    opacity: 0,
                  }}
                />
              ))}
              <StaticSeal seal={seal} />
              <ChargeArt
                seal={seal}
                charge={charge}
                energyBeamOpacity={energyBeamOpacity}
                energyRotation={energyRotation}
                emberCycle={emberCycle}
              />
              <SealText
                seal={seal}
                runeRotation={runeRotation}
                chainRattle={chainRattle}
                ancientTextRotation={ancientTextRotation}
              />
            </div>
            {phase === 'shatter' && <Shards seal={seal} progress={shatterProgress} />}
          </div>
        )}
        <div
          ref={chargeGlowRef}
          style={{ ...FULL_SCREEN, backgroundColor: COLORS.chargeGlow, opacity: 0 }}
        />
        <div
          ref={flashRef}
          style={{ ...FULL_SCREEN, backgroundColor: theme.glowColor, opacity: 0 }}
        />
      </div>

      {phase === 'charging' && (
        <div
          style={{
            position: 'absolute',
            bottom: 130,
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: REVEAL_DOM_LAYER.aboveCanvas,
          }}
        >
          <span
            ref={percentRef}
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.progressRing,
              textShadow: '0px 1px 6px rgba(0, 0, 0, 0.6)',
            }}
          />
        </div>
      )}

      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '🔮 封印凝聚中…'
            : phase === 'idle'
              ? '🔮 长按或连续点击封印蓄力'
              : phase === 'charging'
                ? '🔮 持续按住或点击…能量灌注中…'
                : phase === 'shatter'
                  ? '✨ 封印已破！'
                  : null
        }
        showWarning={autoTimeoutWarning}
      />

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
