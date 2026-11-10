/**
 * ScratchReveal: a silver scratch-off ticket. Dragging over the coating wears holes into it
 * that show the role card beneath; past the threshold the coating drops and the card enters.
 *
 * The coating is Pixi so its holes can cut through the metal, pattern and sheen with an inverse
 * mask; the old client stacked a clipped copy of the card face per scratch point instead. The
 * old confetti burst stayed inside the card's footprint beneath the opaque card, so it never
 * showed; it is not ported.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER, REVEAL_PIXI_LAYER } from '../common/layers';
import { RevealBurst } from '../common/RevealBurst';
import { RevealCardFace } from '../common/RevealCardFace';
import { RevealFinale } from '../common/RevealedCard';
import { useAnchorRect, type ViewRect } from '../common/useAnchorRect';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { linearGradient } from '../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../pixiLayer';
import {
  interpolate,
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useRevealFrame,
  useSharedValue,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const SCRATCH_COLORS = {
  metalBase: '#C0C0C0',
  metalLight: '#E8E8E8',
  metalDark: '#909090',
  shavingColors: ['#D4D4D4', '#B8B8B8', '#A0A0A0', '#888888'],
} as const;

/** `--radius-medium`, the card's corner, which the Pixi coating clips to as the old view did. */
const CARD_CORNER_RADIUS = 14;
const SHEEN_WIDTH = 80;
const DIAMOND_ROWS = 5;
const DIAMOND_COLUMNS = 7;
const DIAMOND_GAP = 12;
const SERIAL_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSerial(): string {
  let serial = '';
  for (let index = 0; index < 12; index++) {
    if (index > 0 && index % 4 === 0) serial += '-';
    serial += SERIAL_CHARACTERS[Math.floor(Math.random() * SERIAL_CHARACTERS.length)];
  }
  return serial;
}

interface ScratchPoint {
  readonly x: number;
  readonly y: number;
}

interface ShavingConfig {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly color: string;
  readonly size: number;
  /** Final spin in degrees; the old client re-rolled it every frame, which only made it jitter. */
  readonly spin: number;
}

/** A metal flake flicked off the coating where the finger scratched. */
function MetalShaving({ startX, startY, targetX, targetY, color, size, spin }: ShavingConfig) {
  const shavingRef = useRef<HTMLDivElement>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.animate(withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
  }, [progress]);

  useFrameStyle(shavingRef, () => {
    const value = progress.get();
    return {
      opacity: interpolate(value, [0, 0.7, 1], [1, 0.6, 0]),
      transform: `translate(${interpolate(value, [0, 1], [startX, targetX])}px, ${interpolate(value, [0, 1], [startY, targetY])}px) scale(${interpolate(value, [0, 1], [1, 0.3])}) rotate(${value * spin}deg)`,
    };
  });

  return (
    <div
      ref={shavingRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: REVEAL_DOM_LAYER.aboveCanvas,
        boxSizing: 'border-box',
        width: size * 1.8,
        height: size * 0.35,
        borderRadius: size * 0.15,
        border: `0.5px solid ${SCRATCH_COLORS.metalLight}`,
        backgroundColor: color,
        transform: `translate(${startX}px, ${startY}px)`,
        pointerEvents: 'none',
      }}
    />
  );
}

interface ScratchCoatingProps {
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  readonly pointsRef: RefObject<ScratchPoint[]>;
  readonly brushRadius: number;
  readonly sheenPosition: SharedValue;
}

/** Measures the card, then lays the coating over it. */
function ScratchCoating({ anchorRef, ...props }: ScratchCoatingProps) {
  const rect = useAnchorRect(anchorRef);
  return rect ? <CoatingArt rect={rect} {...props} /> : null;
}

