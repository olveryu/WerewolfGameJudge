/**
 * GachaMachine: turn the dial, a capsule drops out of the machine, tap it to crack it open and
 * the role card pops out with its rarity tier.
 *
 * The old Skia layer sat beneath the machine: its blinking rotary lights are DOM here so the dome
 * still covers them. Its confetti burst stayed inside the card's footprint beneath the opaque card,
 * so it never showed; it is not ported.
 */
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import type { RevealAlignment } from '../../../model/RevealRoleData';
import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { REVEAL_DOM_LAYER } from '../common/layers';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const CAPSULE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#DDA0DD',
  '#87CEEB',
  '#F0E68C',
] as const;

const GACHA_COLORS = {
  body: 'linear-gradient(180deg, #FF7F7F 0%, #FF6B6B 50%, #E55555 100%)',
  background: 'linear-gradient(180deg, #FFF5E6 0%, #FFE4CC 50%, #FFF5E6 100%)',
  base: 'linear-gradient(180deg, #666 0%, #444 50%, #333 100%)',
  dome: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(200,220,255,0.6) 50%, rgba(255,255,255,0.8) 100%)',
  coinSlot: '#333',
  coinSlotInner: '#111',
  label: '#FFF',
  labelText: '#FF6B6B',
  outlet: '#222',
  outletInner: '#111',
  dialCenter: '#FFD700',
  dialCenterBorder: '#DAA520',
  dialArm: '#888',
  dialKnob: '#E74C3C',
  dialKnobBorder: '#C0392B',
  capsuleTop: '#FF69B4',
  capsuleBottom: '#FFF',
  capsuleRing: '#EEE',
  capsuleRingBorder: '#DDD',
  coin: '#FFD700',
  coinEdge: '#DAA520',
  coinSymbol: '#8B6914',
  exitSlide: '#555',
  crackLine: '#333333',
  rotary: ['#ff3333', '#ffdd33', '#33dd66', '#3388ff'],
} as const;

const RARITY_LABEL: Record<RevealAlignment, { readonly tier: string; readonly color: string }> = {
  wolf: { tier: 'SSR', color: '#ff3366' },
  god: { tier: 'SSR', color: '#ffd700' },
  villager: { tier: 'SR', color: '#66bbff' },
  third: { tier: 'UR', color: '#cc66ff' },
  neutral: { tier: 'SR', color: '#66bbff' },
};

const ROTARY_LIGHTS = Array.from({ length: 8 }, (_, index) => ({
  angle: (Math.PI * 2 * index) / 8,
  color: GACHA_COLORS.rotary[index % 4] ?? '',
  phase: (index * Math.PI) / 4,
}));

const DOME_SIZE = 150;
const CAPSULE_SIZE = 80;

type Phase = 'ready' | 'spinning' | 'dropping' | 'waiting' | 'opening' | 'revealed';

interface TinyCapsuleConfig {
  readonly id: number;
  readonly angle: number;
  readonly distance: number;
  readonly color: string;
  readonly size: number;
}

function createTinyCapsules(): TinyCapsuleConfig[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: index,
    angle: ((Math.PI * 2) / 12) * index + Math.random() * 0.5,
    distance: 25 + Math.random() * 35,
    color: CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)] ?? '',
    size: 14 + Math.random() * 10,
  }));
}

/** One of the small capsules piled inside the dome. */
function TinyCapsule({ angle, distance, color, size }: TinyCapsuleConfig) {
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance + 10;
  return (
    <div
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        left: DOME_SIZE / 2 + x - size / 2,
        top: DOME_SIZE / 2 + y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        border: '0.5px solid rgba(255, 255, 255, 0.3)',
        backgroundColor: color,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.15,
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: size * 0.35,
          borderBottomLeftRadius: size / 2,
          borderBottomRightRadius: size / 2,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
      />
    </div>
  );
}

