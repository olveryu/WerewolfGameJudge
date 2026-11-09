/**
 * MeteorStrike: meteors streak across a starfield; tapping one crashes it into the center, where
 * it explodes with a flash, shockwaves and embers before the card rises out of the impact.
 */
import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_PIXI_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { graphicsLayer } from '../pixi/kit';
import { type ArtBuilder, useFrameArt, usePixiLayer } from '../pixiLayer';
import {
  type RevealScene,
  SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useRevealFrame,
  useRevealScene,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #020010 0%, #0a0025 50%, #050015 100%)';

const MS = CONFIG.meteorStrike;

const COLORS = {
  meteorCore: '#FFFFFF',
  meteorGlow: 'rgba(255, 240, 200, 0.9)',
  meteorTrail: 'rgba(255, 180, 80, 0.6)',
  meteorTrailFade: 'rgba(255, 100, 30, 0.15)',
  impactOrange: 'rgba(255, 200, 100, 0.9)',
  shockwaveColor: 'rgba(255, 200, 100, 0.7)',
  starColor: 'rgba(200, 210, 255, 0.7)',
} as const;

const STAR_CYCLE_MS = 6000;

function createTrail(scene: RevealScene): readonly TrailPoint[] {
  return Array.from({ length: MS.trailLength }, () => ({
    x: -100,
    y: -100,
    opacity: new SharedValue(scene, 0),
  }));
}

function createStars(screenWidth: number, screenHeight: number) {
  return Array.from({ length: MS.starCount }, (_, i) => {
    const r1 = ((i * 73 + 17) % 1000) / 1000;
    const r2 = ((i * 41 + 31) % 1000) / 1000;
    const r3 = ((i * 59 + 7) % 1000) / 1000;
    const r4 = ((i * 83 + 11) % 1000) / 1000;
    const r5 = ((i * 97 + 53) % 1000) / 1000;
    return {
      x: r1 * screenWidth,
      y: r2 * screenHeight,
      radius: 0.3 + r3 * 1.5,
      brightness: 0.3 + r4 * 0.7,
      speed: 1 + r5 * 3,
      phase: ((i * 67 + 23) % 628) / 100,
    };
  });
}

const IMPACT_PARTICLES = Array.from({ length: MS.impactParticleCount }, (_, i) => {
  const r1 = ((i * 43 + 19) % 100) / 100;
  return {
    angle: (i / MS.impactParticleCount) * Math.PI * 2 + ((i * 7 + 3) % 10) * 0.06,
    speed: 2 + ((i * 31) % 100) / 10,
    radius: 2 + r1 * 5,
    hue: 20 + ((i * 17) % 30),
  };
});

const SHOCKWAVE_DELAYS = [0, 0.12] as const;

type Phase = 'atmosphere' | 'idle' | 'impact' | 'revealed';

interface MeteorState {
  x: number;
  y: number;
  active: boolean;
  caught: boolean;
  angle: number;
}

interface TrailPoint {
  x: number;
  y: number;
  readonly opacity: SharedValue;
}

/** Tap a falling meteor to crash it and reveal the card. */
export default function MeteorStrike({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const scene = useRevealScene();
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const impactX = screenWidth / 2;
  const impactY = screenHeight * 0.5;

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'atmosphere');
  const { fireComplete } = useRevealLifecycle(onComplete, MS.revealHoldDuration);

  const meteorRef = useRef<MeteorState>({
    x: -80,
    y: screenHeight * 0.18,
    active: false,
    caught: false,
    angle: 0.35,
  });
  const meteorX = useSharedValue(-80);
  const meteorY = useSharedValue(screenHeight * 0.18);
  const meteorOpacity = useSharedValue(0);
  const lastFrameRef = useRef(0);
  const trailRef = useRef(createTrail(scene));
  const trailIndexRef = useRef(0);
  const trailFrameCountRef = useRef(0);

  const impactProgress = useSharedValue(0);
  const shockwaveProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const starCycle = useSharedValue(0);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = trailRef.current;
    return () => trail.forEach((point) => point.opacity.cancel());
  }, []);

  const spawnMeteor = () => {
    const meteor = meteorRef.current;
    meteor.x = -60;
    meteor.y = screenHeight * (0.12 + Math.random() * 0.13);
    meteor.active = true;
    meteor.caught = false;
    meteor.angle = 0.25 + Math.random() * 0.2;
    meteorX.set(meteor.x);
    meteorY.set(meteor.y);
    meteorOpacity.animate(withTiming(1, { duration: 200 }));
  };

  const triggerImpact = () => {
    const meteor = meteorRef.current;
    if (meteor.caught) return;
    meteor.caught = true;
    meteor.active = false;
    setPhase('impact');

    const fall = { duration: MS.impactAnimDuration, easing: Easing.in(Easing.quad) };
    meteorY.animate(withTiming(impactY, fall));
    meteorX.animate(withTiming(impactX, fall), () => {
      meteorOpacity.set(0);
      flashOpacity.animate(
        withSequence(withTiming(0.8, { duration: 80 }), withTiming(0, { duration: 400 })),
      );
      shockwaveProgress.animate(
        withTiming(1, { duration: MS.shockwaveDuration, easing: Easing.out(Easing.cubic) }),
      );
      impactProgress.animate(
        withTiming(1, { duration: MS.explosionDuration, easing: Easing.out(Easing.cubic) }),
      );
      canvasOpacity.animate(withDelay(200, withTiming(0, { duration: 300 })));
      cardScale.animate(
        withDelay(
          MS.cardRevealDelay,
          withTiming(1, {
            duration: MS.cardRevealDuration,
            easing: Easing.out(Easing.back(1.15)),
          }),
        ),
        () => setPhase('revealed'),
      );
      cardOpacity.animate(
        withDelay(MS.cardRevealDelay, withTiming(1, { duration: MS.cardRevealDuration })),
      );
    });
  };

  const spawnMeteorRef = useRef(spawnMeteor);
  useEffect(() => {
    spawnMeteorRef.current = spawnMeteor;
  });

  useEffect(() => {
    if (reducedMotion) return;
    starCycle.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: STAR_CYCLE_MS, easing: Easing.linear }), -1),
    );
    const atmosphereTimer = setTimeout(() => {
      setPhase('idle');
      lastFrameRef.current = 0;
      spawnMeteorRef.current();
    }, MS.atmosphereDuration);
    return () => clearTimeout(atmosphereTimer);
  }, [reducedMotion, starCycle]);

  useRevealFrame((nowMs) => {
    const meteor = meteorRef.current;
    if (!meteor.active || meteor.caught) return;
    const dt = lastFrameRef.current ? Math.min(nowMs - lastFrameRef.current, 32) : 16;
    lastFrameRef.current = nowMs;
    const speed = MS.meteorSpeed * (dt / 16);
    meteor.x += speed;
    meteor.y += speed * Math.tan(meteor.angle);
    meteorX.set(meteor.x);
    meteorY.set(meteor.y);

    trailFrameCountRef.current++;
    if (trailFrameCountRef.current % MS.trailUpdateInterval === 0) {
      const point = trailRef.current[trailIndexRef.current % MS.trailLength];
      if (!point) throw new Error('Meteor trail index out of range');
      point.x = meteor.x;
      point.y = meteor.y;
      point.opacity.set(1);
      point.opacity.animate(withTiming(0, { duration: MS.trailFadeDuration }));
      trailIndexRef.current++;
    }
    if (meteor.x > screenWidth + 100) spawnMeteor();
  });

  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', () => {
    if (meteorRef.current.caught) return;
    meteorRef.current.x = screenWidth * 0.6;
    meteorRef.current.y = screenHeight * 0.3;
    meteorX.set(screenWidth * 0.6);
    meteorY.set(screenHeight * 0.3);
    triggerImpact();
  });

  const handlePress = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle') return;
    const meteor = meteorRef.current;
    if (!meteor.active || meteor.caught) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - bounds.left - meteor.x;
    const dy = event.clientY - bounds.top - meteor.y;
    if (Math.hypot(dx, dy) < MS.catchRadius) triggerImpact();
  };

  const layer = usePixiLayer(REVEAL_PIXI_LAYER.effect);
  const build: ArtBuilder = (root) => {
    const stars = createStars(screenWidth, screenHeight);
    const art = graphicsLayer(root);
    const starDots = graphicsLayer(art);
    const trailCores = graphicsLayer(art, { blur: 3 });
    const trailHalos = graphicsLayer(art, { blur: 6 });
    const meteorHalo = graphicsLayer(art, { blur: 12 });
    const meteorCore = graphicsLayer(art);
    const meteorInner = graphicsLayer(art, { blur: 4 });
    const shockwaves = graphicsLayer(art);
    const particleCores = graphicsLayer(art);
    const particleGlows = graphicsLayer(art, { blur: 3 });
    const flash = graphicsLayer(root);
    return () => {
      art.alpha = canvasOpacity.get();

      const cycle = starCycle.get();
      starDots.clear();
      for (const star of stars) {
        const twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(cycle * star.speed + star.phase));
        starDots
          .circle(star.x, star.y, star.radius)
          .fill({ color: COLORS.starColor, alpha: star.brightness * twinkle });
      }

      trailCores.clear();
      trailHalos.clear();
      for (const point of trailRef.current) {
        const alpha = point.opacity.get();
        if (alpha <= 0) continue;
        trailCores.circle(point.x, point.y, 4).fill({ color: COLORS.meteorTrail, alpha });
        trailHalos.circle(point.x, point.y, 10).fill({ color: COLORS.meteorTrailFade, alpha });
      }

      const headAlpha = meteorOpacity.get();
      const headX = meteorX.get();
      const headY = meteorY.get();
      meteorHalo.clear();
      meteorCore.clear();
      meteorInner.clear();
      if (headAlpha > 0) {
        // The old glow gradient ran from (0,0) to (50,50) in canvas space, so past that corner it
        // is its clamped end color.
        meteorHalo
          .circle(headX, headY, 35)
          .fill({ color: COLORS.meteorTrailFade, alpha: headAlpha * 0.6 });
        meteorCore.circle(headX, headY, 5).fill({ color: COLORS.meteorCore, alpha: headAlpha });
        meteorInner.circle(headX, headY, 12).fill({ color: COLORS.meteorGlow, alpha: headAlpha });
      }

      const shock = shockwaveProgress.get();
      shockwaves.clear();
      for (const delay of SHOCKWAVE_DELAYS) {
        const progress = Math.max(0, shock - delay);
        const alpha = Math.max(0, 0.7 - progress * 0.8);
        if (progress <= 0 || alpha <= 0) continue;
        shockwaves
          .circle(impactX, impactY, progress * 200)
          .stroke({ color: COLORS.shockwaveColor, width: 3, alpha });
      }

      particleCores.clear();
      particleGlows.clear();
      const explosion = impactProgress.get();
      if (explosion > 0) {
        const alpha = explosion < 0.1 ? explosion / 0.1 : Math.max(0, 1 - (explosion - 0.1) / 0.9);
        const radiusScale = Math.max(0, 1 - explosion * 0.6);
        for (const particle of IMPACT_PARTICLES) {
          const endX = impactX + Math.cos(particle.angle) * particle.speed * 25;
          const endY = impactY + Math.sin(particle.angle) * particle.speed * 25 - 20;
          const x = impactX + (endX - impactX) * explosion;
          const y = impactY + (endY - impactY) * explosion + explosion * explosion * 40;
          const radius = particle.radius * radiusScale;
          particleCores
            .circle(x, y, radius)
            .fill({ color: `hsl(${particle.hue}, 90%, 65%)`, alpha });
          particleGlows
            .circle(x, y, radius * 2)
            .fill({ color: `hsla(${particle.hue}, 90%, 65%, 0.3)`, alpha });
        }
      }

      flash.clear();
      const flashAlpha = flashOpacity.get();
      if (flashAlpha > 0) {
        flash
          .rect(0, 0, screenWidth, screenHeight)
          .fill({ color: COLORS.impactOrange, alpha: flashAlpha });
      }
    };
  };
  useFrameArt(layer, build);

  const hintText =
    phase === 'atmosphere'
      ? '🌠 星空凝望中…'
      : phase === 'idle'
        ? '🌠 点击划过的流星！'
        : phase === 'impact'
          ? '💥 陨石坠落！'
          : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ position: 'absolute', inset: 0, background: BG_GRADIENT }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />
      <div
        data-testid={`${testIDPrefix}-press-area`}
        onPointerDown={handlePress}
        style={{ position: 'absolute', inset: 0 }}
      />
      <HintWithWarning hintText={hintText} showWarning={autoTimeoutWarning} />
      {(phase === 'impact' || phase === 'revealed') && (
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
