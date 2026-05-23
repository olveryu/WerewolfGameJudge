/**
 * EnhancedRoulette - 老虎机风格角色揭示动画（CSS Transitions + Canvas）
 *
 * 特点：金属框架、霓虹灯、转轮滚动、弹跳停止、庆祝粒子。
 * 使用 CSS transitions/animations 驱动，
 * setTimeout 回调驱动阶段切换。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { shuffleArray } from '@werewolf/game-engine/utils/shuffle';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { CELEBRATION_EMOJIS } from '@/config/emojiTokens';
import { colors, crossPlatformTextShadow, spacing, typography } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const SLOT_COLORS = {
  frameOuter: '#2D2D2D',
  frameInner: '#1A1A1A',
  metalGradient: ['#4A4A4A', '#2D2D2D', '#1A1A1A', '#2D2D2D', '#4A4A4A'] as const,
  gold: '#FFD700',
  goldDark: '#B8860B',
  glowOrange: '#FFA500',
  neonPink: '#FF1493',
  neonBlue: '#00BFFF',
  neonGreen: '#39FF14',
  bulbOn: '#FFE566',
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
  leverHandle: '#cc3333',
  leverArm: '#888888',
  ledBg: '#111111',
  ledText: '#33ff33',
  jackpotGold: '#FFD700',
  coinGold: '#FFD700',
};

const TOP_BULB_IDS = ['t1', 't2', 't3', 't4', 't5', 't6'] as const;
const BOTTOM_BULB_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as const;

// ─── CSS Keyframes ──────────────────────────────────────────────────────
registerKeyframes('bulbFlicker', '0%{opacity:0}50%{opacity:1}100%{opacity:0}');
registerKeyframes(
  'particleFly',
  '0%{opacity:1;transform:translate(0,0) scale(0)}20%{transform:translate(var(--tx20),var(--ty20)) scale(1)}40%{opacity:1;transform:translate(var(--tx40),var(--ty40)) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}',
);
registerKeyframes('frameGlowPulse', '0%{opacity:0.3}50%{opacity:0.8}100%{opacity:0.3}');

// ─── Decorative bulb (CSS animation) ────────────────────────────────────
const AnimatedBulb: React.FC<{
  phase: 'idle' | 'spinning' | 'stopping' | 'revealed';
  reducedMotion: boolean;
  color?: string;
  size?: number;
  delay: number;
}> = React.memo(({ phase, reducedMotion, color = SLOT_COLORS.bulbOn, size = 8, delay }) => {
  const isOn = phase === 'spinning' && !reducedMotion;
  const isStopped = phase === 'stopping';

  const glowStyle: ViewStyle | undefined = isOn
    ? {
        animationName: 'bulbFlicker',
        animationDuration: '220ms',
        animationIterationCount: 'infinite',
        animationDelay: `${delay}ms`,
      }
    : isStopped
      ? { opacity: 1 }
      : { opacity: 0 };

  return (
    <View
      style={[
        styles.bulb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SLOT_COLORS.bulbOff,
        },
      ]}
    >
      <View
        style={[
          styles.bulbGlow,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            boxShadow: `0 0 ${size / 2}px ${color}`,
          },
          glowStyle,
        ]}
      />
    </View>
  );
});
AnimatedBulb.displayName = 'AnimatedBulb';

// ─── Self-animating emoji particle (CSS animation) ─────────────────────
interface EmojiParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  emoji: string;
  duration: number;
}

const EmojiParticle: React.FC<EmojiParticleConfig> = React.memo(
  ({ targetX, targetY, emoji, duration }) => {
    const animStyle: TextStyle = {
      animationName: 'particleFly',
      animationDuration: `${duration}ms`,
      animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      animationFillMode: 'forwards',
      // CSS custom properties for particle target
      transform: [{ translateX: targetX }, { translateY: targetY }],
      opacity: 0,
    };

    return <Text style={[styles.particle, animStyle]}>{emoji}</Text>;
  },
);
EmojiParticle.displayName = 'EmojiParticle';

/** Staggered delays (ms) per bulb for pseudo-random flicker (UI-thread only). */
const BULB_DELAYS: readonly number[] = [0, 67, 34, 89, 12, 56, 23, 78, 45, 90, 8, 61];

