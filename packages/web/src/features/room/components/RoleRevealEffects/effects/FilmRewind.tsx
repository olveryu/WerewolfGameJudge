/**
 * FilmRewind: a projector warms up over scrolling film stock; tapping starts a leader countdown
 * and at zero a flash of projector light gives way to the card.
 */
import { useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER, REVEAL_PIXI_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { graphicsLayer, radialGradient } from '../pixi/kit';
import { type ArtBuilder, useFrameArt, usePixiLayer } from '../pixiLayer';
import { useFrameStyle, useRevealCardSize, useSharedValue, useViewportSize } from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #0a0906 0%, #0d0b08 50%, #0a0906 100%)';

const FR = CONFIG.filmRewind;

const COLORS = {
  filmBorder: '#111111',
  sprocketOuter: '#1a1a1a',
  sprocketInner: '#080808',
  projectorWarm: 'rgba(200, 180, 140, 0.25)',
  scratchLine: 'rgba(200, 180, 140, 0.04)',
  horizontalScratch: 'rgba(200, 180, 140, 0.06)',
  grainLight: 'rgba(255, 255, 255, 0.03)',
  grainDark: 'rgba(0, 0, 0, 0.03)',
  flicker: 'rgba(200, 180, 140, 1)',
} as const;

const BORDER_W = FR.filmBorderWidth;
const SPROCKET_SPACING = FR.sprocketSpacing;
const SPROCKET_HOLE_W = 10;
const SPROCKET_HOLE_H = 14;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

function createScratches(screenW: number) {
  return Array.from({ length: FR.scratchCount }, (_, i) => ({
    x: screenW * (0.25 + ((i * 37 + 13) % 50) / 100),
    drift: (((i * 71 + 29) % 100) / 100) * 5,
  }));
}

function createGrainParticles(screenW: number, screenH: number) {
  const fieldW = screenW * 2;
  const fieldH = screenH * 2;
  return Array.from({ length: FR.grainCount * 2 }, (_, i) => ({
    x: (((i * 73 + 17) % 2000) / 2000) * fieldW,
    y: (((i * 41 + 31) % 2000) / 2000) * fieldH,
    light: i % 2 === 0,
  }));
}

function createHorizontalScratches(screenH: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    y: screenH * (0.1 + ((i * 43 + 7) % 90) / 100),
    phase: ((i * 67 + 13) % 100) / 100,
  }));
}

type Phase = 'atmosphere' | 'idle' | 'countdown' | 'revealed';

const COUNTDOWN_LINE = 'rgba(200, 180, 140, 0.15)';

