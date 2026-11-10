/**
 * EnhancedRoulette: a slot-machine cabinet whose reel spins through the board's roles and lands
 * on the player's, then the cabinet fades and the card pops in under a JACKPOT banner.
 */
import { shuffleArray } from '@game-judge/game-engine/platform/random';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { AtmosphericBackground } from '../common/AtmosphericBackground';
import { HintWithWarning } from '../common/HintWithWarning';
import { RevealedCard } from '../common/RevealedCard';
import { CELEBRATION_EMOJIS, CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  interpolate,
  useFrameStyle,
  useRevealCardSize,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const SLOT_COLORS = {
  metalGradient: ['#4A4A4A', '#2D2D2D', '#1A1A1A', '#2D2D2D', '#4A4A4A'],
  frameInner: '#1A1A1A',
  gold: '#FFD700',
  goldDark: '#B8860B',
  neonPink: '#FF1493',
  neonBlue: '#00BFFF',
  neonGreen: '#39FF14',
  bulbOff: '#666666',
  reelBg: '#FFFFFF',
  itemCard: '#F5F5F5',
  itemCardBorder: '#E0E0E0',
  itemCardHighlight: '#FFFFFF',
  screwBg: '#555',
  screwBorder: '#777',
  reelWindowBorder: '#333',
  feltGreen: '#1a5c2e',
  feltDark: '#0f3a1c',
  ledBg: '#111111',
  ledText: '#33ff33',
} as const;

const PARTICLE_COUNT = 20;
const TOP_BULB_DELAYS = [0, 67, 34, 89, 12, 56] as const;
const BOTTOM_BULB_DELAYS = [23, 78, 45, 90, 8, 61] as const;

const RC = CONFIG.roulette;

type Phase = 'idle' | 'spinning' | 'stopping' | 'revealed';

const fill = { position: 'absolute', inset: 0 } as const;

function textShadow(color: string, x: number, y: number, blur: number): string {
  return `${x}px ${y}px ${blur}px ${color}`;
}

interface BulbProps {
  readonly phase: Phase;
  readonly reducedMotion: boolean;
  readonly color: string;
  readonly delay: number;
}

const BULB_SIZE = 8;

function Bulb({ phase, reducedMotion, color, delay }: BulbProps) {
  const glow = useSharedValue(0);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'spinning' && !reducedMotion) {
      glow.animate(
        withDelay(
          delay,
          withRepeat(
            withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 100 })),
            -1,
          ),
        ),
      );
    } else if (phase === 'stopping') {
      glow.animate(withTiming(1, { duration: 100 }));
    } else {
      glow.set(0);
    }
    return () => glow.cancel();
  }, [phase, reducedMotion, delay, glow]);

  useFrameStyle(glowRef, () => ({ opacity: glow.get() }));

  return (
    <div
      style={{
        position: 'relative',
        width: BULB_SIZE,
        height: BULB_SIZE,
        margin: '0 4px',
        borderRadius: BULB_SIZE / 2,
        overflow: 'hidden',
        background: SLOT_COLORS.bulbOff,
      }}
    >
      <div
        ref={glowRef}
        style={{
          ...fill,
          opacity: 0,
          borderRadius: BULB_SIZE / 2,
          background: color,
          boxShadow: `0 0 ${BULB_SIZE / 2}px ${color}`,
        }}
      />
    </div>
  );
}

function BulbRow({
  phase,
  reducedMotion,
  colors,
  delays,
}: {
  readonly phase: Phase;
  readonly reducedMotion: boolean;
  readonly colors: readonly [string, string];
  readonly delays: readonly number[];
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', width: '80%' }}>
      {delays.map((delay, index) => (
        <Bulb
          key={delay}
          phase={phase}
          reducedMotion={reducedMotion}
          color={colors[index % 2] ?? colors[0]}
          delay={delay}
        />
      ))}
    </div>
  );
}

interface ParticleConfig {
  readonly id: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly emoji: string;
  readonly duration: number;
}

