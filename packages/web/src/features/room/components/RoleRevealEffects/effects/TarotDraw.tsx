/**
 * TarotDraw: a wheel of tarot cards turns over a candle-lit velvet table; picking one flies it to
 * the center, a magic circle lights up behind it and the card flips to the role.
 *
 * The old Skia scene (starfield, crystal ball, candles, magic circle, trail) sat beneath the cards,
 * which cover most of it, so it is one SVG layer under the DOM cards here. The card back, a Skia
 * texture in the old client, is an SVG drawing scaled into each card.
 */
import { type CSSProperties, useEffect, useId, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import type { RevealAlignment } from '../../../model/RevealRoleData';
import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
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

const TAROT_COLORS = {
  cardBack: ['#2a2a4e', '#3d3d64', '#2a2a4e'],
  gold: '#d4af37',
  goldGlow: '#ffd700',
  starfield: '#c8c8ff',
  candleYellow: '#ffe066',
  candleOrange: '#ff9933',
  velvetFringe: '#c9a84c',
  crystalBall: '#6644aa',
  magicCircle: '#c9a84c',
  background: '#070012',
} as const;

const FORTUNE_QUOTES: Record<RevealAlignment, string> = {
  wolf: '暗月低语，獠牙已露…',
  god: '圣光降临，命运已定…',
  villager: '晨曦微暖，守护前行…',
  third: '迷雾深处，命运未知…',
  neutral: '晨曦微暖，守护前行…',
};

const WHEEL_CARD_COUNT = 8;
const WHEEL_CARD_SCALE = 0.32;
const CARD_RADIUS = 14;
const WHEEL_CARD_RADIUS = 10;

const CARD_BACK_PADDING = 6;
const CARD_BACK_BORDER_WIDTH = 2;
const CARD_BACK_INNER_RADIUS = 10;
const CARD_BACK_MOON_R = 10;
const CARD_BACK_STAR_SPACING = 24;
const CARD_BACK_STAR_LEN = 6;
const CARD_BACK_DIAG_LEN = 4;

type Phase = 'waiting' | 'drawing' | 'flipping' | 'revealed';

function createTarotStars(screenWidth: number, screenHeight: number) {
  return Array.from({ length: 30 }, (_, index) => ({
    x: (((index * 73 + 17) % 100) / 100) * screenWidth,
    y: (((index * 41 + 31) % 100) / 100) * screenHeight * 0.65,
    r: 0.5 + (((index * 59 + 7) % 100) / 100) * 1.2,
    twinkle: index < 5,
    phase: ((index * 83 + 11) % 628) / 100,
  }));
}

function buildHexagramPath(cx: number, cy: number, radius: number): string {
  return [0, 1]
    .map((triangle) => {
      const offset = triangle * (Math.PI / 6);
      const points = [0, 1, 2].map((corner) => {
        const angle = offset + (Math.PI * 2 * corner) / 3 - Math.PI / 2;
        return `${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}`;
      });
      return `M ${points.join(' L ')} Z`;
    })
    .join(' ');
}

/** A Gaussian blur filter of standard deviation `sigma` with room for the blurred edge. */
function BlurFilter({ id, sigma }: { readonly id: string; readonly sigma: number }) {
  return (
    <filter id={id} x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation={sigma} />
    </filter>
  );
}

/** The old Skia card-back texture, drawn at full card size and stretched to fill its box. */
function TarotCardBack({ width, height }: { readonly width: number; readonly height: number }) {
  const id = useId();
  const cx = width / 2;
  const moonY = height * 0.32;
  const starY = height * 0.48;
  const vineY = height * 0.62;
  const gold = TAROT_COLORS.gold;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={0}
          x2={width}
          y2={height}
        >
          {TAROT_COLORS.cardBack.map((color, index) => (
            <stop key={index} offset={index / 2} stopColor={color} />
          ))}
        </linearGradient>
        <BlurFilter id={`${id}-glow`} sigma={1} />
      </defs>
      <rect width={width} height={height} rx={CARD_RADIUS} fill={`url(#${id}-bg)`} />
      <rect
        x={CARD_BACK_PADDING}
        y={CARD_BACK_PADDING}
        width={width - CARD_BACK_PADDING * 2}
        height={height - CARD_BACK_PADDING * 2}
        rx={CARD_BACK_INNER_RADIUS}
        fill="none"
        stroke={gold}
        strokeWidth={CARD_BACK_BORDER_WIDTH}
      />
      <circle
        cx={cx}
        cy={moonY}
        r={CARD_BACK_MOON_R + 3}
        fill={TAROT_COLORS.goldGlow}
        filter={`url(#${id}-glow)`}
      />
      <circle cx={cx} cy={moonY} r={CARD_BACK_MOON_R} fill={gold} />
      <circle cx={cx + 4} cy={moonY - 2} r={CARD_BACK_MOON_R - 2} fill={TAROT_COLORS.cardBack[0]} />
      {[-1, 0, 1].map((offset) => {
        const sx = cx + offset * CARD_BACK_STAR_SPACING;
        return (
          <g key={offset} stroke={gold} strokeLinecap="round">
            <line
              x1={sx}
              y1={starY - CARD_BACK_STAR_LEN}
              x2={sx}
              y2={starY + CARD_BACK_STAR_LEN}
              strokeWidth={1.2}
            />
            <line
              x1={sx - CARD_BACK_STAR_LEN}
              y1={starY}
              x2={sx + CARD_BACK_STAR_LEN}
              y2={starY}
              strokeWidth={1.2}
            />
            <line
              x1={sx - CARD_BACK_DIAG_LEN}
              y1={starY - CARD_BACK_DIAG_LEN}
              x2={sx + CARD_BACK_DIAG_LEN}
              y2={starY + CARD_BACK_DIAG_LEN}
              strokeWidth={0.7}
            />
            <line
              x1={sx + CARD_BACK_DIAG_LEN}
              y1={starY - CARD_BACK_DIAG_LEN}
              x2={sx - CARD_BACK_DIAG_LEN}
              y2={starY + CARD_BACK_DIAG_LEN}
              strokeWidth={0.7}
            />
            <circle cx={sx} cy={starY} r={1.5} fill={gold} stroke="none" />
          </g>
        );
      })}
      <circle cx={cx - 20} cy={vineY} r={3} fill={gold} opacity={0.5} />
      <line
        x1={cx - 12}
        y1={vineY}
        x2={cx + 12}
        y2={vineY}
        stroke={gold}
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.4}
      />
      <circle cx={cx + 20} cy={vineY} r={3} fill={gold} opacity={0.5} />
      <path
        d={`M ${cx} ${vineY - 5} L ${cx + 4} ${vineY} L ${cx} ${vineY + 5} L ${cx - 4} ${vineY} Z`}
        fill={gold}
        opacity={0.6}
      />
    </svg>
  );
}