/** Tap to roll the film leader; the countdown lands on the card. */
export default function FilmRewind({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const { width: screenW, height: screenH } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'atmosphere');
  const [countdownNum, setCountdownNum] = useState<number>(FR.countdownFrom);
  const { fireComplete } = useRevealLifecycle(onComplete, FR.revealHoldDuration);
  const countdownStartedRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sprocketScroll = useSharedValue(0);
  const flickerOpacity = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const grainCycle = useSharedValue(0);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  const doReveal = () => {
    flashOpacity.animate(
      withSequence(withTiming(0.7, { duration: 100 }), withTiming(0, { duration: 500 })),
    );
    canvasOpacity.animate(withDelay(200, withTiming(0, { duration: 400 })));
    cardScale.animate(
      withDelay(
        FR.cardRevealDelay,
        withTiming(1, { duration: FR.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) }),
      ),
      () => setPhase('revealed'),
    );
    cardOpacity.animate(
      withDelay(FR.cardRevealDelay, withTiming(1, { duration: FR.cardRevealDuration })),
    );
  };

  const startCountdown = () => {
    if (countdownStartedRef.current) return;
    countdownStartedRef.current = true;
    setPhase('countdown');
    setCountdownNum(FR.countdownFrom);
    let remaining = FR.countdownFrom;
    countdownIntervalRef.current = setInterval(() => {
      remaining--;
      setCountdownNum(remaining);
      if (remaining > 0) return;
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      doReveal();
    }, FR.countdownInterval);
  };

  useEffect(() => {
    if (reducedMotion) return;
    sprocketScroll.animate(
      withRepeat(withTiming(SPROCKET_SPACING, { duration: 600, easing: Easing.linear }), -1),
    );
    flickerOpacity.animate(
      withRepeat(
        withSequence(
          withTiming(0.08, { duration: 100 }),
          withTiming(0, { duration: 200 }),
          withTiming(0.04, { duration: 50 }),
          withTiming(0, { duration: 500 }),
        ),
        -1,
      ),
    );
    grainCycle.animate(withRepeat(withTiming(1, { duration: 500, easing: Easing.linear }), -1));
    const timer = setTimeout(() => setPhase('idle'), FR.atmosphereDuration);
    return () => {
      clearTimeout(timer);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [reducedMotion, sprocketScroll, flickerOpacity, grainCycle]);

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', startCountdown);

  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const layer = usePixiLayer(REVEAL_PIXI_LAYER.effect);
  const build: ArtBuilder = (root, own) => {
    const sprocketCount = Math.ceil(screenH / SPROCKET_SPACING) + 2;
    const scratches = createScratches(screenW);
    const horizontalScratches = createHorizontalScratches(screenH);
    const art = graphicsLayer(root);
    art
      .rect(0, 0, screenW, screenH)
      .fill(
        own(
          radialGradient(
            screenW / 2,
            screenH / 2,
            screenH * 0.7,
            ['rgba(60, 50, 30, 0.25)', 'rgba(30, 25, 15, 0.10)', TRANSPARENT],
            [0, 0.5, 1],
          ),
        ),
      )
      .rect(0, 0, BORDER_W, screenH)
      .fill(COLORS.filmBorder)
      .rect(screenW - BORDER_W, 0, BORDER_W, screenH)
      .fill(COLORS.filmBorder);
    const sprockets = graphicsLayer(art);
    const scratchLines = graphicsLayer(art);
    for (const scratch of scratches) {
      scratchLines
        .moveTo(scratch.x, 0)
        .lineTo(scratch.x + scratch.drift, screenH)
        .stroke({ color: COLORS.scratchLine, width: 1 });
    }
    const grain = graphicsLayer(art);
    for (const particle of createGrainParticles(screenW, screenH)) {
      grain
        .rect(particle.x, particle.y, 1, 1)
        .fill(particle.light ? COLORS.grainLight : COLORS.grainDark);
    }
    const horizontal = graphicsLayer(art);
    const vignette = graphicsLayer(art);
    vignette
      .rect(0, 0, screenW, screenH)
      .fill(
        own(
          radialGradient(
            screenW / 2,
            screenH / 2,
            screenH * 0.7,
            [TRANSPARENT, 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
            [0, 0.7, 1],
          ),
        ),
      );
    const flicker = graphicsLayer(art);
    flicker.rect(0, 0, screenW, screenH).fill(COLORS.flicker);
    const flash = graphicsLayer(root);
    flash.rect(0, 0, screenW, screenH).fill(COLORS.projectorWarm);
    return () => {
      art.alpha = canvasOpacity.get();

      const scroll = sprocketScroll.get();
      const leftCx = BORDER_W / 2;
      const rightCx = screenW - BORDER_W / 2;
      sprockets.clear();
      for (let index = 0; index < sprocketCount; index++) {
        const y = (index * SPROCKET_SPACING + scroll) % (sprocketCount * SPROCKET_SPACING);
        for (const cx of [leftCx, rightCx]) {
          sprockets
            .roundRect(
              cx - SPROCKET_HOLE_W / 2,
              y - SPROCKET_HOLE_H / 2,
              SPROCKET_HOLE_W,
              SPROCKET_HOLE_H,
              2,
            )
            .fill(COLORS.sprocketOuter)
            .roundRect(cx - 3, y - 5, 6, 10, 1)
            .fill(COLORS.sprocketInner);
        }
      }

      const cycle = grainCycle.get();
      grain.position.set(-cycle * screenW * 0.73, -cycle * screenH * 0.61);

      horizontal.clear();
      for (const scratch of horizontalScratches) {
        if ((cycle + scratch.phase) % 1 >= 0.15) continue;
        horizontal
          .moveTo(0, scratch.y)
          .lineTo(screenW, scratch.y)
          .stroke({ color: COLORS.horizontalScratch, width: 1, alpha: 0.08 });
      }

      flicker.alpha = flickerOpacity.get();
      flash.alpha = flashOpacity.get();
    };
  };
  useFrameArt(layer, build);

  const handlePress = () => {
    if (phase === 'idle') startCountdown();
  };

  const countdownProgress =
    phase === 'countdown' ? (FR.countdownFrom - countdownNum) / FR.countdownFrom : 0;
  const showCard = phase === 'revealed' || (phase === 'countdown' && countdownNum <= 0);

  const hintText =
    phase === 'atmosphere'
      ? '🎬 放映机预热中…'
      : phase === 'idle'
        ? '🎬 点击屏幕开始放映'
        : phase === 'countdown' && countdownNum > 0
          ? '🎬 胶片倒放中…'
          : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ position: 'absolute', inset: 0, background: BG_GRADIENT }}
    >
      <div
        data-testid={`${testIDPrefix}-press-area`}
        onClick={handlePress}
        style={{ position: 'absolute', inset: 0 }}
      />
      {phase === 'countdown' && countdownNum > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 160,
            height: 160,
            marginTop: -80,
            marginLeft: -80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: REVEAL_DOM_LAYER.aboveCanvas,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 160,
              height: 160,
              boxSizing: 'border-box',
              borderRadius: 80,
              border: '2px solid rgba(200, 180, 140, 0.3)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 150,
              height: 150,
              borderRadius: 75,
              background: 'rgba(200, 180, 140, 0.1)',
              opacity: countdownProgress,
            }}
          />
          <div style={{ position: 'absolute', width: 80, height: 1, background: COUNTDOWN_LINE }} />
          <div style={{ position: 'absolute', width: 1, height: 80, background: COUNTDOWN_LINE }} />
          <span
            style={{
              position: 'relative',
              fontSize: 72,
              fontWeight: 700,
              fontFamily: '"Courier New", monospace',
              color: 'rgba(220, 200, 160, 0.9)',
              textShadow: '0px 2px 8px rgba(0, 0, 0, 0.6)',
            }}
          >
            {countdownNum}
          </span>
        </div>
      )}
      <HintWithWarning hintText={hintText} showWarning={autoTimeoutWarning} />
      {showCard && (
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
            transform: `scale(${reducedMotion ? 1 : 0})`,
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
      )}
    </div>
  );
}
