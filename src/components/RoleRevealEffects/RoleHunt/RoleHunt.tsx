/**
 * RoleHunt - 瞄准镜狙击揭示动画（Canvas 2D + Reanimated 4）
 *
 * 动画流程：森林夜景背景 → 动物角色从左右横穿屏幕 → 玩家拖动瞄准镜瞄准 →
 * 抬手/点击射击 → 命中非目标角色（烟雾消散）→ 命中目标角色时全屏庆祝 → 揭示角色卡。
 *
 * Canvas 2D DOM 组件负责：森林背景 + 萤火虫 + 瞄准镜 + 命中爆发光线。
 * Reanimated 负责：动物横穿动画、庆祝粒子、卡牌揭示。
 * 交互完全在 Canvas DOM 组件内管理（pointer events）。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
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
import { CELEBRATION_EMOJIS } from '@/config/emojiTokens';
import { colors, crossPlatformTextShadow } from '@/theme';

import RoleHuntCanvas from './RoleHuntCanvas';

// ─── Visual constants ──────────────────────────────────────────────────

const HIT_RADIUS = 35;
const ANIMAL_SIZE = 60;
const GROUND_TOP_RATIO = 0.52;
const GROUND_BOTTOM_PADDING_RATIO = 0.16;
const SPAWN_INTERVAL_MS = 1200;
const TARGET_SPAWN_INTERVAL_MS = 3500;

const SKY_COLORS = {
  top: '#0b1a2d',
  mid2: '#1a3a3a',
  bottom: '#0d2818',
};

const HUNT_COLORS = {
  animalName: '#ffffff',
  animalNameBg: 'rgba(0, 0, 0, 0.5)',
  hitFlash: 'rgba(100, 255, 150, 0.6)',
};

const HUNT_ANIMAL_EMOJIS = [
  '🐰',
  '🦌',
  '🐻',
  '🦊',
  '🐗',
  '🦝',
  '🐿️',
  '🦉',
  '🦔',
  '🐇',
  '🦡',
  '🐑',
  '🦢',
  '🕊️',
  '🐈‍⬛',
  '🐒',
] as const;

function roleIdToAnimalEmoji(roleId: string): string {
  let hash = 0;
  for (let i = 0; i < roleId.length; i++) {
    hash = (hash * 31 + roleId.charCodeAt(i)) | 0;
  }
  return HUNT_ANIMAL_EMOJIS[Math.abs(hash) % HUNT_ANIMAL_EMOJIS.length]!;
}

// ─── Extended props ─────────────────────────────────────────────────────
interface RoleHuntProps extends RoleRevealEffectProps {
  allRoles?: RoleData[];
}

// ─── Animal data ────────────────────────────────────────────────────────
interface AnimalData {
  id: number;
  role: RoleData;
  isTarget: boolean;
  startX: number;
  y: number;
  speed: number;
  scale: number;
  facingLeft: boolean;
  spawnTime: number;
  emoji: string;
}

// ─── Celebration particle ───────────────────────────────────────────────
interface CelebrationParticleConfig {
  id: number;
  targetX: number;
  targetY: number;
  emoji: string;
  duration: number;
}

const CelebrationParticle: React.FC<CelebrationParticleConfig> = React.memo(
  ({ targetX, targetY, emoji, duration }) => {
    const [fired, setFired] = useState(false);

    useEffect(() => {
      requestAnimationFrame(() => setFired(true));
    }, []);

    const style = {
      transform: [
        { translateX: fired ? targetX : 0 },
        { translateY: fired ? targetY : 0 },
        { scale: fired ? 0 : 1.2 },
        { rotate: fired ? '180deg' : '0deg' },
      ],
      opacity: fired ? 0 : 1,
      transitionProperty: 'opacity, transform',
      transitionDuration: `${duration}ms`,
      transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
    };

    return (
      <View style={[styles.celebrationParticle, style]}>
        <Text style={styles.celebrationEmoji}>{emoji}</Text>
      </View>
    );
  },
);
CelebrationParticle.displayName = 'CelebrationParticle';

// ─── Animated Animal ────────────────────────────────────────────────────
interface AnimatedAnimalProps {
  animal: AnimalData;
  screenWidth: number;
  state: 'alive' | 'hit-target' | 'hit-miss' | 'dead';
}

const AnimatedAnimal: React.FC<AnimatedAnimalProps> = React.memo(
  ({ animal, screenWidth, state }) => {
    const [xTarget, setXTarget] = useState(animal.startX);
    const [hitScale, setHitScale] = useState(1);
    const [hitOpacity, setHitOpacity] = useState(1);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const travelDistance = screenWidth + ANIMAL_SIZE * 4;
    const duration = (travelDistance / Math.abs(animal.speed)) * 1000;
    const endX = animal.speed > 0 ? screenWidth + ANIMAL_SIZE * 2 : -ANIMAL_SIZE * 2;

    useEffect(() => {
      requestAnimationFrame(() => setXTarget(endX));
      const timers = timersRef.current;
      return () => {
        timers.forEach(clearTimeout);
      };
    }, [endX]);

    useEffect(() => {
      if (state === 'hit-miss') {
        setHitScale(1.5);
        const t1 = setTimeout(() => setHitScale(0.3), 150);
        const t2 = setTimeout(() => setHitOpacity(0), 100);
        timersRef.current.push(t1, t2);
      } else if (state === 'hit-target') {
        setHitScale(1.8);
        const t1 = setTimeout(() => setHitScale(0), 200);
        const t2 = setTimeout(() => setHitOpacity(0), 150);
        timersRef.current.push(t1, t2);
      }
    }, [state]);

    if (state === 'dead') return null;

    // Outer: linear horizontal movement
    const movementStyle = {
      transform: [
        { translateX: xTarget - ANIMAL_SIZE / 2 },
        { translateY: animal.y - ANIMAL_SIZE / 2 },
      ],
      transitionProperty: 'transform',
      transitionDuration: `${duration}ms`,
      transitionTimingFunction: 'linear',
    };

    // Inner: scale/opacity for hit reactions
    const hitStyle = {
      transform: [{ scale: animal.scale * hitScale }, { scaleX: animal.facingLeft ? -1 : 1 }],
      opacity: hitOpacity,
      transitionProperty: 'opacity, transform',
      transitionDuration: '200ms',
      transitionTimingFunction: 'ease-out',
    };

    return (
      <View style={[styles.animalLabel, movementStyle]}>
        <View style={hitStyle}>
          <Text style={styles.animalEmoji}>{animal.emoji}</Text>
          <View style={[styles.animalNameBg, animal.facingLeft && { transform: [{ scaleX: -1 }] }]}>
            <Text style={styles.animalName}>{animal.role.name}</Text>
          </View>
        </View>
      </View>
    );
  },
);
AnimatedAnimal.displayName = 'AnimatedAnimal';

// ─── Animal generation ──────────────────────────────────────────────────
let animalIdCounter = 0;

function createAnimal(
  role: RoleData,
  targetRole: RoleData,
  screenWidth: number,
  screenHeight: number,
): AnimalData {
  const fromLeft = Math.random() > 0.5;
  const minY = screenHeight * GROUND_TOP_RATIO;
  const maxY = screenHeight * (1 - GROUND_BOTTOM_PADDING_RATIO);
  const y = minY + Math.random() * (maxY - minY);
  const speed = 40 + Math.random() * 60;

  return {
    id: animalIdCounter++,
    role,
    isTarget: role.id === targetRole.id,
    startX: fromLeft ? -ANIMAL_SIZE : screenWidth + ANIMAL_SIZE,
    y,
    speed: fromLeft ? speed : -speed,
    scale: 0.85 + Math.random() * 0.3,
    facingLeft: !fromLeft,
    spawnTime: Date.now(),
    emoji: roleIdToAnimalEmoji(role.id),
  };
}

function estimateAnimalX(animal: AnimalData, screenWidth: number, nowMs: number): number {
  const travelDistance = screenWidth + ANIMAL_SIZE * 4;
  const totalDuration = (travelDistance / Math.abs(animal.speed)) * 1000;
  const elapsed = nowMs - animal.spawnTime;
  const progress = Math.min(1, elapsed / totalDuration);
  const endX = animal.speed > 0 ? screenWidth + ANIMAL_SIZE * 2 : -ANIMAL_SIZE * 2;
  return animal.startX + (endX - animal.startX) * progress;
}

// ─── Main component ─────────────────────────────────────────────────────
export const RoleHunt: React.FC<RoleHuntProps> = ({
  role,
  onComplete,
  allRoles,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'role-hunt',
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const common = CONFIG.common;
  const config = CONFIG.roleHunt;

  const [phase, setPhase] = useState<'hunting' | 'capturing' | 'revealing' | 'revealed'>('hunting');
  const [animals, setAnimals] = useState<AnimalData[]>([]);
  const [animalStates, setAnimalStates] = useState<
    Record<number, 'alive' | 'hit-target' | 'hit-miss' | 'dead'>
  >({});
  const [celebrations, setCelebrations] = useState<CelebrationParticleConfig[]>([]);
  const [hitBurstPos, setHitBurstPos] = useState<{ x: number; y: number } | null>(null);

  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  const hitRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetSpawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  const animalsRef = useRef(animals);
  const animalStatesRef = useRef(animalStates);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    animalsRef.current = animals;
  }, [animals]);
  useEffect(() => {
    animalStatesRef.current = animalStates;
  }, [animalStates]);

  const spawnRoles = useMemo(() => {
    const roles = allRoles ?? [role];
    if (!roles.find((r) => r.id === role.id)) return [role, ...roles];
    return roles;
  }, [allRoles, role]);

  // ── Shared values ──
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [hitFlashOpacity, setHitFlashOpacity] = useState(0);
  const mainTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    mainTimersRef.current.push(id);
    return id;
  }, []);

  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // ── Animal spawning ──
  useEffect(() => {
    if (reducedMotion) return;

    const initialAnimals: AnimalData[] = [];
    initialAnimals.push(createAnimal(role, role, screenWidth, screenHeight));
    for (let i = 0; i < 3; i++) {
      const randomRole = spawnRoles[Math.floor(Math.random() * spawnRoles.length)]!;
      initialAnimals.push(createAnimal(randomRole, role, screenWidth, screenHeight));
    }
    setAnimals(initialAnimals);
    const initialStates: Record<number, 'alive'> = {};
    for (const a of initialAnimals) initialStates[a.id] = 'alive';
    setAnimalStates(initialStates);

    spawnTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'hunting') return;
      const randomRole = spawnRoles[Math.floor(Math.random() * spawnRoles.length)]!;
      const newAnimal = createAnimal(randomRole, role, screenWidth, screenHeight);
      setAnimals((prev) => [...prev, newAnimal]);
      setAnimalStates((prev) => ({ ...prev, [newAnimal.id]: 'alive' }));
    }, SPAWN_INTERVAL_MS);

    targetSpawnTimerRef.current = setInterval(() => {
      if (phaseRef.current !== 'hunting') return;
      const hasTarget = animalsRef.current.some(
        (a) => a.isTarget && (animalStatesRef.current[a.id] ?? 'alive') === 'alive',
      );
      if (!hasTarget) {
        const newTarget = createAnimal(role, role, screenWidth, screenHeight);
        setAnimals((prev) => [...prev, newTarget]);
        setAnimalStates((prev) => ({ ...prev, [newTarget.id]: 'alive' }));
      }
    }, TARGET_SPAWN_INTERVAL_MS);

    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Clean up
  useEffect(() => {
    return () => {
      if (hitRevealTimerRef.current) clearTimeout(hitRevealTimerRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);
    };
  }, []);

  const createCelebrations = useCallback(() => {
    const configs: CelebrationParticleConfig[] = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 60 + Math.random() * 180;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 20,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length]!,
        duration: 500 + Math.random() * 500,
      });
    }
    setCelebrations(configs);
  }, []);

  const startReveal = useCallback(() => {
    setPhase('revealing');
    createCelebrations();
    if (enableHaptics) void triggerHaptic('heavy', true);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (targetSpawnTimerRef.current) clearInterval(targetSpawnTimerRef.current);

    setCardOpacity(1);
    setCardScale(1);
    schedule(() => setPhase('revealed'), 400);
  }, [createCelebrations, enableHaptics, schedule]);

  // Auto-timeout
  const autoTimeoutWarning = useAutoTimeout(phase === 'hunting' && !reducedMotion, startReveal);

  // ── Shooting ──
  const handleShoot = useCallback(
    (sx: number, sy: number) => {
      if (phaseRef.current !== 'hunting') return;

      if (enableHaptics) void triggerHaptic('medium', true);

      // Subtle flash
      setHitFlashOpacity(0.3);
      schedule(() => setHitFlashOpacity(0), 50);

      // Hit detection
      const now = Date.now();
      let hitAnimal: AnimalData | null = null;
      let closestDist = HIT_RADIUS;

      for (const a of animalsRef.current) {
        const st = animalStatesRef.current[a.id];
        if (st !== 'alive' && st !== undefined) continue;
        const estimatedX = estimateAnimalX(a, screenWidth, now);
        const dx = estimatedX - sx;
        const dy = a.y - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          hitAnimal = a;
        }
      }

      if (hitAnimal) {
        const animal = hitAnimal;
        if (animal.isTarget) {
          setPhase('capturing');
          setAnimalStates((prev) => {
            const next = { ...prev };
            next[animal.id] = 'hit-target';
            for (const a of animalsRef.current) {
              if (a.id !== animal.id && (next[a.id] === 'alive' || !next[a.id])) {
                next[a.id] = 'hit-miss';
              }
            }
            return next;
          });
          if (enableHaptics) void triggerHaptic('success', true);

          setHitBurstPos({ x: sx, y: sy });

          setHitFlashOpacity(0.5);
          schedule(() => setHitFlashOpacity(0), 80);

          const timer = setTimeout(() => startReveal(), config.hitRevealDelay);
          hitRevealTimerRef.current = timer;
        } else {
          setAnimalStates((prev) => ({ ...prev, [animal.id]: 'hit-miss' }));
          if (enableHaptics) void triggerHaptic('light', true);
          setHitFlashOpacity(0.15);
          schedule(() => setHitFlashOpacity(0), 50);
        }
      }
    },
    [screenWidth, enableHaptics, config.hitRevealDelay, startReveal, schedule],
  );

  // ── Reduced motion: skip to reveal ──
  useEffect(() => {
    if (!reducedMotion) return;
    setCardOpacity(1);
    setCardScale(1);
    setPhase('revealed');
    fireComplete();
  }, [reducedMotion, fireComplete]);

  // ── Computed styles with CSS transitions ──
  const cardAnimStyle = {
    opacity: cardOpacity,
    transform: [{ scale: cardScale }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '400ms',
    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  const hitFlashStyle = {
    opacity: hitFlashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '50ms',
  };

  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      {/* Canvas layer: forest + fireflies + scope + burst */}
      {!reducedMotion && (
        <RoleHuntCanvas
          dom={{
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: screenHeight,
            },
          }}
          width={screenWidth}
          height={screenHeight}
          showScope={phase === 'hunting'}
          hitBurstPos={hitBurstPos}
          onShoot={handleShoot}
        />
      )}

      {/* Reduced motion fallback background */}
      {reducedMotion && (
        <LinearGradient
          colors={[SKY_COLORS.top, SKY_COLORS.mid2, SKY_COLORS.bottom]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      )}

      {/* Hit flash overlay */}
      <View style={[styles.flash, hitFlashStyle, { backgroundColor: HUNT_COLORS.hitFlash }]} />

      {/* Animals */}
      {!reducedMotion && (
        <View style={styles.absoluteFillNoEvents}>
          {animals.map((animal) => (
            <AnimatedAnimal
              key={animal.id}
              animal={animal}
              screenWidth={screenWidth}
              state={animalStates[animal.id] ?? 'alive'}
            />
          ))}
        </View>
      )}

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'hunting' && !reducedMotion ? '🔫 移动瞄准，抬手射击 — 找到你的角色！' : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Celebrations */}
      {celebrations.length > 0 && (
        <View style={styles.celebrationContainer}>
          {celebrations.map((p) => (
            <CelebrationParticle key={p.id} {...p} />
          ))}
        </View>
      )}

      {/* Revealed card */}
      {(phase === 'revealing' || phase === 'revealed') && (
        <View style={styles.cardContainer}>
          <View style={[styles.cardInner, { width: cardWidth, height: cardHeight }, cardAnimStyle]}>
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
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  absoluteFillNoEvents: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0b1a2d',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    pointerEvents: 'none',
  },
  animalLabel: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
    pointerEvents: 'none',
  },
  animalEmoji: {
    fontSize: 44,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.5)', 0, 2, 4),
  },
  animalNameBg: {
    backgroundColor: HUNT_COLORS.animalNameBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  animalName: {
    fontSize: 12,
    fontWeight: '600',
    color: HUNT_COLORS.animalName,
  },
  celebrationContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 15,
  },
  celebrationParticle: {
    position: 'absolute',
  },
  celebrationEmoji: {
    fontSize: 26,
  },
  cardContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  cardInner: {
    overflow: 'visible',
  },
});