/** The old `SkiaSparkle` in SVG: a blurred halo under a 4- or 8-pointed spike star. */
function SvgSparkle({
  x,
  y,
  r,
  bright,
  haloFilter,
}: {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly bright: boolean;
  readonly haloFilter: string;
}) {
  const vertical = r * 3.5;
  const horizontal = r * 2.5;
  const diagonal = r * 2;
  const width = bright ? 1.2 : 0.8;
  const color = TAROT_COLORS.starfield;
  return (
    <>
      <circle cx={x} cy={y} r={r * 4} fill={color} filter={haloFilter} />
      <g stroke={color} strokeLinecap="round">
        <line x1={x} y1={y - vertical} x2={x} y2={y + vertical} strokeWidth={width} />
        <line x1={x - horizontal} y1={y} x2={x + horizontal} y2={y} strokeWidth={width} />
        {bright && (
          <>
            <line
              x1={x - diagonal}
              y1={y - diagonal}
              x2={x + diagonal}
              y2={y + diagonal}
              strokeWidth={width * 0.6}
            />
            <line
              x1={x + diagonal}
              y1={y - diagonal}
              x2={x - diagonal}
              y2={y + diagonal}
              strokeWidth={width * 0.6}
            />
          </>
        )}
      </g>
      <circle cx={x} cy={y} r={r * 0.5} fill={color} />
    </>
  );
}

interface TarotBackdropProps {
  readonly cardWidth: number;
  readonly wheelRadius: number;
  readonly starCycle: SharedValue;
  readonly candleFlicker: SharedValue;
  readonly crystalPulse: SharedValue;
  readonly magicCircleRotation: SharedValue;
  readonly magicCircleOpacity: SharedValue;
  readonly trailOpacity: SharedValue;
}