function EmojiParticle({ targetX, targetY, emoji, duration }: ParticleConfig) {
  const progress = useSharedValue(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    progress.animate(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [duration, progress]);
  useFrameStyle(ref, () => {
    const value = progress.get();
    const scale = interpolate(value, [0, 0.2, 0.4, 1], [0, 1, 1, 0]);
    return {
      transform: `translate(${value * targetX}px, ${value * targetY}px) scale(${scale})`,
      opacity: interpolate(value, [0, 0.7, 1], [1, 0.5, 0]),
    };
  });
  return (
    <span ref={ref} style={{ position: 'absolute', fontSize: 24, transform: 'scale(0)' }}>
      {emoji}
    </span>
  );
}

function createParticles(): ParticleConfig[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const angle = (Math.PI * 2 * index) / PARTICLE_COUNT + Math.random() * 0.5;
    const distance = 100 + Math.random() * 100;
    return {
      id: index,
      targetX: Math.cos(angle) * distance,
      targetY: Math.sin(angle) * distance - 50,
      emoji: CELEBRATION_EMOJIS[index % CELEBRATION_EMOJIS.length] ?? '⭐',
      duration: 800 + Math.random() * 400,
    };
  });
}

const SCREW_STYLE: CSSProperties = {
  position: 'absolute',
  width: 12,
  height: 12,
  boxSizing: 'border-box',
  borderRadius: 6,
  background: SLOT_COLORS.screwBg,
  border: `1px solid ${SLOT_COLORS.screwBorder}`,
};

const GOLD_TEXT_SHADOW = textShadow(SLOT_COLORS.goldDark, 1, 1, 2);