/** The metal coating, its diamond pattern and sweeping sheen, with every scratch cut out. */
function CoatingArt({
  rect,
  pointsRef,
  brushRadius,
  sheenPosition,
}: Omit<ScratchCoatingProps, 'anchorRef'> & { readonly rect: ViewRect }) {
  const { width, height } = rect;

  const build: ArtBuilder = (root, own) => {
    const corners = new Graphics()
      .roundRect(0, 0, width, height, CARD_CORNER_RADIUS)
      .fill(0xffffff);
    root.addChild(corners);
    root.mask = corners;

    const holes = new Graphics();
    root.addChild(holes);
    const coating = new Container();
    root.addChild(coating);
    coating.setMask({ mask: holes, inverse: true });

    coating.addChild(
      new Graphics()
        .rect(0, 0, width, height)
        .fill(
          own(
            linearGradient({ x: 0, y: 0 }, { x: width, y: height }, [
              SCRATCH_COLORS.metalLight,
              SCRATCH_COLORS.metalBase,
              SCRATCH_COLORS.metalDark,
            ]),
          ),
        ),
    );

    const diamonds = new Container();
    diamonds.alpha = 0.08;
    coating.addChild(diamonds);
    const glyphs = Array.from(
      { length: DIAMOND_ROWS * DIAMOND_COLUMNS },
      () => new Text({ text: '◇', style: { fontSize: 16, fill: 0x000000 } }),
    );
    const [firstGlyph] = glyphs;
    if (!firstGlyph) throw new Error('ScratchReveal needs its diamond pattern');
    const glyphWidth = firstGlyph.width;
    const glyphHeight = firstGlyph.height;
    const patternLeft =
      (width - (DIAMOND_COLUMNS * glyphWidth + (DIAMOND_COLUMNS - 1) * DIAMOND_GAP)) / 2;
    const patternTop = (height - DIAMOND_ROWS * glyphHeight) / 2;
    glyphs.forEach((glyph, index) => {
      const row = Math.floor(index / DIAMOND_COLUMNS);
      const column = index % DIAMOND_COLUMNS;
      glyph.position.set(
        patternLeft + column * (glyphWidth + DIAMOND_GAP),
        patternTop + row * glyphHeight,
      );
      diamonds.addChild(glyph);
    });

    const sheen = new Graphics()
      .rect(0, 0, SHEEN_WIDTH, height)
      .fill(
        own(
          linearGradient({ x: 0, y: 0 }, { x: SHEEN_WIDTH, y: 0 }, [
            'rgba(255, 255, 255, 0)',
            'rgba(255, 255, 255, 0.4)',
            'rgba(255, 255, 255, 0)',
          ]),
        ),
      );
    coating.addChild(sheen);

    let drawnHoles = 0;
    return () => {
      sheen.x = interpolate(sheenPosition.get(), [0, 1], [-width, width]);
      const points = pointsRef.current;
      for (; drawnHoles < points.length; drawnHoles++) {
        const point = points[drawnHoles];
        if (point) holes.circle(point.x, point.y, brushRadius).fill(0xffffff);
      }
    };
  };
  useFrameArt({ zIndex: REVEAL_PIXI_LAYER.effect, rect }, build);
  return null;
}

