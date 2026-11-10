/**
 * VortexCollapse: a vortex turns in deep space; circling a finger around it spins it up until it
 * collapses in a burst of light and the card emerges from the center.
 */
import { type PointerEvent, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withSequence, withTiming } from '@/scene/timeline';

import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_PIXI_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { graphicsLayer, radialGradient } from '../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../pixiLayer';
import { useFrameStyle, useRevealCardSize, useSharedValue, useViewportSize } from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #030008 0%, #050012 50%, #030008 100%)';

const VC = CONFIG.vortexCollapse;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
/** The old loop ran once per 60 Hz animation frame; per-frame rates scale by elapsed frames. */
const FRAME_MS = 1000 / 60;

function hslString(h: number, s: number, l: number, a: number) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

function createBgStars(screenW: number, screenH: number) {
  return Array.from({ length: 60 }, (_, i) => ({
    x: (Math.sin(i * 7.7) * 0.5 + 0.5) * screenW,
    y: (Math.cos(i * 4.3) * 0.5 + 0.5) * screenH,
    phase: i,
  }));
}

function createNebulae(screenW: number, screenH: number) {
  return [
    { x: screenW * 0.3, y: screenH * 0.3, r: 200, hue: 260 },
    { x: screenW * 0.7, y: screenH * 0.6, r: 180, hue: 300 },
    { x: screenW * 0.5, y: screenH * 0.2, r: 150, hue: 230 },
  ];
}