/** Pull the slot machine's lever and the reel lands on the player's role. */
export default function EnhancedRoulette({
  role,
  allRoles,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: screenWidth } = useViewportSize();
  const { width: cardWidth, height: cardHeight } = useRevealCardSize();
  const theme = ALIGNMENT_THEMES[role.alignment];

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'idle');
  const [credit, setCredit] = useState(1);
  const [shuffledRoles] = useState(() => {
    const roles = [...new Map(allRoles.map((entry) => [entry.id, entry])).values()];
    if (!roles.some((entry) => entry.id === role.id)) roles.push(role);
    return shuffleArray(roles);
  });
  const [particles, setParticles] = useState<readonly ParticleConfig[]>([]);
  const { fireComplete } = useRevealLifecycle(onComplete, RC.revealHoldDuration);

  const scroll = useSharedValue(0);
  const bounce = useSharedValue(0);
  const frameGlow = useSharedValue(0);
  const revealScale = useSharedValue(0.8);
  const revealOpacity = useSharedValue(0);
  const cabinetOpacity = useSharedValue(1);
  const jackpotOpacity = useSharedValue(0);
  const jackpotScale = useSharedValue(0.5);
  const creditFlicker = useSharedValue(1);
  const pillarOpacity = useSharedValue(0);

  const containerWidth = Math.min(screenWidth * 0.9, 340);
  const containerHeight = RC.itemHeight * RC.visibleItems;
  const centeringOffset = RC.itemHeight;
  const targetIndex = shuffledRoles.findIndex((entry) => entry.id === role.id);
  const repeatedRoles = Array.from({ length: RC.spinRotations + 2 }, () => shuffledRoles).flat();

  useEffect(() => {
    if (reducedMotion) return;
    frameGlow.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [frameGlow, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) return;
    const fade = { duration: CONFIG.common.reducedMotionFadeDuration };
    cabinetOpacity.animate(withTiming(0, fade));
    revealScale.animate(withTiming(1, fade));
    revealOpacity.animate(withTiming(1, fade));
    const timer = setTimeout(
      fireComplete,
      CONFIG.common.reducedMotionFadeDuration + RC.revealHoldDuration,
    );
    return () => clearTimeout(timer);
  }, [reducedMotion, cabinetOpacity, revealScale, revealOpacity, fireComplete]);

  const transitionToRevealed = () => {
    setPhase('revealed');
    cabinetOpacity.animate(withTiming(0, { duration: 300 }));
    revealScale.animate(withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
    revealOpacity.animate(withTiming(1, { duration: 300 }));
    jackpotOpacity.animate(withDelay(200, withTiming(1, { duration: 300 })));
    jackpotScale.animate(
      withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) })),
    );
    pillarOpacity.animate(withTiming(0, { duration: 500 }));
  };

  const afterBounce = () => {
    setParticles(createParticles());
    revealScale.animate(withDelay(100, withTiming(0.8, { duration: 1 })), transitionToRevealed);
  };

  const startSpin = () => {
    if (phase !== 'idle') return;
    setPhase('spinning');
    setCredit(0);
    creditFlicker.animate(
      withRepeat(
        withSequence(withTiming(0.3, { duration: 60 }), withTiming(1, { duration: 60 })),
        Math.floor(RC.spinDuration / 120),
      ),
    );
    const targetPosition = RC.spinRotations * shuffledRoles.length + targetIndex;
    scroll.animate(
      withTiming(targetPosition, { duration: RC.spinDuration, easing: Easing.out(Easing.cubic) }),
      () => {
        setPhase('stopping');
        pillarOpacity.animate(withTiming(0.6, { duration: 200 }));
        bounce.animate(
          withSequence(
            withTiming(-15, { duration: 100, easing: Easing.out(Easing.cubic) }),
            withTiming(0, { duration: 150, easing: Easing.out(Easing.cubic) }),
          ),
          afterBounce,
        );
      },
    );
  };

  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' && !reducedMotion, startSpin);

  const reelRef = useRef<HTMLDivElement>(null);
  const neonRef = useRef<HTMLDivElement>(null);
  const cabinetRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const creditRef = useRef<HTMLDivElement>(null);
  const jackpotRef = useRef<HTMLDivElement>(null);
  const pillarRef = useRef<HTMLDivElement>(null);
  useFrameStyle(reelRef, () => ({
    transform: `translateY(${centeringOffset - scroll.get() * RC.itemHeight + bounce.get()}px)`,
  }));
  useFrameStyle(neonRef, () => ({ opacity: interpolate(frameGlow.get(), [0, 1], [0.3, 0.8]) }));
  useFrameStyle(cabinetRef, () => ({ opacity: cabinetOpacity.get() }));
  useFrameStyle(revealRef, () => ({
    opacity: revealOpacity.get(),
    transform: `scale(${revealScale.get()})`,
  }));
  useFrameStyle(creditRef, () => ({ opacity: creditFlicker.get() }));
  useFrameStyle(jackpotRef, () => ({
    opacity: jackpotOpacity.get(),
    transform: `translateX(-50%) scale(${jackpotScale.get()})`,
  }));
  useFrameStyle(pillarRef, () => ({ opacity: pillarOpacity.get() }));

  const hintText =
    phase === 'idle'
      ? '🎰 点击下方按钮，开始转动'
      : phase === 'spinning'
        ? '🎰 轮盘转动中…'
        : phase === 'stopping'
          ? '🎰 即将揭晓…'
          : null;

  const pillarStyle: CSSProperties = {
    width: 4,
    height: '60%',
    background: SLOT_COLORS.gold,
    opacity: 0.3,
    borderRadius: 2,
    alignSelf: 'center',
  };

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{
        ...fill,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background)',
      }}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '40%',
          borderRadius: '16px 16px 0 0',
          background: `linear-gradient(180deg, ${SLOT_COLORS.feltGreen}, ${SLOT_COLORS.feltDark})`,
          pointerEvents: 'none',
        }}
      />

      <div
        ref={cabinetRef}
        style={{
          position: 'relative',
          display: 'flex',
          width: containerWidth + 40,
          height: containerHeight + 100,
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            boxSizing: 'border-box',
            borderRadius: 16,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(to bottom right, ${SLOT_COLORS.metalGradient.join(', ')})`,
            boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ ...SCREW_STYLE, top: 8, left: 8 }} />
          <div style={{ ...SCREW_STYLE, top: 8, right: 8 }} />
          <div style={{ ...SCREW_STYLE, bottom: 8, left: 8 }} />
          <div style={{ ...SCREW_STYLE, bottom: 8, right: 8 }} />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              alignSelf: 'stretch',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: SLOT_COLORS.gold,
                textShadow: GOLD_TEXT_SHADOW,
                marginBottom: 6,
              }}
            >
              🎰 JACKPOT 🎰
            </span>
            <BulbRow
              phase={phase}
              reducedMotion={reducedMotion}
              colors={[SLOT_COLORS.neonPink, SLOT_COLORS.neonBlue]}
              delays={TOP_BULB_DELAYS}
            />
          </div>

          <div
            ref={neonRef}
            style={{
              ...fill,
              boxSizing: 'border-box',
              borderRadius: 16,
              border: `2px solid ${SLOT_COLORS.neonPink}`,
              boxShadow: `0px 0px 10px ${SLOT_COLORS.neonPink}`,
              opacity: 0.3,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              borderRadius: 12,
              padding: 8,
              background: SLOT_COLORS.frameInner,
              boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              data-testid={`${testIDPrefix}-window`}
              style={{
                position: 'relative',
                width: containerWidth,
                height: containerHeight,
                boxSizing: 'border-box',
                borderRadius: 8,
                overflow: 'hidden',
                border: `3px solid ${SLOT_COLORS.reelWindowBorder}`,
                background: SLOT_COLORS.reelBg,
              }}
            >
              <div
                ref={reelRef}
                style={{ width: '100%', transform: `translateY(${centeringOffset}px)` }}
              >
                {repeatedRoles.map((entry, index) => (
                  <div
                    key={`role-${entry.id}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      height: RC.itemHeight,
                      padding: '0 var(--space-small)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        width: '95%',
                        padding: 'var(--space-small) var(--space-medium)',
                        borderRadius: 8,
                        border: `1px solid ${SLOT_COLORS.itemCardBorder}`,
                        background: `linear-gradient(to bottom right, ${SLOT_COLORS.itemCard}, ${SLOT_COLORS.itemCardHighlight}, ${SLOT_COLORS.itemCard})`,
                        boxShadow: '0px 2px 3px rgba(0,0,0,0.3)',
                      }}
                    >
                      <span style={{ fontSize: 36, marginRight: 'var(--space-medium)' }}>
                        {entry.name.charAt(0)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'var(--font-title)',
                          fontWeight: 700,
                          color: ALIGNMENT_THEMES[entry.alignment].primaryColor,
                          textShadow: textShadow('rgba(0,0,0,0.5)', 1, 1, 2),
                        }}
                      >
                        {entry.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 40,
                  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,0))',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 40,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,1))',
                  pointerEvents: 'none',
                }}
              />
              {(['left', 'right'] as const).map((side) => (
                <span
                  key={side}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    marginTop: -12,
                    [side]: 4,
                    fontSize: 16,
                    color: SLOT_COLORS.gold,
                    textShadow: GOLD_TEXT_SHADOW,
                  }}
                >
                  {side === 'left' ? '▶' : '◀'}
                </span>
              ))}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: 2,
                  marginTop: -1,
                  opacity: 0.5,
                  background: SLOT_COLORS.gold,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              alignSelf: 'stretch',
              marginTop: 8,
            }}
          >
            <BulbRow
              phase={phase}
              reducedMotion={reducedMotion}
              colors={[SLOT_COLORS.neonGreen, SLOT_COLORS.gold]}
              delays={BOTTOM_BULB_DELAYS}
            />
          </div>
        </div>
      </div>

      <div
        ref={creditRef}
        style={{
          position: 'absolute',
          bottom: 115,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 16px',
          borderRadius: 4,
          border: '1px solid #333',
          background: SLOT_COLORS.ledBg,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: 700,
            color: SLOT_COLORS.ledText,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
          }}
        >
          CREDIT: {String(credit).padStart(2, '0')}
        </span>
      </div>

      {(phase === 'stopping' || phase === 'revealed') && (
        <div
          ref={pillarRef}
          style={{
            ...fill,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 40px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <div style={pillarStyle} />
          <div style={pillarStyle} />
        </div>
      )}

      <div
        ref={revealRef}
        style={{
          ...fill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transform: 'scale(0.8)',
          pointerEvents: phase === 'revealed' ? 'auto' : 'none',
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

      <div
        style={{
          ...fill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {particles.map((particle) => (
          <EmojiParticle key={particle.id} {...particle} />
        ))}
      </div>

      {phase === 'revealed' && !reducedMotion && (
        <div
          ref={jackpotRef}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 50px)',
            left: '50%',
            opacity: 0,
            transform: 'translateX(-50%) scale(0.5)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 900,
              whiteSpace: 'nowrap',
              color: SLOT_COLORS.gold,
              letterSpacing: 4,
              textShadow: textShadow(SLOT_COLORS.goldDark, 0, 2, 8),
            }}
          >
            🎰 JACKPOT! 🎰
          </span>
        </div>
      )}

      <HintWithWarning hintText={hintText} showWarning={autoTimeoutWarning} />

      {phase === 'idle' && (
        <button
          type="button"
          data-testid={`${testIDPrefix}-spin`}
          onClick={startSpin}
          style={{
            position: 'absolute',
            bottom: 155,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 32px',
            borderRadius: 24,
            border: `2px solid ${SLOT_COLORS.goldDark}`,
            background: SLOT_COLORS.gold,
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)',
            fontSize: 22,
            fontWeight: 800,
            color: '#1A1A1A',
            letterSpacing: 2,
            cursor: 'pointer',
          }}
        >
          🎰 SPIN
        </button>
      )}
    </div>
  );
}