/** Scratch the silver coating off a lottery ticket to reveal the role. */
export default function ScratchReveal({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const config = CONFIG.scratch;
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [isRevealed, setIsRevealed] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [shavings, setShavings] = useState<ShavingConfig[]>([]);
  const [serialNumber] = useState(generateSerial);

  const cardRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const prizeStampRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<ScratchPoint[]>([]);
  const revealedRef = useRef(false);
  const scratchingRef = useRef(false);
  const shavingIdRef = useRef(0);

  const revealAnim = useSharedValue(0);
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);
  const sheenPosition = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const prizeStampOpacity = useSharedValue(0);
  const prizeStampScale = useSharedValue(0.5);

  const { fireComplete } = useRevealLifecycle(onComplete, config.revealHoldDuration);
  const totalArea = cardWidth * cardHeight;
  const brushRadius = config.brushRadius;

  useEffect(() => {
    if (reducedMotion) return;
    sheenPosition.animate(
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [sheenPosition, reducedMotion]);

  const triggerReveal = () => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setIsRevealed(true);

    burstOpacity.animate(
      withSequence(withTiming(0.8, { duration: 100 }), withTiming(0, { duration: 300 })),
    );
    burstScale.animate(withTiming(2, { duration: 400, easing: Easing.out(Easing.cubic) }));
    revealAnim.animate(withTiming(1, { duration: config.revealDuration }), () => setShowGlow(true));
    prizeStampOpacity.animate(withDelay(200, withTiming(1, { duration: 300 })));
    prizeStampScale.animate(
      withDelay(
        200,
        withSequence(
          withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 150 }),
        ),
      ),
    );
  };

  const autoTimeoutWarning = useAutoTimeout(!isRevealed && !reducedMotion, triggerReveal);

  const createShaving = (x: number, y: number) => {
    const id = shavingIdRef.current++;
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    const shaving: ShavingConfig = {
      id,
      startX: x,
      startY: y,
      targetX: x + Math.cos(angle) * distance,
      targetY: y + Math.sin(angle) * distance + 20,
      color: SCRATCH_COLORS.shavingColors[id % SCRATCH_COLORS.shavingColors.length] ?? '',
      size: 4 + Math.random() * 6,
      spin: Math.random() * 360 - 180,
    };
    setShavings((previous) => [...previous.slice(-30), shaving]);
  };

  const addScratchPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (revealedRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    pointsRef.current.push({ x, y });

    const brushArea = Math.PI * brushRadius * brushRadius;
    const progress = Math.min(1, (pointsRef.current.length * brushArea * 0.15) / totalArea);
    setScratchProgress(progress);
    progressWidth.animate(withTiming(progress, { duration: 100 }));
    if (Math.random() > 0.7) createShaving(x, y);
    if (progress >= config.autoRevealThreshold) triggerReveal();
  };

  useRevealFrame(() => {
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${progressWidth.get() * 100}%`;
    }
  });
  useFrameStyle(burstRef, () => ({
    opacity: burstOpacity.get(),
    transform: `translate(-50%, -50%) scale(${burstScale.get()})`,
  }));
  useFrameStyle(prizeStampRef, () => ({
    opacity: prizeStampOpacity.get(),
    transform: `scale(${prizeStampScale.get()}) rotate(-15deg)`,
  }));

  const captionStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    color: 'var(--color-text-secondary)',
  } as const;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background)',
        overflow: 'hidden',
      }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      <div
        ref={burstRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: cardWidth * 1.5,
          height: cardHeight * 1.5,
          borderRadius: cardWidth,
          backgroundColor: theme.glowColor,
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0)',
        }}
      />

      <div
        ref={cardRef}
        style={{
          position: 'relative',
          flexShrink: 0,
          width: cardWidth,
          height: cardHeight,
          borderRadius: 'var(--radius-medium)',
          overflow: 'hidden',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        {isRevealed ? (
          <RevealCardFace
            key="entrance"
            role={role}
            width={cardWidth}
            height={cardHeight}
            revealGradient={theme.revealGradient}
            animateEntrance
          />
        ) : (
          <RevealCardFace
            key="beneath-coating"
            role={role}
            width={cardWidth}
            height={cardHeight}
            revealGradient={theme.revealGradient}
          />
        )}

        {!isRevealed && (
          <div
            onPointerDown={(event) => {
              if (reducedMotion) return;
              scratchingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              addScratchPoint(event);
            }}
            onPointerMove={(event) => {
              if (scratchingRef.current) addScratchPoint(event);
            }}
            onPointerUp={() => {
              scratchingRef.current = false;
            }}
            onPointerCancel={() => {
              scratchingRef.current = false;
            }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: REVEAL_DOM_LAYER.aboveCanvas,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-title)',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.5)',
                textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
                pointerEvents: 'none',
              }}
            >
              🧤 滑动手指刮开银层
            </span>
            <span style={{ fontSize: 32, marginTop: 'var(--space-small)', pointerEvents: 'none' }}>
              👆
            </span>
          </div>
        )}

        {shavings.map((shaving) => (
          <MetalShaving key={shaving.id} {...shaving} />
        ))}

        {isRevealed && (
          <div
            ref={prizeStampRef}
            style={{
              position: 'absolute',
              top: 15,
              right: 10,
              opacity: 0,
              transform: 'scale(0.5) rotate(-15deg)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 3,
                border: '2px solid currentColor',
                borderRadius: 4,
                padding: '2px 8px',
                opacity: 0.7,
                color: theme.primaryColor,
              }}
            >
              PRIZE
            </span>
          </div>
        )}
      </div>

      {!isRevealed && (
        <ScratchCoating
          anchorRef={cardRef}
          pointsRef={pointsRef}
          brushRadius={brushRadius}
          sheenPosition={sheenPosition}
        />
      )}
      <RevealBurst trigger={showGlow} zIndex={REVEAL_PIXI_LAYER.burst} color={theme.glowColor} />
      {showGlow && (
        <RevealFinale
          anchorRef={cardRef}
          role={role}
          theme={theme}
          reducedMotion={reducedMotion}
          onComplete={fireComplete}
        />
      )}

      {!isRevealed && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 'var(--space-large)' }}>
          <div
            style={{
              width: 150,
              height: 8,
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: 'var(--color-border)',
            }}
          >
            <div
              ref={progressFillRef}
              style={{
                width: 0,
                height: '100%',
                borderRadius: 4,
                backgroundColor: theme.primaryColor,
              }}
            />
          </div>
          <span
            style={{
              width: 40,
              marginLeft: 'var(--space-small)',
              fontSize: 'var(--font-caption)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            {Math.round(scratchProgress * 100)}%
          </span>
        </div>
      )}

      <span
        style={{
          ...captionStyle,
          bottom: 28,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 2,
          opacity: 0.5,
          fontFamily: 'monospace',
        }}
      >
        NO. {serialNumber}
      </span>
      <span style={{ ...captionStyle, bottom: 12, fontSize: 10, opacity: 0.4 }}>
        刮开涂层，揭晓命运
      </span>

      {reducedMotion && !isRevealed && (
        <button
          type="button"
          data-testid={`${testIDPrefix}-tap-reveal`}
          onClick={triggerReveal}
          style={{
            marginTop: 'var(--space-large)',
            padding: 'var(--space-medium) var(--space-large)',
            border: 'none',
            borderRadius: 'var(--radius-medium)',
            backgroundColor: theme.primaryColor,
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--font-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          点击揭示角色
        </button>
      )}

      <HintWithWarning hintText={null} showWarning={autoTimeoutWarning} />
    </div>
  );
}