// ─── Props ──────────────────────────────────────────────────────────────
interface EnhancedRouletteProps extends RoleRevealEffectProps {
  /** All roles to show in the roulette */
  allRoles: RoleData[];
}

// ─── Main component ─────────────────────────────────────────────────────
export const EnhancedRoulette: React.FC<EnhancedRouletteProps> = ({
  role,
  allRoles,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'enhanced-roulette',
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const config = CONFIG.roulette;

  const [phase, setPhase] = useState<'idle' | 'spinning' | 'stopping' | 'revealed'>('idle');
  const [credit, setCredit] = useState(1);
  const [shuffledRoles] = useState<RoleData[]>(() => {
    const unique = [...new Set(allRoles.map((r) => r.id))];
    const roles = unique.map((id) => allRoles.find((r) => r.id === id)!);
    if (!roles.some((r) => r.id === role.id)) {
      roles.push(role);
    }
    return shuffleArray(roles);
  });
  const [particles, setParticles] = useState<EmojiParticleConfig[]>([]);

  // ── Animation state (replaces shared values) ──
  const [scrollPosition, setScrollPosition] = useState(0);
  const [bounceOffset, setBounceOffset] = useState(0);
  const [frameGlowActive, setFrameGlowActive] = useState(false);
  const [revealScale, setRevealScale] = useState(0.8);
  const [revealOpacity, setRevealOpacity] = useState(0);
  const [cabinetOpacity, setCabinetOpacity] = useState(1);
  const [jackpotOpacity, setJackpotOpacity] = useState(0);
  const [jackpotScale, setJackpotScale] = useState(0.5);
  const [creditFlickerActive, setCreditFlickerActive] = useState(false);
  const [pillarOpacity, setPillarOpacity] = useState(0);

  // Timer management
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const containerWidth = Math.min(screenWidth * 0.9, 340);
  const containerHeight = config.itemHeight * config.visibleItems;
  const frameWidth = containerWidth + 40;
  const frameHeight = containerHeight + 100;
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const centeringOffset = config.itemHeight;

  // ── Frame glow pulsing ──
  useEffect(() => {
    if (reducedMotion) return;
    setFrameGlowActive(true);
  }, [reducedMotion]);

  const targetIndex = useMemo(
    () => shuffledRoles.findIndex((r) => r.id === role.id),
    [shuffledRoles, role],
  );

  // Repeated list for smooth scrolling
  const repeatedRoles = useMemo(() => {
    const repeats = config.spinRotations + 2;
    const result: RoleData[] = [];
    for (let i = 0; i < repeats; i++) {
      result.push(...shuffledRoles);
    }
    return result;
  }, [shuffledRoles, config.spinRotations]);

  // ── Celebration particles ──
  const createParticles = useCallback(() => {
    const configs: EmojiParticleConfig[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const distance = 100 + Math.random() * 100;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 50,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length]!,
        duration: 800 + Math.random() * 400,
      });
    }
    setParticles(configs);
  }, []);

  // ── Transition to revealed ──
  const transitionToRevealed = useCallback(() => {
    setPhase('revealed');
    setCabinetOpacity(0);
    setRevealScale(1);
    setRevealOpacity(1);

    // JACKPOT banner pop-in
    schedule(() => {
      setJackpotOpacity(1);
      setJackpotScale(1);
    }, 200);

    // Light pillars fade out
    setPillarOpacity(0);
  }, [schedule]);

  // ── After bounce completes ──
  const afterBounce = useCallback(() => {
    if (enableHaptics) void triggerHaptic('heavy', true);
    createParticles();

    // Short delay then transition to revealed
    schedule(transitionToRevealed, 100);
  }, [enableHaptics, createParticles, transitionToRevealed, schedule]);

  // ── Start spin ──
  const startSpin = useCallback(() => {
    if (phase !== 'idle') return;

    setPhase('spinning');
    setCredit(0);
    if (enableHaptics) void triggerHaptic('medium', true);

    const targetPosition = config.spinRotations * shuffledRoles.length + targetIndex;

    // Credit display flicker during spin
    setCreditFlickerActive(true);

    // Main spin — set target position (CSS transition handles animation)
    setScrollPosition(targetPosition);

    // After spin duration, stopping phase
    schedule(() => {
      setPhase('stopping');
      setCreditFlickerActive(false);

      // Light pillars glow at stop
      setPillarOpacity(0.6);

      // Bounce
      setBounceOffset(-15);
      schedule(() => {
        setBounceOffset(0);
        schedule(afterBounce, 150);
      }, 100);
    }, config.spinDuration);
  }, [phase, enableHaptics, shuffledRoles.length, targetIndex, config, afterBounce, schedule]);

  // ── Auto-start spin after brief waiting period ──
  useEffect(() => {
    if (shuffledRoles.length === 0 || targetIndex < 0) return;

    if (reducedMotion) {
      setPhase('revealed');
      setCabinetOpacity(0);
      setRevealScale(1);
      setRevealOpacity(1);
      const timer = setTimeout(
        onComplete,
        CONFIG.common.reducedMotionFadeDuration + (config.revealHoldDuration ?? 1500),
      );
      return () => clearTimeout(timer);
    }

    // Wait for user to press SPIN button (or autoTimeout)
  }, [reducedMotion, shuffledRoles.length, targetIndex, config, onComplete, startSpin]);

  // ── Auto-timeout (warning + 8s auto-spin) ──
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle' && !reducedMotion, startSpin);

  // ── Reveal complete handler ──
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  // ── Computed styles ──
  const scrollTranslateY = centeringOffset - scrollPosition * config.itemHeight + bounceOffset;
  const scrollStyle: ViewStyle = {
    transform: [{ translateY: scrollTranslateY }],
    ...{
      transitionProperty: 'transform',
      transitionDuration: phase === 'spinning' ? `${config.spinDuration}ms` : '150ms',
      transitionTimingFunction:
        phase === 'spinning' ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'ease-out',
    },
  };

  const frameGlowStyle: ViewStyle | undefined = frameGlowActive
    ? {
        animationName: 'frameGlowPulse',
        animationDuration: '3s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }
    : { opacity: 0.3 };

  const cabinetFadeStyle: ViewStyle = {
    opacity: cabinetOpacity,
    ...{ transitionProperty: 'opacity', transitionDuration: '300ms' },
  };

  const revealedCardStyle: ViewStyle = {
    transform: [{ scale: revealScale }],
    opacity: revealOpacity,
    ...{
      transitionProperty: 'opacity, transform',
      transitionDuration: '300ms',
      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    },
  };

  const creditStyle: ViewStyle | undefined = creditFlickerActive
    ? {
        animationName: 'bulbFlicker',
        animationDuration: '120ms',
        animationIterationCount: 'infinite',
      }
    : undefined;

  const jackpotStyle: ViewStyle = {
    opacity: jackpotOpacity,
    transform: [{ scale: jackpotScale }],
    ...{
      transitionProperty: 'opacity, transform',
      transitionDuration: '400ms',
      transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  };

  const pillarStyle: ViewStyle = {
    opacity: pillarOpacity,
    ...{ transitionProperty: 'opacity', transitionDuration: '300ms' },
  };

  // ── Loading state ──
  if (shuffledRoles.length === 0) {
    return (
      <View
        testID={`${testIDPrefix}-container`}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>准备中…</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Felt table background */}
      <View style={styles.feltTable}>
        <LinearGradient
          colors={[SLOT_COLORS.feltGreen, SLOT_COLORS.feltDark]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Slot machine cabinet - fades out on reveal */}
      <View style={[styles.cabinet, { width: frameWidth, height: frameHeight }, cabinetFadeStyle]}>
        <LinearGradient
          colors={[...SLOT_COLORS.metalGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.outerFrame}
        >
          {/* Corner screws */}
          <View style={[styles.screw, styles.screwTopLeft]} />
          <View style={[styles.screw, styles.screwTopRight]} />
          <View style={[styles.screw, styles.screwBottomLeft]} />
          <View style={[styles.screw, styles.screwBottomRight]} />

          {/* Top panel */}
          <View style={styles.topPanel}>
            <Text style={styles.slotTitle}>🎰 JACKPOT 🎰</Text>
            <View style={styles.bulbRow}>
              {TOP_BULB_IDS.map((id, i) => (
                <AnimatedBulb
                  key={id}
                  phase={phase}
                  reducedMotion={reducedMotion}
                  color={i % 2 === 0 ? SLOT_COLORS.neonPink : SLOT_COLORS.neonBlue}
                  delay={BULB_DELAYS[i]!}
                />
              ))}
            </View>
          </View>

          {/* Neon glow */}
          <View style={[styles.neonBorder, frameGlowStyle]} />

          {/* Inner frame */}
          <View style={[styles.innerFrame, { backgroundColor: SLOT_COLORS.frameInner }]}>
            <View
              testID={`${testIDPrefix}-window`}
              style={[
                styles.reelWindow,
                {
                  width: containerWidth,
                  height: containerHeight,
                  backgroundColor: SLOT_COLORS.reelBg,
                },
              ]}
            >
              {/* Scrolling items */}
              <View style={[styles.scrollContainer, scrollStyle]}>
                {repeatedRoles.map((r, index) => {
                  const itemTheme = alignmentThemes[r.alignment];
                  return (
                    <View
                      key={`role-${r.id}-${index}`}
                      style={[styles.item, { height: config.itemHeight }]}
                    >
                      <LinearGradient
                        colors={[
                          SLOT_COLORS.itemCard,
                          SLOT_COLORS.itemCardHighlight,
                          SLOT_COLORS.itemCard,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.itemCard, { borderColor: SLOT_COLORS.itemCardBorder }]}
                      >
                        <Text style={styles.itemIcon}>{r.avatar || '❓'}</Text>
                        <Text
                          style={[styles.itemName, { color: itemTheme.primaryColor }]}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>

              {/* Gradient masks */}
              <LinearGradient
                colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                style={[styles.gradientMask, styles.gradientMaskTop]}
              />
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
                style={[styles.gradientMask, styles.gradientMaskBottom]}
              />

              {/* Selection indicators */}
              <View style={[styles.selectionIndicator, styles.selectionIndicatorLeft]}>
                <Text style={styles.indicatorArrow}>▶</Text>
              </View>
              <View style={[styles.selectionIndicator, styles.selectionIndicatorRight]}>
                <Text style={styles.indicatorArrow}>◀</Text>
              </View>

              {/* Center highlight */}
              <View style={[styles.centerHighlight, { backgroundColor: SLOT_COLORS.gold }]} />
            </View>
          </View>

          {/* Bottom panel */}
          <View style={styles.bottomPanel}>
            <View style={styles.bulbRow}>
              {BOTTOM_BULB_IDS.map((id, i) => (
                <AnimatedBulb
                  key={id}
                  phase={phase}
                  reducedMotion={reducedMotion}
                  color={i % 2 === 0 ? SLOT_COLORS.neonGreen : SLOT_COLORS.gold}
                  delay={BULB_DELAYS[6 + i]!}
                />
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* LED credit display — below machine */}
      <View style={[styles.ledDisplay, creditStyle]}>
        <Text style={styles.ledText}>CREDIT: {String(credit).padStart(2, '0')}</Text>
      </View>

      {/* Light pillars — glow when stopping */}
      {(phase === 'stopping' || phase === 'revealed') && (
        <View style={[styles.pillarContainer, pillarStyle]}>
          <View style={styles.pillarLeft} />
          <View style={styles.pillarRight} />
        </View>
      )}

      {/* Revealed card - cross-fades in */}
      <View
        style={[
          styles.revealedOverlay,
          revealedCardStyle,
          phase === 'revealed' ? styles.pointerEventsAuto : styles.pointerEventsNone,
        ]}
      >
        <View style={[styles.revealedCardContainer, { width: cardWidth, height: cardHeight }]}>
          <RoleCardContent
            roleId={role.id as RoleId}
            width={cardWidth}
            height={cardHeight}
            revealMode
            revealGradient={theme.revealGradient}
            animateEntrance={phase === 'revealed'}
          />
          <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
          {phase === 'revealed' && (
            <AlignmentRevealOverlay
              alignment={role.alignment}
              theme={theme}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              animate={!reducedMotion}
              onComplete={fireComplete}
            />
          )}
        </View>
      </View>

      {/* Celebration particles */}
      <View style={styles.particleContainer}>
        {particles.map((p) => (
          <EmojiParticle key={p.id} {...p} />
        ))}
      </View>

      {/* JACKPOT banner — pops in on reveal */}
      {phase === 'revealed' && (
        <View style={[styles.jackpotBanner, { top: insets.top + 50 }, jackpotStyle]}>
          <Text style={styles.jackpotText}>🎰 JACKPOT! 🎰</Text>
        </View>
      )}

      {/* Hint text */}
      <HintWithWarning
        hintText={
          phase === 'idle'
            ? '🎰 点击下方按钮，开始转动'
            : phase === 'spinning'
              ? '🎰 轮盘转动中…'
              : phase === 'stopping'
                ? '🎰 即将揭晓…'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* SPIN button (idle phase) */}
      {phase === 'idle' && (
        <Pressable onPress={startSpin} style={styles.spinButton} testID={`${testIDPrefix}-spin`}>
          <Text style={styles.spinButtonText}>🎰 SPIN</Text>
        </Pressable>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' as const },
  pointerEventsAuto: { pointerEvents: 'auto' as const },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.body,
  },
  cabinet: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerFrame: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 12px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  neonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: SLOT_COLORS.neonPink,
    boxShadow: `0px 0px 10px ${SLOT_COLORS.neonPink}`,
  },
  innerFrame: {
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)',
  },
  topPanel: {
    alignItems: 'center',
    marginBottom: 8,
  },
  slotTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SLOT_COLORS.gold,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 1, 1, 2),
    marginBottom: 6,
  },
  bottomPanel: {
    alignItems: 'center',
    marginTop: 8,
  },
  bulbRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  bulb: {
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  bulbGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  screw: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SLOT_COLORS.screwBg,
    borderWidth: 1,
    borderColor: SLOT_COLORS.screwBorder,
  },
  screwTopLeft: { top: 8, left: 8 },
  screwTopRight: { top: 8, right: 8 },
  screwBottomLeft: { bottom: 8, left: 8 },
  screwBottomRight: { bottom: 8, right: 8 },
  reelWindow: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: SLOT_COLORS.reelWindowBorder,
  },
  scrollContainer: {
    width: '100%',
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: 8,
    borderWidth: 1,
    width: '95%',
    boxShadow: '0px 2px 3px rgba(0,0,0,0.3)',
  },
  itemIcon: {
    fontSize: 36,
    marginRight: spacing.medium,
  },
  itemName: {
    fontSize: typography.title,
    fontWeight: '700',
    flex: 1,
    ...crossPlatformTextShadow('rgba(0,0,0,0.5)', 1, 1, 2),
  },
  gradientMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    pointerEvents: 'none',
  },
  gradientMaskTop: { top: 0 },
  gradientMaskBottom: { bottom: 0 },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
  },
  selectionIndicatorLeft: { left: 4 },
  selectionIndicatorRight: { right: 4 },
  indicatorArrow: {
    fontSize: 16,
    color: SLOT_COLORS.gold,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 1, 1, 2),
  },
  centerHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    marginTop: -1,
    opacity: 0.5,
  },
  revealedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealedCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  hint: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: typography.body,
    fontWeight: '600',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
  spinButton: {
    position: 'absolute',
    bottom: 155,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: SLOT_COLORS.gold,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: SLOT_COLORS.goldDark,
    boxShadow: `0px 4px 8px rgba(0, 0, 0, 0.4)`,
  },
  spinButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 2,
  },
  particle: {
    position: 'absolute',
    fontSize: 24,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  feltTable: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  ledDisplay: {
    position: 'absolute',
    bottom: 115,
    backgroundColor: SLOT_COLORS.ledBg,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
    pointerEvents: 'none',
  },
  ledText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: SLOT_COLORS.ledText,
    letterSpacing: 2,
  },
  pillarContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    pointerEvents: 'none',
  },
  pillarLeft: {
    width: 4,
    height: '60%',
    backgroundColor: SLOT_COLORS.gold,
    opacity: 0.3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  pillarRight: {
    width: 4,
    height: '60%',
    backgroundColor: SLOT_COLORS.gold,
    opacity: 0.3,
    borderRadius: 2,
    alignSelf: 'center',
  },
  jackpotBanner: {
    position: 'absolute',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  jackpotText: {
    fontSize: 28,
    fontWeight: '900',
    color: SLOT_COLORS.jackpotGold,
    letterSpacing: 4,
    ...crossPlatformTextShadow(SLOT_COLORS.goldDark, 0, 2, 8),
  },
});