/** The starfield, crystal ball, candles, magic circle and draw trail beneath the cards. */
function TarotBackdrop({
  cardWidth,
  wheelRadius,
  starCycle,
  candleFlicker,
  crystalPulse,
  magicCircleRotation,
  magicCircleOpacity,
  trailOpacity,
}: TarotBackdropProps) {
  const id = useId();
  const { width, height } = useViewportSize();
  const stars = createTarotStars(width, height);
  const twinkleStars = stars.filter((star) => star.twinkle);
  const crystalX = width / 2;
  const crystalY = height * 0.18;
  const candleY = height * 0.35;
  const flameY = candleY - 14;
  const candles = [
    { x: width * 0.12, flameSpeed: 1, flamePhase: 0, opacitySpeed: 2.1, opacityPhase: 0 },
    { x: width * 0.88, flameSpeed: 1.3, flamePhase: 1, opacitySpeed: 1.7, opacityPhase: 2 },
  ];
  const circleX = width / 2;
  const circleY = height / 2;
  const circleRadius = cardWidth * 0.55;

  const twinkleRefs = useRef<(SVGGElement | null)[]>([]);
  const flameRefs = useRef<(SVGCircleElement | null)[]>([]);
  const fogRef = useRef<SVGCircleElement>(null);
  const magicCircleRef = useRef<SVGGElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  useRevealFrame(() => {
    const cycle = starCycle.get();
    twinkleStars.forEach((star, index) => {
      twinkleRefs.current[index]?.setAttribute(
        'opacity',
        String(0.3 + Math.sin(cycle + star.phase) * 0.3),
      );
    });
    const flicker = candleFlicker.get();
    candles.forEach((candle, index) => {
      const flame = flameRefs.current[index];
      if (!flame) return;
      flame.setAttribute(
        'cy',
        String(flameY - Math.sin(flicker * candle.flameSpeed + candle.flamePhase) * 2),
      );
      flame.setAttribute(
        'opacity',
        String(0.7 + Math.sin(flicker * candle.opacitySpeed + candle.opacityPhase) * 0.2),
      );
    });
    const pulse = crystalPulse.get();
    fogRef.current?.setAttribute('r', String(28 + pulse * 4));
    fogRef.current?.setAttribute('opacity', String(0.2 + pulse * 0.15));
    const magicCircle = magicCircleRef.current;
    if (magicCircle) {
      magicCircle.setAttribute('opacity', String(magicCircleOpacity.get()));
      magicCircle.setAttribute(
        'transform',
        `rotate(${(magicCircleRotation.get() * 180) / Math.PI} ${circleX} ${circleY})`,
      );
    }
  });
  useFrameStyle(trailRef, () => ({ opacity: trailOpacity.get() }));

  const blur = (sigma: number) => `url(#${id}-blur-${String(sigma).replace('.', '_')})`;
  const fullScreen: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  };

  return (
    <>
      <svg width={width} height={height} style={{ ...fullScreen, mixBlendMode: 'screen' }}>
        <defs>
          <BlurFilter id={`${id}-blur-3`} sigma={3} />
          <BlurFilter id={`${id}-blur-5`} sigma={5} />
        </defs>
        {stars
          .filter((star) => !star.twinkle)
          .map((star) => (
            <circle
              key={`${star.x}-${star.y}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill={TAROT_COLORS.starfield}
              opacity={0.35}
            />
          ))}
        {twinkleStars.map((star, index) => (
          <g
            key={`${star.x}-${star.y}`}
            ref={(element) => {
              twinkleRefs.current[index] = element;
            }}
            opacity={0.3 + Math.sin(star.phase) * 0.3}
          >
            <SvgSparkle
              x={star.x}
              y={star.y}
              r={star.r}
              bright={star.r > 1}
              haloFilter={blur(star.r > 1 ? 5 : 3)}
            />
          </g>
        ))}
      </svg>
      <svg width={width} height={height} style={fullScreen}>
        <defs>
          {[1, 1.5, 2, 4, 6, 8, 12].map((sigma) => (
            <BlurFilter
              key={sigma}
              id={`${id}-blur-${String(sigma).replace('.', '_')}`}
              sigma={sigma}
            />
          ))}
          <radialGradient
            id={`${id}-crystal-glow`}
            gradientUnits="userSpaceOnUse"
            cx={crystalX}
            cy={crystalY}
            r={36}
          >
            <stop offset={0} stopColor={`${TAROT_COLORS.crystalBall}40`} />
            <stop offset={1} stopColor={`${TAROT_COLORS.crystalBall}00`} />
          </radialGradient>
          <radialGradient
            id={`${id}-crystal-body`}
            gradientUnits="userSpaceOnUse"
            cx={crystalX - 5}
            cy={crystalY - 5}
            r={22}
          >
            <stop offset={0} stopColor="#443388" />
            <stop offset={1} stopColor="#1a0a2e" />
          </radialGradient>
          <radialGradient
            id={`${id}-crystal-fog`}
            gradientUnits="userSpaceOnUse"
            cx={crystalX}
            cy={crystalY}
            r={30}
          >
            <stop offset={0} stopColor={`${TAROT_COLORS.crystalBall}80`} />
            <stop offset={1} stopColor={`${TAROT_COLORS.crystalBall}00`} />
          </radialGradient>
          {candles.map((candle, index) => (
            <radialGradient
              key={`flame-${index}`}
              id={`${id}-flame-${index}`}
              gradientUnits="userSpaceOnUse"
              cx={candle.x}
              cy={flameY}
              r={8}
            >
              <stop offset={0} stopColor={TAROT_COLORS.candleYellow} />
              <stop offset={0.5} stopColor={TAROT_COLORS.candleOrange} />
              <stop offset={1} stopColor="#ff440000" />
            </radialGradient>
          ))}
          {candles.map((candle, index) => (
            <radialGradient
              key={`halo-${index}`}
              id={`${id}-halo-${index}`}
              gradientUnits="userSpaceOnUse"
              cx={candle.x}
              cy={flameY}
              r={16}
            >
              <stop offset={0} stopColor={TAROT_COLORS.candleYellow} />
              <stop offset={1} stopColor="#00000000" />
            </radialGradient>
          ))}
        </defs>

        <circle
          cx={crystalX}
          cy={crystalY}
          r={36}
          fill={`url(#${id}-crystal-glow)`}
          filter={blur(12)}
        />
        <circle cx={crystalX} cy={crystalY} r={22} fill={`url(#${id}-crystal-body)`} />
        <circle
          ref={fogRef}
          cx={crystalX}
          cy={crystalY}
          r={28}
          opacity={0.2}
          fill={`url(#${id}-crystal-fog)`}
          filter={blur(6)}
        />
        <circle
          cx={crystalX - 7}
          cy={crystalY - 7}
          r={5}
          fill="#ffffff"
          opacity={0.25}
          filter={blur(2)}
        />
        <circle cx={crystalX} cy={crystalY + 22} r={8} fill="#332244" opacity={0.6} />

        {candles.map((candle, index) => (
          <g key={candle.x}>
            <circle cx={candle.x} cy={candleY} r={5} fill="#e8d8b8" />
            <circle cx={candle.x} cy={candleY + 8} r={5} fill="#e0c8a0" />
            <circle
              ref={(element) => {
                flameRefs.current[index] = element;
              }}
              cx={candle.x}
              cy={flameY}
              r={6}
              fill={`url(#${id}-flame-${index})`}
              filter={blur(4)}
            />
            <circle
              cx={candle.x}
              cy={flameY}
              r={16}
              opacity={0.12}
              fill={`url(#${id}-halo-${index})`}
              filter={blur(8)}
            />
          </g>
        ))}

        <g ref={magicCircleRef} opacity={0}>
          <circle
            cx={circleX}
            cy={circleY}
            r={circleRadius}
            fill="none"
            stroke={TAROT_COLORS.magicCircle}
            strokeWidth={1}
            filter={blur(2)}
          />
          <circle
            cx={circleX}
            cy={circleY}
            r={circleRadius * 0.7}
            fill="none"
            stroke={TAROT_COLORS.magicCircle}
            strokeWidth={0.8}
            filter={blur(1)}
          />
          <path
            d={buildHexagramPath(circleX, circleY, circleRadius)}
            fill="none"
            stroke={TAROT_COLORS.magicCircle}
            strokeWidth={1}
            filter={blur(1.5)}
          />
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const angle = (Math.PI * 2 * index) / 6;
            return (
              <circle
                key={index}
                cx={circleX + Math.cos(angle) * circleRadius * 0.85}
                cy={circleY + Math.sin(angle) * circleRadius * 0.85}
                r={2}
                fill={TAROT_COLORS.gold}
                filter={blur(2)}
              />
            );
          })}
        </g>
      </svg>
      <div
        ref={trailRef}
        style={{
          position: 'absolute',
          left: width / 2 - 1.5,
          top: height / 2 - wheelRadius,
          width: 3,
          height: wheelRadius,
          backgroundColor: TAROT_COLORS.goldGlow,
          filter: 'blur(6px)',
          mixBlendMode: 'screen',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

/** Pick a card from a turning tarot wheel; it flies to the center and flips to the role. */
export default function TarotDraw({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const wheelRadius = Math.min(screenWidth * 0.32, 130);
  const wheelCardWidth = cardWidth * WHEEL_CARD_SCALE;
  const wheelCardHeight = cardHeight * WHEEL_CARD_SCALE;

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const { fireComplete } = useRevealLifecycle(onComplete, CONFIG.tarot.revealHoldDuration);

  const wheelRotation = useSharedValue(0);
  const wheelOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const wheelScale = useSharedValue(1);
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(reducedMotion ? 0 : -wheelRadius);
  const drawnCardScale = useSharedValue(1);
  const drawnCardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flipProgress = useSharedValue(reducedMotion ? 1 : 0);
  const starCycle = useSharedValue(0);
  const candleFlicker = useSharedValue(0);
  const crystalPulse = useSharedValue(0);
  const magicCircleRotation = useSharedValue(0);
  const magicCircleOpacity = useSharedValue(0);
  const trailOpacity = useSharedValue(0);
  const fortuneOpacity = useSharedValue(0);
  const velvetOpacity = useSharedValue(0);

  const wheelRef = useRef<HTMLDivElement>(null);
  const drawnCardRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const velvetRef = useRef<HTMLDivElement>(null);
  const fortuneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    wheelRotation.animate(withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1));
    starCycle.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: 6000, easing: Easing.linear }), -1),
    );
    candleFlicker.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: 800, easing: Easing.linear }), -1),
    );
    crystalPulse.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    velvetOpacity.animate(withTiming(1, { duration: 800 }));
  }, [reducedMotion, wheelRotation, starCycle, candleFlicker, crystalPulse, velvetOpacity]);

  const enterRevealed = () => {
    setPhase('revealed');
    fortuneOpacity.animate(withDelay(400, withTiming(1, { duration: 800 })));
    magicCircleOpacity.animate(withDelay(500, withTiming(0, { duration: 600 })));
  };

  const startFlipping = () => {
    setPhase('flipping');
    magicCircleOpacity.animate(withTiming(0.5, { duration: 300 }));
    magicCircleRotation.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: 5000, easing: Easing.linear }), -1),
    );
    flipProgress.animate(
      withTiming(1, { duration: CONFIG.tarot.flipDuration, easing: Easing.inOut(Easing.cubic) }),
      enterRevealed,
    );
  };

  const startDrawing = () => {
    setPhase('drawing');
    drawnCardOpacity.set(1);
    trailOpacity.animate(
      withSequence(
        withTiming(0.7, { duration: 100 }),
        withDelay(400, withTiming(0, { duration: 300 })),
      ),
    );
    wheelScale.animate(withTiming(0.5, { duration: 400 }));
    wheelOpacity.animate(withTiming(0, { duration: 400 }));
    drawnCardX.animate(withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    drawnCardY.animate(withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }), () => {
      flipProgress.animate(withDelay(300, withTiming(0, { duration: 1 })), startFlipping);
    });
  };

  const handleCardSelect = (cardIndex: number) => {
    if (phase !== 'waiting') return;
    setSelectedCardIndex(cardIndex);
    wheelRotation.cancel();
    const cardAngle = (Math.PI * 2 * cardIndex) / WHEEL_CARD_COUNT;
    const totalAngle = wheelRotation.get() * Math.PI * 2 + cardAngle - Math.PI / 2;
    drawnCardX.set(Math.cos(totalAngle) * wheelRadius);
    drawnCardY.set(Math.sin(totalAngle) * wheelRadius);
    startDrawing();
  };

  const autoTimeoutWarning = useAutoTimeout(phase === 'waiting' && !reducedMotion, () =>
    handleCardSelect(Math.floor(Math.random() * WHEEL_CARD_COUNT)),
  );

  useFrameStyle(wheelRef, () => ({
    opacity: wheelOpacity.get(),
    transform: `scale(${wheelScale.get()}) rotate(${wheelRotation.get() * 360}deg)`,
  }));
  useFrameStyle(drawnCardRef, () => ({
    opacity: drawnCardOpacity.get(),
    transform:
      `translateX(${drawnCardX.get()}px) translateY(${drawnCardY.get()}px) ` +
      `scale(${drawnCardScale.get()}) perspective(1200px) ` +
      `rotateY(${interpolate(flipProgress.get(), [0, 1], [0, 180])}deg)`,
  }));
  useFrameStyle(backFaceRef, () => ({ opacity: flipProgress.get() < 0.5 ? 1 : 0 }));
  useFrameStyle(frontFaceRef, () => ({ opacity: flipProgress.get() >= 0.5 ? 1 : 0 }));
  useFrameStyle(velvetRef, () => ({ opacity: velvetOpacity.get() }));
  useFrameStyle(fortuneRef, () => ({ opacity: fortuneOpacity.get() }));

  const faceStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: CARD_RADIUS,
  };

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: TAROT_COLORS.background,
      }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {!reducedMotion && (
        <TarotBackdrop
          cardWidth={cardWidth}
          wheelRadius={wheelRadius}
          starCycle={starCycle}
          candleFlicker={candleFlicker}
          crystalPulse={crystalPulse}
          magicCircleRotation={magicCircleRotation}
          magicCircleOpacity={magicCircleOpacity}
          trailOpacity={trailOpacity}
        />
      )}

      {!reducedMotion && (
        <div
          ref={velvetRef}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: screenHeight * 0.35,
            background: 'linear-gradient(180deg, #1a0a2e00 0%, #1a0a2e 15%, #12071e 30%)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: TAROT_COLORS.velvetFringe,
              opacity: 0.5,
            }}
          />
        </div>
      )}

      {phase !== 'revealed' && (
        <div
          ref={wheelRef}
          data-testid={`${testIDPrefix}-wheel`}
          style={{
            position: 'absolute',
            left: screenWidth / 2 - wheelRadius * 1.25,
            top: screenHeight / 2 - wheelRadius * 1.25,
            width: wheelRadius * 2.5,
            height: wheelRadius * 2.5,
          }}
        >
          {Array.from({ length: WHEEL_CARD_COUNT }, (_, index) => {
            const angle = (Math.PI * 2 * index) / WHEEL_CARD_COUNT;
            const x = Math.cos(angle - Math.PI / 2) * wheelRadius;
            const y = Math.sin(angle - Math.PI / 2) * wheelRadius;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: `calc(50% - ${wheelCardWidth / 2}px)`,
                  top: `calc(50% - ${wheelCardHeight / 2}px)`,
                  width: wheelCardWidth,
                  height: wheelCardHeight,
                  borderRadius: WHEEL_CARD_RADIUS,
                  boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
                  opacity: selectedCardIndex === index ? 0 : 1,
                  transform: `translateX(${x}px) translateY(${y}px) rotate(${(angle * 180) / Math.PI}deg)`,
                }}
              >
                <button
                  type="button"
                  aria-label={`塔罗牌 ${index + 1}`}
                  disabled={phase !== 'waiting'}
                  onClick={() => handleCardSelect(index)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <TarotCardBack width={cardWidth} height={cardHeight} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        ref={drawnCardRef}
        data-testid={`${testIDPrefix}-drawn-card`}
        style={{
          position: 'absolute',
          left: screenWidth / 2 - cardWidth / 2,
          top: screenHeight / 2 - cardHeight / 2,
          width: cardWidth,
          height: cardHeight,
          borderRadius: CARD_RADIUS,
          boxShadow: '0px 10px 20px rgba(212,175,55,0.5)',
          opacity: reducedMotion ? 1 : 0,
          transform: reducedMotion
            ? 'perspective(1200px) rotateY(180deg)'
            : `translateY(${-wheelRadius}px)`,
          pointerEvents: phase === 'waiting' ? 'none' : 'auto',
        }}
      >
        <div ref={backFaceRef} style={{ ...faceStyle, zIndex: 2, opacity: reducedMotion ? 0 : 1 }}>
          <TarotCardBack width={cardWidth} height={cardHeight} />
        </div>
        <div
          ref={frontFaceRef}
          style={{
            ...faceStyle,
            zIndex: 1,
            opacity: reducedMotion ? 1 : 0,
            transform: 'scaleX(-1)',
          }}
        >
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

      {phase === 'revealed' && (
        <div
          ref={fortuneRef}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 60px)',
            left: 20,
            right: 20,
            zIndex: REVEAL_DOM_LAYER.aboveCanvas,
            textAlign: 'center',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: TAROT_COLORS.gold,
              textShadow: `0px 0px 12px ${TAROT_COLORS.goldGlow}`,
            }}
          >
            {FORTUNE_QUOTES[role.alignment]}
          </span>
        </div>
      )}

      <HintWithWarning
        hintText={
          phase === 'waiting' ? '🔮 凭直觉选一张牌' : phase === 'drawing' ? '✨ 翻牌中…' : null
        }
        showWarning={autoTimeoutWarning}
      />
    </div>
  );
}
