/**
 * FortuneWheel: a jewelled prize wheel carrying every role on the board; the player flings it,
 * it slows to a stop on their role, and the card rises under a golden arch.
 */
import { Container } from 'pixi.js';
import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import type { RevealRoleData } from '../../../model/RevealRoleData';
import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER, REVEAL_PIXI_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { graphicsLayer, groupLayer, radialGradient } from '../pixi/kit';
import { type ArtBuilder, useFrameArt } from '../pixiLayer';
import { useFrameStyle, useRevealCardSize, useSharedValue, useViewportSize } from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const BG_GRADIENT = 'linear-gradient(180deg, #0a0a1e 0%, #12122a 50%, #0a0a1e 100%)';

const SEGMENT_FILLS = [
  '#4B3F9E',
  '#2E8B7A',
  '#C0392B',
  '#2471A3',
  '#7D3C98',
  '#D4AC0D',
  '#1E8449',
  '#BA4A00',
  '#5B4FBE',
  '#3CB371',
  '#E74C3C',
  '#3498DB',
] as const;

const GOLD = '#FFD700';
const GOLD_DARK = '#B8860B';
const SEGMENT_DIVIDER = 'rgba(255, 215, 0, 0.5)';
const CENTER_FILL = '#1a1a2e';
const POINTER_FILL = '#E74C3C';
const POINTER_STROKE_COLOR = '#FFD700';
const HINT_ALIGNED_COLOR = '#4ECDC4';
const GEM_COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff6633'] as const;

const FW = CONFIG.fortuneWheel;

const RIM_RATIO = 0.04;
const LABEL_DIST = 0.62;
const LABEL_SIZE = 80;
const DOT_R = 3;
const POINTER_SIZE = 26;
const POINTER_GAP = 20;
const ARCH_CANVAS_SIZE = 400;
/** The wheel rests this long on the role before the card reveal starts. */
const STOPPED_PAUSE_MS = 400;
/** A fling spins the wheel when its angular speed exceeds this, in rad/s. */
const FLING_MIN_ANGULAR_SPEED = 0.5;
/** Pointer samples older than this do not count toward the fling velocity. */
const VELOCITY_WINDOW_MS = 100;

const FILL: CSSProperties = { position: 'absolute', inset: 0 };

function createFortuneStars(screenW: number, screenH: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    x: (((i * 73 + 17) % 100) / 100) * screenW,
    y: (((i * 41 + 31) % 100) / 100) * screenH,
    r: 0.5 + (((i * 59 + 7) % 100) / 100) * 1,
  }));
}

/** Keeps a label upright: labels on the lower half of the wheel turn half a revolution. */
function readableLabelDeg(midAngle: number): number {
  const deg = ((midAngle + Math.PI / 2) * 180) / Math.PI;
  const normalized = ((deg % 360) + 360) % 360;
  return normalized > 90 && normalized < 270 ? deg + 180 : deg;
}

/** Unique roles of the board, repeated round-robin up to six so the wheel is never sparse. */
function buildSegments(allRoles: readonly RevealRoleData[]) {
  const roles = [...new Map(allRoles.map((entry) => [entry.id, entry])).values()];
  const padded = [...roles];
  for (let index = 0; padded.length < 6; index++) {
    const next = roles[index % roles.length];
    if (!next) throw new Error('Fortune wheel needs at least one role');
    padded.push(next);
  }
  return padded;
}

interface PointerSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

type Phase = 'appear' | 'idle' | 'spinning' | 'stopped' | 'revealed';