/** A blurred bulb ringing the dome, blinking out of phase with its neighbours. */
function RotaryLight({
  x,
  y,
  color,
  phase,
  cycle,
}: {
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly phase: number;
  readonly cycle: SharedValue;
}) {
  const lightRef = useRef<HTMLDivElement>(null);
  useFrameStyle(lightRef, () => ({ opacity: 0.3 + Math.sin(cycle.get() + phase) * 0.3 }));
  return (
    <div
      ref={lightRef}
      style={{
        position: 'absolute',
        left: x - 6,
        top: y - 6,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: color,
        filter: 'blur(4px)',
        opacity: 0.3 + Math.sin(phase) * 0.3,
        pointerEvents: 'none',
      }}
    />
  );
}

const capsuleHalfShine: CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 15,
  width: 20,
  height: 12,
  borderRadius: 10,
  backgroundColor: 'rgba(255, 255, 255, 0.6)',
};

const crackLineStyle: CSSProperties = {
  margin: '0 2px',
  fontSize: 20,
  color: GACHA_COLORS.crackLine,
  opacity: 0.7,
};

/** Turn the dial of a capsule toy machine; the capsule that drops out holds the role. */
export default function GachaMachine({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const rarity = RARITY_LABEL[role.alignment];

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'ready');
  const [tinyCapsules] = useState(createTinyCapsules);
  const { fireComplete } = useRevealLifecycle(onComplete, CONFIG.gachaMachine.revealHoldDuration);

  const dialRotation = useSharedValue(0);
  const capsuleY = useSharedValue(-30);
  const capsuleOpacity = useSharedValue(0);
  const capsuleRotate = useSharedValue(0);
  const shellScale = useSharedValue(1);
  const shellOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const cardScale = useSharedValue(reducedMotion ? 1 : 0);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const machineOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const bobble = useSharedValue(0);
  const rotaryLightCycle = useSharedValue(0);
  const coinSlideY = useSharedValue(-40);
  const coinOpacity = useSharedValue(0);
  const crackOpacity = useSharedValue(0);
  const rarityOpacity = useSharedValue(0);
  const rarityScale = useSharedValue(0.5);

  const machineRef = useRef<HTMLDivElement>(null);
  const domeRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const crackRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rarityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== 'ready' || reducedMotion) return;
    bobble.animate(
      withRepeat(
        withSequence(
          withTiming(3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(-3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    rotaryLightCycle.animate(
      withRepeat(withTiming(Math.PI * 2, { duration: 3000, easing: Easing.linear }), -1),
    );
    return () => {
      rotaryLightCycle.cancel();
      bobble.set(0);
    };
  }, [phase, reducedMotion, bobble, rotaryLightCycle]);

  const enterRevealed = () => {
    setPhase('revealed');
    machineOpacity.animate(withTiming(0, { duration: 300 }));
    rarityOpacity.animate(withDelay(300, withTiming(1, { duration: 300 })));
    rarityScale.animate(
      withDelay(300, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) })),
    );
  };

  const openCapsule = () => {
    if (phase !== 'waiting') return;
    setPhase('opening');
    crackOpacity.animate(
      withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(100, withTiming(0, { duration: 200 })),
      ),
    );
    shellScale.animate(withTiming(1.3, { duration: 250 }));
    shellOpacity.animate(withTiming(0, { duration: 250 }));
    cardScale.animate(
      withDelay(200, withTiming(1, { duration: 250, easing: Easing.out(Easing.back(1.2)) })),
      enterRevealed,
    );
    cardOpacity.animate(withDelay(200, withTiming(1, { duration: 250 })));
  };

  const spinDial = () => {
    if (phase !== 'ready') return;
    setPhase('spinning');
    coinOpacity.animate(
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(300, withTiming(0, { duration: 200 })),
      ),
    );
    coinSlideY.animate(withTiming(10, { duration: 300, easing: Easing.in(Easing.cubic) }));
    dialRotation.animate(
      withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) }),
      () => {
        setPhase('dropping');
        capsuleOpacity.set(1);
        capsuleY.animate(withTiming(200, { duration: 800, easing: Easing.bounce }), () =>
          setPhase('waiting'),
        );
        capsuleRotate.animate(withTiming(540, { duration: 800 }));
      },
    );
  };

  const readyWarning = useAutoTimeout(phase === 'ready' && !reducedMotion, spinDial);
  const waitingWarning = useAutoTimeout(phase === 'waiting' && !reducedMotion, openCapsule);

  useFrameStyle(machineRef, () => ({ opacity: machineOpacity.get() }));
  useFrameStyle(domeRef, () => ({ transform: `translateY(${bobble.get()}px)` }));
  useFrameStyle(dialRef, () => ({ transform: `rotate(${dialRotation.get()}deg)` }));
  useFrameStyle(coinRef, () => ({
    opacity: coinOpacity.get(),
    transform: `translateY(${coinSlideY.get()}px)`,
  }));
  useFrameStyle(capsuleRef, () => ({
    opacity: capsuleOpacity.get() * shellOpacity.get(),
    transform: `translateY(${capsuleY.get()}px) scale(${shellScale.get()}) rotate(${capsuleRotate.get()}deg)`,
  }));
  useFrameStyle(crackRef, () => ({ opacity: crackOpacity.get() }));
  useFrameStyle(cardRef, () => ({
    opacity: cardOpacity.get(),
    transform: `scale(${cardScale.get()})`,
  }));
  useFrameStyle(rarityRef, () => ({
    opacity: rarityOpacity.get(),
    transform: `scale(${rarityScale.get()})`,
  }));

  const hintText =
    phase === 'ready'
      ? '🎯 点击旋钮开始'
      : phase === 'spinning' || phase === 'dropping'
        ? '🎰 扭蛋掉落中'
        : phase === 'waiting'
          ? '✨ 点击扭蛋打开'
          : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: GACHA_COLORS.background }} />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {!reducedMotion &&
        ROTARY_LIGHTS.map((light) => (
          <RotaryLight
            key={light.phase}
            x={screenWidth / 2 + Math.cos(light.angle) * 100}
            y={screenHeight * 0.42 + Math.sin(light.angle) * 70}
            color={light.color}
            phase={light.phase}
            cycle={rotaryLightCycle}
          />
        ))}

      <div
        ref={machineRef}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: reducedMotion ? 0 : 1,
          pointerEvents: phase === 'revealed' ? 'none' : 'auto',
        }}
      >
        <div
          ref={domeRef}
          style={{
            position: 'relative',
            boxSizing: 'border-box',
            width: DOME_SIZE,
            height: DOME_SIZE,
            borderRadius: DOME_SIZE / 2,
            overflow: 'hidden',
            border: '3px solid rgba(255, 255, 255, 0.8)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: GACHA_COLORS.dome }} />
          {tinyCapsules.map((capsule) => (
            <TinyCapsule key={capsule.id} {...capsule} />
          ))}
          <div
            style={{
              position: 'absolute',
              top: 15,
              left: 20,
              width: 40,
              height: 25,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              transform: 'rotate(-30deg)',
            }}
          />
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 160,
            height: 120,
            marginTop: -10,
            borderRadius: 12,
            overflow: 'hidden',
            background: GACHA_COLORS.body,
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 50,
              height: 8,
              marginTop: 12,
              borderRadius: 4,
              backgroundColor: GACHA_COLORS.coinSlot,
            }}
          >
            <div
              style={{
                width: 30,
                height: 3,
                borderRadius: 2,
                backgroundColor: GACHA_COLORS.coinSlotInner,
              }}
            />
            <div
              ref={coinRef}
              style={{
                position: 'absolute',
                top: -20,
                left: 16,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 9,
                border: `2px solid ${GACHA_COLORS.coinEdge}`,
                backgroundColor: GACHA_COLORS.coin,
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, color: GACHA_COLORS.coinSymbol }}>
                ¥
              </span>
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              padding: '4px 12px',
              borderRadius: 8,
              backgroundColor: GACHA_COLORS.label,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 2,
                color: GACHA_COLORS.labelText,
              }}
            >
              GACHA
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 35,
              borderRadius: 8,
              backgroundColor: GACHA_COLORS.outlet,
            }}
          >
            <div
              style={{
                width: 50,
                height: 25,
                borderRadius: 6,
                backgroundColor: GACHA_COLORS.outletInner,
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              left: 45,
              width: 70,
              height: 12,
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
              backgroundColor: GACHA_COLORS.exitSlide,
              transform: 'perspective(200px) rotateX(20deg)',
            }}
          />
        </div>

        <button
          type="button"
          aria-label="旋钮"
          onClick={spinDial}
          style={{
            position: 'absolute',
            right: -50,
            top: 160,
            width: 60,
            height: 60,
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <div
            ref={dialRef}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
            }}
          >
            <div
              style={{
                boxSizing: 'border-box',
                width: 30,
                height: 30,
                borderRadius: 15,
                border: `3px solid ${GACHA_COLORS.dialCenterBorder}`,
                backgroundColor: GACHA_COLORS.dialCenter,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -5,
                left: 26,
                width: 8,
                height: 35,
                borderRadius: 4,
                backgroundColor: GACHA_COLORS.dialArm,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -15,
                left: 20,
                boxSizing: 'border-box',
                width: 20,
                height: 20,
                borderRadius: 10,
                border: `2px solid ${GACHA_COLORS.dialKnobBorder}`,
                backgroundColor: GACHA_COLORS.dialKnob,
              }}
            />
          </div>
        </button>

        <div
          style={{
            width: 180,
            height: 25,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            background: GACHA_COLORS.base,
          }}
        />
      </div>

      <HintWithWarning hintText={hintText} showWarning={readyWarning || waitingWarning} />

      {(phase === 'dropping' || phase === 'waiting' || phase === 'opening') && (
        <div
          ref={capsuleRef}
          style={{
            position: 'absolute',
            left: `calc(50% - ${CAPSULE_SIZE / 2}px)`,
            top: `calc(50% - ${CAPSULE_SIZE / 2}px)`,
            width: CAPSULE_SIZE,
            height: CAPSULE_SIZE,
            opacity: 0,
          }}
        >
          <button
            type="button"
            aria-label="扭蛋"
            onClick={openCapsule}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                width: '100%',
                height: '52%',
                borderTopLeftRadius: 999,
                borderTopRightRadius: 999,
                backgroundColor: GACHA_COLORS.capsuleTop,
              }}
            >
              <div style={capsuleHalfShine} />
              <span
                style={{
                  position: 'absolute',
                  top: 15,
                  right: 18,
                  fontSize: 10,
                  color: 'rgba(255, 255, 255, 0.4)',
                }}
              >
                ★
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: '52%',
                borderBottomLeftRadius: 999,
                borderBottomRightRadius: 999,
                backgroundColor: GACHA_COLORS.capsuleBottom,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 20,
                  fontSize: 8,
                  color: 'rgba(0, 0, 0, 0.1)',
                }}
              >
                ✦
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                top: '46%',
                boxSizing: 'border-box',
                width: '100%',
                height: 8,
                border: `1px solid ${GACHA_COLORS.capsuleRingBorder}`,
                backgroundColor: GACHA_COLORS.capsuleRing,
              }}
            />
            <div
              ref={crackRef}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              <span style={crackLineStyle}>╲</span>
              <span style={crackLineStyle}>╱</span>
              <span style={crackLineStyle}>│</span>
            </div>
          </button>
        </div>
      )}

      {(phase === 'opening' || phase === 'revealed') && (
        <div
          ref={cardRef}
          style={{
            position: 'absolute',
            inset: 0,
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
      )}

      {phase === 'revealed' && (
        <div
          ref={rarityRef}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 60px)',
            left: 0,
            right: 0,
            zIndex: REVEAL_DOM_LAYER.aboveCanvas,
            textAlign: 'center',
            opacity: 0,
            transform: 'scale(0.5)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 4,
              color: rarity.color,
              textShadow: '0px 2px 6px #00000066',
            }}
          >
            {rarity.tier}
          </span>
        </div>
      )}
    </div>
  );
}