const ORBITAL_PARTICLES = Array.from({ length: VC.particleCount }, (_, i) => {
  const r1 = ((i * 73 + 17) % 1000) / 1000;
  const r2 = ((i * 41 + 31) % 1000) / 1000;
  const r3 = ((i * 59 + 7) % 1000) / 1000;
  const r4 = ((i * 83 + 11) % 1000) / 1000;
  const r5 = ((i * 97 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 40 + r2 * 140,
    speed: 0.5 + r3 * 1.5,
    radius: 1 + r4 * 2.5,
    hue: 200 + r5 * 100,
    alpha: 0.3 + r4 * 0.5,
  };
});

const DEBRIS_CHUNKS = Array.from({ length: VC.debrisCount }, (_, i) => {
  const r1 = ((i * 43 + 19) % 1000) / 1000;
  const r2 = ((i * 67 + 37) % 1000) / 1000;
  const r3 = ((i * 89 + 13) % 1000) / 1000;
  const r4 = ((i * 31 + 53) % 1000) / 1000;
  return {
    angle: r1 * Math.PI * 2,
    dist: 100 + r2 * 150,
    speed: 0.3 + r3 * 0.9,
    size: 3 + r4 * 5,
    hue: 20 + ((i * 17) % 30),
    alpha: 0.2 + r4 * 0.3,
  };
});

const BURST_PARTICLES = Array.from({ length: VC.burstParticleCount }, (_, i) => {
  const angle = (((i * 73 + 17) % 1000) / 1000) * Math.PI * 2;
  const speed = 4 + ((i * 31) % 100) / 10;
  const r1 = ((i * 43 + 19) % 100) / 100;
  return { angle, speed, radius: 2 + r1 * 4, hue: 200 + ((i * 17) % 120) };
});

type Phase = 'atmosphere' | 'idle' | 'collapse' | 'revealed';

/** The vortex's simulation state, advanced every frame while idle. */
interface VortexState {
  running: boolean;
  collapsed: boolean;
  spin: number;
  spinVelocity: number;
  lastFrameMs: number | null;
  lastAngle: number | null;
  particles: { angle: number; dist: number; x: number; y: number }[];
  debris: { angle: number; x: number; y: number }[];
}

function createVortexState(): VortexState {
  return {
    running: false,
    collapsed: false,
    spin: 0,
    spinVelocity: 0,
    lastFrameMs: null,
    lastAngle: null,
    particles: ORBITAL_PARTICLES.map((particle) => ({
      angle: particle.angle,
      dist: particle.dist,
      x: 0,
      y: 0,
    })),
    debris: DEBRIS_CHUNKS.map((chunk) => ({ angle: chunk.angle, x: 0, y: 0 })),
  };
}

/** Circle a finger around the vortex until it collapses into the card. */
export default function VortexCollapse({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const { width: screenW, height: screenH } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const cx = screenW / 2;
  const cy = screenH * 0.45;

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'atmosphere');
  const { fireComplete } = useRevealLifecycle(onComplete, VC.revealHoldDuration);
  const vortexRef = useRef<VortexState>(createVortexState());

  const time = useSharedValue(0);
  const burstProgress = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  const doCollapse = () => {
    const vortex = vortexRef.current;
    if (vortex.collapsed) return;
    vortex.collapsed = true;
    setPhase('collapse');
    flashOpacity.animate(
      withSequence(withTiming(0.8, { duration: 100 }), withTiming(0, { duration: 500 })),
    );
    burstProgress.animate(
      withTiming(1, { duration: VC.burstDuration, easing: Easing.out(Easing.cubic) }),
    );
    canvasOpacity.animate(withDelay(200, withTiming(0, { duration: 400 })));
    cardScale.animate(
      withDelay(
        VC.cardRevealDelay,
        withTiming(1, { duration: VC.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) }),
      ),
      () => setPhase('revealed'),
    );
    cardOpacity.animate(
      withDelay(VC.cardRevealDelay, withTiming(1, { duration: VC.cardRevealDuration })),
    );
  };

  useEffect(() => {
    if (reducedMotion) return;
    time.animate(withTiming(1000, { duration: 1000 * 1000, easing: Easing.linear }));
    const timer = setTimeout(() => {
      setPhase('idle');
      vortexRef.current.running = true;
    }, VC.atmosphereDuration);
    return () => clearTimeout(timer);
  }, [reducedMotion, time]);

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', () => {
    vortexRef.current.spin = VC.collapseThreshold;
    doCollapse();
  });

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle' || event.buttons === 0) return;
    const vortex = vortexRef.current;
    const angle = Math.atan2(event.clientY - cy, event.clientX - cx);
    if (vortex.lastAngle !== null) {
      let delta = angle - vortex.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      vortex.spinVelocity += Math.abs(delta) * 0.015;
      vortex.spin += Math.abs(delta) / (Math.PI * 2);
      if (vortex.spin >= VC.collapseThreshold) doCollapse();
    }
    vortex.lastAngle = angle;
  };

  const handlePointerEnd = () => {
    vortexRef.current.lastAngle = null;
  };

  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const build: ArtBuilder = (root, own) => {
    const vortex = vortexRef.current;
    const art = graphicsLayer(root);
    const nebulae = createNebulae(screenW, screenH).map((nebula) => {
      const cloud = graphicsLayer(art);
      cloud
        .circle(nebula.x, nebula.y, nebula.r)
        .fill(
          own(
            radialGradient(
              nebula.x,
              nebula.y,
              nebula.r,
              [
                hslString(nebula.hue, 60, 20, 0.08),
                hslString(nebula.hue, 40, 15, 0.03),
                TRANSPARENT,
              ],
              [0, 0.5, 1],
            ),
          ),
        );
      return { cloud, hue: nebula.hue };
    });
    const bgStars = createBgStars(screenW, screenH);
    const stars = graphicsLayer(art);
    const vortexGlowFill = own(
      radialGradient(
        cx,
        cy,
        100,
        [hslString(270, 80, 60, 0.4), hslString(260, 70, 40, 0.15), TRANSPARENT],
        [0, 0.3, 1],
      ),
    );
    const vortexArt = graphicsLayer(art);
    const burstCore = graphicsLayer(art);
    const burstGlow = graphicsLayer(art, { blur: 3 });
    const flash = graphicsLayer(root);
    flash.rect(0, 0, screenW, screenH).fill('rgba(150,100,255,0.8)');

    return (nowMs) => {
      const t = time.get();
      art.alpha = canvasOpacity.get();
      flash.alpha = flashOpacity.get();

      if (vortex.running && !vortex.collapsed) {
        const frames = vortex.lastFrameMs === null ? 1 : (nowMs - vortex.lastFrameMs) / FRAME_MS;
        vortex.spinVelocity *= 0.985 ** frames;
        const totalSpinNow = t * 0.5 + vortex.spinVelocity * 40;
        const pullIntensity = Math.min(1, vortex.spin / VC.collapseThreshold);
        vortex.particles.forEach((particle, index) => {
          const spec = ORBITAL_PARTICLES[index];
          if (!spec) throw new Error(`Missing orbital particle ${index}`);
          particle.angle += (spec.speed + vortex.spinVelocity) * 0.02 * frames;
          const pullDistance = Math.max(10, particle.dist * (1 - pullIntensity * 0.6));
          particle.dist += (pullDistance - particle.dist) * (1 - 0.95 ** frames);
          particle.x = cx + Math.cos(particle.angle + totalSpinNow * 0.3) * particle.dist;
          particle.y = cy + Math.sin(particle.angle + totalSpinNow * 0.3) * particle.dist;
        });
        vortex.debris.forEach((chunk, index) => {
          const spec = DEBRIS_CHUNKS[index];
          if (!spec) throw new Error(`Missing debris chunk ${index}`);
          chunk.angle += (spec.speed + vortex.spinVelocity * 0.5) * 0.015 * frames;
          chunk.x = cx + Math.cos(chunk.angle + totalSpinNow * 0.2) * spec.dist;
          chunk.y = cy + Math.sin(chunk.angle + totalSpinNow * 0.2) * spec.dist;
        });
        vortex.lastFrameMs = nowMs;
      }
      const looped = vortex.lastFrameMs !== null;
      const intensity = Math.min(1, vortex.spin / VC.collapseThreshold);
      const totalSpin = t * 0.5 + vortex.spinVelocity * 40;

      for (const { cloud, hue } of nebulae) {
        cloud.alpha = 0.08 + Math.sin(t * 0.3 + hue) * 0.03;
      }
      stars.clear();
      for (const star of bgStars) {
        stars.rect(star.x, star.y, 1, 1).fill({
          color: 'rgba(180,180,220,0.3)',
          alpha: 0.15 + Math.sin(t * 2 + star.phase) * 0.1,
        });
      }

      vortexArt.clear();
      vortexArt
        .circle(cx, cy, 60 + intensity * 80)
        .fill({ fill: vortexGlowFill, alpha: 0.4 + intensity * 0.4 })
        .circle(cx, cy, 12 + intensity * 25)
        .fill('#000000')
        .circle(cx, cy, 14 + intensity * 25)
        .stroke({
          color: hslString(270, 90, 70, 0.5),
          width: 2,
          alpha: 0.3 + intensity * 0.5,
        });
      if (looped) {
        for (let arm = 0; arm < 3; arm++) {
          for (let step = 0; step < 80; step++) {
            const angle = totalSpin + arm * ((Math.PI * 2) / 3) + step * 0.08;
            const dist = 15 + step * (1.5 + intensity);
            const x = cx + Math.cos(angle) * dist;
            const y = cy + Math.sin(angle) * dist;
            if (step === 0) vortexArt.moveTo(x, y);
            else vortexArt.lineTo(x, y);
          }
        }
        vortexArt.stroke({
          color: hslString(260, 60, 60, 1),
          width: 2 + intensity * 3,
          alpha: 0.06 + intensity * 0.29,
        });
        vortex.particles.forEach((particle, index) => {
          const spec = ORBITAL_PARTICLES[index];
          if (!spec) throw new Error(`Missing orbital particle ${index}`);
          vortexArt.circle(particle.x, particle.y, spec.radius).fill({
            color: hslString(spec.hue, 70, 60, 1),
            alpha: spec.alpha * (0.3 + intensity * 0.9),
          });
        });
        vortex.debris.forEach((chunk, index) => {
          const spec = DEBRIS_CHUNKS[index];
          if (!spec) throw new Error(`Missing debris chunk ${index}`);
          vortexArt
            .rect(chunk.x - spec.size / 2, chunk.y - spec.size / 2, spec.size, spec.size)
            .fill({ color: hslString(spec.hue, 40, 30, 1), alpha: spec.alpha });
        });
      }
      vortexArt.circle(cx, cy + 140, 30).stroke({ color: 'rgba(150,100,255,0.2)', width: 1 });
      if (looped && intensity > 0) {
        const startAngle = -Math.PI / 2;
        vortexArt
          .moveTo(cx + 30 * Math.cos(startAngle), cy + 140 + 30 * Math.sin(startAngle))
          .arc(cx, cy + 140, 30, startAngle, startAngle + intensity * Math.PI * 2)
          .stroke({ color: hslString(270, 80, 70, 0.6), width: 3, cap: 'round' });
      }

      burstGlow.clear();
      burstCore.clear();
      if (!vortex.collapsed) return;
      const progress = burstProgress.get();
      const opacity = progress < 0.1 ? progress / 0.1 : Math.max(0, 1 - (progress - 0.1) / 0.9);
      for (const particle of BURST_PARTICLES) {
        const travel = particle.speed * 25 * progress;
        const x = cx + Math.cos(particle.angle) * travel;
        const y = cy + Math.sin(particle.angle) * travel + progress * progress * 15;
        const radius = particle.radius * Math.max(0, 1 - progress * 0.5);
        burstCore
          .circle(x, y, radius)
          .fill({ color: hslString(particle.hue, 80, 60, 1), alpha: opacity });
        burstGlow
          .circle(x, y, radius * 2)
          .fill({ color: hslString(particle.hue, 80, 60, 0.25), alpha: opacity });
      }
    };
  };
  useFrameArt({ zIndex: REVEAL_PIXI_LAYER.effect }, build);

  const hintText =
    phase === 'atmosphere'
      ? '🌀 虚空凝聚中…'
      : phase === 'idle'
        ? '🌀 画圈加速旋转漩涡'
        : phase === 'collapse'
          ? '💥 虚空坍缩！'
          : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ position: 'absolute', inset: 0, background: BG_GRADIENT }}
    >
      <div
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        style={{ position: 'absolute', inset: 0 }}
      />
      <HintWithWarning hintText={hintText} showWarning={autoTimeoutWarning} />
      {(phase === 'collapse' || phase === 'revealed') && (
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