/** Fling the board's prize wheel and let it settle on the player's role. */
export default function FortuneWheel({
  role,
  allRoles,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const wheelR = Math.min(screenWidth, screenHeight) * 0.38;
  const innerR = wheelR * (1 - RIM_RATIO);
  const centerR = wheelR * 0.18;

  const segments = buildSegments(allRoles);
  const segmentAngle = (Math.PI * 2) / segments.length;
  const targetIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.id === role.id),
  );
  const segmentData = segments.map((segment, index) => {
    const startAngle = index * segmentAngle - Math.PI / 2;
    const midAngle = startAngle + segmentAngle / 2;
    const labelDistance = wheelR * LABEL_DIST;
    return {
      startAngle,
      endAngle: startAngle + segmentAngle,
      color: SEGMENT_FILLS[index % SEGMENT_FILLS.length] ?? GOLD,
      displayLabel: segment.name.length > 4 ? segment.name.slice(0, 4) : segment.name,
      labelX: cx + labelDistance * Math.cos(midAngle),
      labelY: cy + labelDistance * Math.sin(midAngle),
      labelRotDeg: readableLabelDeg(midAngle),
      edgeX: cx + innerR * Math.cos(startAngle),
      edgeY: cy + innerR * Math.sin(startAngle),
      dotX: cx + (wheelR - DOT_R * 2.5) * Math.cos(startAngle),
      dotY: cy + (wheelR - DOT_R * 2.5) * Math.sin(startAngle),
    };
  });

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'appear');
  const { fireComplete } = useRevealLifecycle(onComplete);

  const wheelOpacity = useSharedValue(0);
  const wheelScale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const canvasOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flashOpacity = useSharedValue(0);
  const gemPulse = useSharedValue(0);
  const pointerTickGlow = useSharedValue(0);
  const victoryArchOpacity = useSharedValue(0);
  const victoryArchScale = useSharedValue(0.8);

  const dragRef = useRef<{ startAngle: number; rotationAtStart: number } | null>(null);
  const samplesRef = useRef<PointerSample[]>([]);
  const wheelDomRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const cardWrapperRef = useRef<HTMLDivElement>(null);

  /** Runs once the wheel has stood still for `STOPPED_PAUSE_MS`. */
  const triggerCardReveal = () => {
    const at = (delayMs: number) => STOPPED_PAUSE_MS + delayMs;
    flashOpacity.animate(
      withDelay(
        at(0),
        withSequence(withTiming(0.6, { duration: 100 }), withTiming(0, { duration: 400 })),
      ),
    );
    canvasOpacity.animate(withDelay(at(200), withTiming(0, { duration: 300 })));
    cardScale.animate(
      withDelay(
        at(300),
        withTiming(1, { duration: FW.cardRevealDuration, easing: Easing.out(Easing.back(1.15)) }),
      ),
      () => setPhase('revealed'),
    );
    cardOpacity.animate(withDelay(at(300), withTiming(1, { duration: FW.cardRevealDuration })));
    victoryArchOpacity.animate(withDelay(at(400), withTiming(0.8, { duration: 500 })));
    victoryArchScale.animate(
      withDelay(at(400), withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.1)) })),
    );
  };

  const computeTargetRotation = (currentRotation: number) => {
    const targetMidOffset = targetIndex * segmentAngle + segmentAngle / 2;
    const extraSpins = 4 + Math.floor(Math.random() * 3);
    const baseTarget = Math.PI * 2 * extraSpins - targetMidOffset;
    const normalizedCurrent = currentRotation % (Math.PI * 2);
    const jitter = (Math.random() - 0.5) * segmentAngle * 0.3;
    return currentRotation - normalizedCurrent + baseTarget + jitter;
  };

  useEffect(() => {
    if (reducedMotion) return;
    wheelOpacity.animate(withTiming(1, { duration: FW.appearDuration / 2 }));
    gemPulse.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }), -1),
    );
    wheelScale.animate(
      withTiming(1, { duration: FW.appearDuration, easing: Easing.out(Easing.back(1.15)) }),
      () => setPhase('idle'),
    );
  }, [reducedMotion, wheelOpacity, wheelScale, gemPulse]);

  const startDeceleratingToTarget = () => {
    setPhase('spinning');
    const finalRotation = computeTargetRotation(rotation.get());
    const duration = 2500 + Math.random() * 1000;
    pointerTickGlow.animate(
      withRepeat(
        withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 80 })),
        Math.floor(duration / 160),
      ),
    );
    rotation.animate(
      withTiming(finalRotation, { duration, easing: Easing.out(Easing.cubic) }),
      () => {
        setPhase('stopped');
        triggerCardReveal();
      },
    );
  };

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', () => {
    rotation.set(rotation.get() + Math.PI * 0.5);
    startDeceleratingToTarget();
  });

  const angleAt = (event: PointerEvent) => Math.atan2(event.clientY - cy, event.clientX - cx);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'idle') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startAngle: angleAt(event), rotationAtStart: rotation.get() };
    samplesRef.current = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }];
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || phase !== 'idle') return;
    rotation.set(drag.rotationAtStart + angleAt(event) - drag.startAngle);
    samplesRef.current = [
      ...samplesRef.current.filter((sample) => event.timeStamp - sample.t <= VELOCITY_WINDOW_MS),
      { x: event.clientX, y: event.clientY, t: event.timeStamp },
    ];
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || phase !== 'idle') return;
    const [first] = samplesRef.current;
    const elapsedSeconds = first ? (event.timeStamp - first.t) / 1000 : 0;
    if (!first || elapsedSeconds <= 0) return;
    const velocityX = (event.clientX - first.x) / elapsedSeconds;
    const velocityY = (event.clientY - first.y) / elapsedSeconds;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const angularVelocity = (-velocityY * dx + velocityX * dy) / distance / distance;
    if (Math.abs(angularVelocity) <= FLING_MIN_ANGULAR_SPEED) return;
    rotation.set(rotation.get() + angularVelocity * 0.3);
    startDeceleratingToTarget();
  };

  useFrameStyle(wheelDomRef, () => ({
    opacity: canvasOpacity.get() * wheelOpacity.get(),
    transform: `scale(${wheelScale.get()})`,
  }));
  useFrameStyle(labelsRef, () => ({ transform: `rotate(${rotation.get()}rad)` }));
  useFrameStyle(archRef, () => ({
    opacity: victoryArchOpacity.get(),
    transform: `scale(${victoryArchScale.get()})`,
  }));
  useFrameStyle(cardWrapperRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));

  const build: ArtBuilder = (root, own) => {
    if (!reducedMotion) {
      const stars = graphicsLayer(root, { blur: 4, screen: true });
      for (const star of createFortuneStars(screenWidth, screenHeight)) {
        stars
          .circle(star.x, star.y, star.r * 4)
          .fill({ color: '#aaaaff', alpha: 0.3 })
          .circle(star.x, star.y, star.r)
          .fill({ color: '#ccccff', alpha: 0.8 });
      }
    }

    const wheel = groupLayer(root, new Container());
    wheel.pivot.set(cx, cy);
    wheel.position.set(cx, cy);
    const rotor = groupLayer(wheel, new Container());
    rotor.pivot.set(cx, cy);
    rotor.position.set(cx, cy);

    const sectors = graphicsLayer(rotor);
    sectors
      .circle(cx, cy, wheelR)
      .fill(GOLD_DARK)
      .circle(cx, cy, wheelR)
      .stroke({ color: GOLD, width: 3 });
    for (const segment of segmentData) {
      sectors
        .moveTo(cx, cy)
        .lineTo(
          cx + innerR * Math.cos(segment.startAngle),
          cy + innerR * Math.sin(segment.startAngle),
        )
        .arc(cx, cy, innerR, segment.startAngle, segment.endAngle)
        .closePath()
        .fill(segment.color);
    }
    for (const segment of segmentData) {
      sectors
        .moveTo(cx, cy)
        .lineTo(segment.edgeX, segment.edgeY)
        .stroke({ color: SEGMENT_DIVIDER, width: 1.5 })
        .circle(segment.dotX, segment.dotY, DOT_R)
        .fill(GOLD);
    }
    sectors.circle(cx, cy, innerR).stroke({ color: GOLD_DARK, width: 1.5 });
    const gems = graphicsLayer(rotor, { blur: 3 });

    const hub = graphicsLayer(wheel);
    hub
      .circle(cx, cy, centerR)
      .fill(CENTER_FILL)
      .circle(cx, cy, centerR)
      .stroke({ color: GOLD, width: 3 })
      .circle(cx, cy, centerR * 0.7)
      .stroke({ color: GOLD_DARK, width: 1 })
      .circle(cx, cy, centerR * 0.35)
      .fill(own(radialGradient(cx - 2, cy - 2, centerR * 0.35, ['#ff6666', '#cc0033', '#660019'])));
    graphicsLayer(wheel, { blur: 1 })
      .circle(cx - 3, cy - 3, 3)
      .fill({ color: '#ffffff', alpha: 0.4 });

    const pointerTop = cy - wheelR - POINTER_GAP;
    const pointerTipY = pointerTop + POINTER_SIZE;
    const pointerHalfWidth = POINTER_SIZE * 0.55;
    const pointerPoints = [
      cx,
      pointerTipY,
      cx - pointerHalfWidth,
      pointerTop,
      cx + pointerHalfWidth,
      pointerTop,
    ];
    graphicsLayer(wheel)
      .poly(pointerPoints)
      .fill(POINTER_FILL)
      .poly(pointerPoints)
      .stroke({ color: POINTER_STROKE_COLOR, width: 2 });
    const tickGlow = graphicsLayer(wheel, { blur: 4 });
    tickGlow
      .circle(cx, pointerTipY, 8)
      .fill(own(radialGradient(cx, pointerTipY, 8, ['#ff666680', '#ff660000'])));

    const flash = graphicsLayer(root);
    flash.rect(0, 0, screenWidth, screenHeight).fill(theme.glowColor);

    return () => {
      wheel.alpha = canvasOpacity.get() * wheelOpacity.get();
      wheel.scale.set(wheelScale.get());
      rotor.rotation = rotation.get();
      const pulse = gemPulse.get();
      gems.clear();
      segmentData.forEach((segment, index) => {
        gems.circle(segment.dotX, segment.dotY, DOT_R + 2).fill({
          color: GEM_COLORS[index % GEM_COLORS.length] ?? GOLD,
          alpha: 0.5 + Math.sin(pulse + (index * Math.PI) / 3) * 0.3,
        });
      });
      tickGlow.alpha = pointerTickGlow.get() * 0.6;
      flash.alpha = flashOpacity.get();
    };
  };
  useFrameArt({ zIndex: REVEAL_PIXI_LAYER.effect }, build);

  const hintText =
    phase === 'appear'
      ? '🎰 转盘就绪'
      : phase === 'idle'
        ? '🎰 拨动转盘，揭晓身份'
        : phase === 'spinning'
          ? '🎰 命运转动中'
          : phase === 'stopped'
            ? '✨ 命运已定！'
            : null;

  const archCenterX = cardWidth / 2 + 20;
  const archCenterY = cardHeight / 2 + 20;
  const archRadius = cardWidth * 0.7;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ ...FILL, background: BG_GRADIENT, overflow: 'hidden' }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: 120, height: 8, backgroundColor: '#333355', borderRadius: 4 }} />
        <div
          style={{
            width: 80,
            height: 30,
            marginTop: -1,
            backgroundColor: '#222244',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        />
      </div>

      <div
        ref={wheelDomRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        style={{
          ...FILL,
          zIndex: REVEAL_DOM_LAYER.aboveCanvas,
          touchAction: 'none',
          opacity: 0,
        }}
      >
        <div ref={labelsRef} style={{ ...FILL, pointerEvents: 'none' }}>
          {segmentData.map((segment, index) => (
            <div
              key={`lbl-${index}`}
              style={{
                position: 'absolute',
                left: segment.labelX - LABEL_SIZE / 2,
                top: segment.labelY - LABEL_SIZE / 2,
                width: LABEL_SIZE,
                height: LABEL_SIZE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${segment.labelRotDeg}deg)`,
              }}
            >
              <span
                style={{
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: 800,
                  textAlign: 'center',
                  textShadow: '0px 1px 3px rgba(0, 0, 0, 0.8)',
                }}
              >
                {segment.displayLabel}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: cx - 20,
            top: cy - 16,
            width: 40,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              color: GOLD,
              fontSize: 22,
              fontWeight: 900,
              textShadow: '0px 1px 2px rgba(0, 0, 0, 0.5)',
            }}
          >
            ?
          </span>
        </div>
      </div>

      <HintWithWarning
        hintText={hintText}
        showWarning={autoTimeoutWarning}
        hintStyle={phase === 'stopped' ? { color: HINT_ALIGNED_COLOR } : undefined}
      />

      {(phase === 'stopped' || phase === 'revealed') && (
        <>
          <div
            ref={archRef}
            style={{
              ...FILL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              opacity: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: ARCH_CANVAS_SIZE,
                height: ARCH_CANVAS_SIZE,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: archCenterX - archRadius,
                  top: archCenterY - archRadius,
                  width: archRadius * 2,
                  height: archRadius * 2,
                  borderRadius: '50%',
                  background: `radial-gradient(circle closest-side, ${GOLD}00, ${GOLD}30, ${GOLD}00)`,
                }}
              />
              {Array.from({ length: 8 }, (_, index) => {
                const angle = (Math.PI * 2 * index) / 8;
                const rayInner = cardWidth * 0.45;
                const rayOuter = cardWidth * 0.65;
                return (
                  <div
                    key={`ray-${index}`}
                    style={{
                      position: 'absolute',
                      left: archCenterX + Math.cos(angle) * rayInner,
                      top: archCenterY + Math.sin(angle) * rayInner - 1,
                      width: rayOuter - rayInner,
                      height: 2,
                      background: GOLD,
                      transformOrigin: '0 50%',
                      transform: `rotate(${angle}rad)`,
                      filter: 'blur(3px)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div
            ref={cardWrapperRef}
            style={{
              ...FILL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
        </>
      )}
    </div>
  );
}
