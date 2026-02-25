/**
 * RoleHunt - 角色猎场揭示动画（Reanimated 4）
 *
 * 动画流程：多个角色幽灵排列在屏幕上（Flexbox 网格） → 玩家逐个点击捕获 →
 * 未命中的幽灵消散（烟雾效果）→ 命中目标角色时全屏庆祝 → 揭示角色卡。
 *
 * 使用 `allRoles` 生成幽灵列表（去重+补充），玩家的真实角色隐藏其中。
 * Flexbox 保证幽灵永远在可视区内，`transform` 仅用于小幅漂浮效果。
 * `useSharedValue` + `withTiming`/`withSequence` 驱动，
 * 阶段切换通过 `runOnJS` 回调，无 `setTimeout`。
 * 渲染动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleEmoji, isValidRoleId } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleData, RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, useColors } from '@/theme';

// ─── Visual constants ──────────────────────────────────────────────────
const HUNT_COLORS = {
  /** Fog overlay */
  fog: 'rgba(30, 30, 50, 0.85)',
  /** Ghost trail */
  ghostGlow: 'rgba(180, 200, 255, 0.3)',
  /** Miss flash */
  missFlash: 'rgba(255, 100, 100, 0.4)',
  /** Hit flash */
  hitFlash: 'rgba(100, 255, 150, 0.6)',
  /** Hint text */
  hintText: 'rgba(200, 210, 240, 0.7)',
  /** Ghost name text */
  ghostName: '#E8ECFF',
};

// ─── Extended props ─────────────────────────────────────────────────────
interface RoleHuntProps extends RoleRevealEffectProps {
  /** All roles in the game (used to create ghost targets) */
  allRoles?: RoleData[];
}

// ─── Ghost data ─────────────────────────────────────────────────────────
interface GhostData {
  id: number;
  role: RoleData;
  isTarget: boolean;
  /** Drift amplitude X (small float effect only) */
  driftX: number;
  /** Drift amplitude Y (small float effect only) */
  driftY: number;
  /** Drift cycle duration */
  driftDuration: number;
  /** Random static offset X within cell (px) */
  offsetX: number;
  /** Random static offset Y within cell (px) */
  offsetY: number;
}

// ─── Self-animating ghost (Flexbox positioned, transform = drift only) ──
interface AnimatedGhostProps {
  ghost: GhostData;
  onCapture: (id: number) => void;
  state: 'floating' | 'captured-miss' | 'captured-hit' | 'hidden';
  enableHaptics: boolean;
}

const AnimatedGhost: React.FC<AnimatedGhostProps> = React.memo(
  ({ ghost, onCapture, state, enableHaptics }) => {
    const driftProgress = useSharedValue(0);
    const fadeOut = useSharedValue(1);
    const captureScale = useSharedValue(1);
    const bobProgress = useSharedValue(0);

    const emoji = isValidRoleId(ghost.role.id) ? getRoleEmoji(ghost.role.id) : '👻';

    // Start floating animation — each ghost has unique driftDuration for natural desync
    useEffect(() => {
      driftProgress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: ghost.driftDuration,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: ghost.driftDuration,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1, // infinite
        false,
      );

      bobProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 + ghost.id * 100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500 + ghost.id * 100, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }, [driftProgress, bobProgress, ghost.driftDuration, ghost.id]);

    // Handle capture animation
    useEffect(() => {
      if (state === 'captured-miss') {
        captureScale.value = withTiming(1.3, { duration: 150 });
        fadeOut.value = withDelay(
          100,
          withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }),
        );
      } else if (state === 'captured-hit') {
        captureScale.value = withSequence(
          withTiming(1.5, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }),
        );
      }
    }, [state, captureScale, fadeOut]);

    // Transform = static random offset + drift (Flexbox handles base positioning)
    const animStyle = useAnimatedStyle(() => ({
      transform: [
        {
          translateX:
            ghost.offsetX + interpolate(driftProgress.value, [0, 1], [-ghost.driftX, ghost.driftX]),
        },
        {
          translateY:
            ghost.offsetY +
            interpolate(driftProgress.value, [0, 1], [-ghost.driftY, ghost.driftY]) +
            interpolate(bobProgress.value, [0, 1], [0, -8]),
        },
        { scale: captureScale.value },
      ],
      opacity: fadeOut.value,
    }));

    if (state === 'hidden') return null;

    const handlePress = () => {
      if (state !== 'floating') return;
      if (enableHaptics) triggerHaptic('medium', true);
      onCapture(ghost.id);
    };

    return (
      <View style={styles.ghostCell}>
        <Animated.View style={animStyle}>
          <Pressable onPress={handlePress} style={styles.ghostTouchable}>
            <View style={styles.ghostBody}>
              <Text style={styles.ghostEmoji}>{emoji}</Text>
              <Text style={styles.ghostName}>{ghost.role.name}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    );
  },
);
AnimatedGhost.displayName = 'AnimatedGhost';

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
    const progress = useSharedValue(0);

    useEffect(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, [duration, progress]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: progress.value * targetX },
        { translateY: progress.value * targetY },
        { scale: interpolate(progress.value, [0, 0.2, 0.4, 1], [0, 1.2, 1, 0]) },
      ],
      opacity: interpolate(progress.value, [0, 0.6, 1], [1, 0.6, 0]),
    }));

    return (
      <Animated.View style={[styles.celebrationParticle, animStyle]}>
        <Text style={styles.celebrationEmoji}>{emoji}</Text>
      </Animated.View>
    );
  },
);
CelebrationParticle.displayName = 'CelebrationParticle';

// ─── Ghost generation helper ────────────────────────────────────────────
function generateGhosts(targetRole: RoleData, allRoles: RoleData[]): GhostData[] {
  // Deduplicate by role ID, keep a selection of ~5–7 ghosts
  const uniqueMap = new Map<string, RoleData>();
  for (const r of allRoles) {
    uniqueMap.set(r.id, r);
  }
  // Ensure target is included
  uniqueMap.set(targetRole.id, targetRole);

  const unique = Array.from(uniqueMap.values());

  // Shuffle using Fisher-Yates
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  // Take max 7 ghosts (including target)
  const maxGhosts = 7;
  let selected: RoleData[];
  if (unique.length <= maxGhosts) {
    selected = unique;
  } else {
    // Ensure target is included
    const withoutTarget = unique.filter((r) => r.id !== targetRole.id);
    selected = [targetRole, ...withoutTarget.slice(0, maxGhosts - 1)];
    // Re-shuffle
    for (let i = selected.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }
  }

  return selected.map((role, index) => ({
    id: index,
    role,
    isTarget: role.id === targetRole.id,
    driftX: 6 + Math.random() * 10,
    driftY: 4 + Math.random() * 8,
    driftDuration: 2000 + Math.random() * 1500,
    offsetX: (Math.random() - 0.5) * 30,
    offsetY: (Math.random() - 0.5) * 24,
  }));
}

const CELEBRATION_EMOJIS = ['⭐', '✨', '🎉', '🎊', '💫', '🌟', '🏆'];

// ─── Main component ─────────────────────────────────────────────────────
export const RoleHunt: React.FC<RoleHuntProps> = ({
  role,
  onComplete,
  allRoles,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'role-hunt',
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), [colors]);
  const theme = alignmentThemes[role.alignment];
  const common = CONFIG.common;
  const config = CONFIG.roleHunt;

  const [phase, setPhase] = useState<'hunting' | 'capturing' | 'revealing' | 'revealed'>('hunting');
  const [ghostStates, setGhostStates] = useState<
    Record<number, 'floating' | 'captured-miss' | 'captured-hit' | 'hidden'>
  >({});
  const [celebrations, setCelebrations] = useState<CelebrationParticleConfig[]>([]);
  const onCompleteCalledRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate ghosts once at mount
  const ghosts = useRef(generateGhosts(role, allRoles ?? [role])).current;

  // Initialize ghost states
  useEffect(() => {
    const initial: Record<number, 'floating'> = {};
    for (const g of ghosts) {
      initial[g.id] = 'floating';
    }
    setGhostStates(initial);
  }, [ghosts]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
    };
  }, []);

  // Card reveal animation values
  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const fogOpacity = useSharedValue(1);
  const hintOpacity = useSharedValue(1);

  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  // Auto-select: if user doesn't find the target in time, auto-capture it
  useEffect(() => {
    if (reducedMotion) return;
    autoSelectTimerRef.current = setTimeout(() => {
      if (phase !== 'hunting') return;
      const target = ghosts.find((g) => g.isTarget);
      if (target) {
        handleCapture(target.id);
      }
    }, config.autoSelectTimeout);

    return () => {
      if (autoSelectTimerRef.current) clearTimeout(autoSelectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Hint text fade
  useEffect(() => {
    if (reducedMotion) return;
    hintOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [hintOpacity, reducedMotion]);

  const createCelebrations = useCallback(() => {
    const configs: CelebrationParticleConfig[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 80 + Math.random() * 140;
      configs.push({
        id: i,
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance - 20,
        emoji: CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length],
        duration: 500 + Math.random() * 400,
      });
    }
    setCelebrations(configs);
  }, []);

  const startReveal = useCallback(() => {
    setPhase('revealing');
    createCelebrations();
    if (enableHaptics) triggerHaptic('heavy', true);

    // Fade fog down
    fogOpacity.value = withTiming(0.3, { duration: 400 });

    // Card entrance
    cardOpacity.value = withTiming(1, { duration: 300 });
    cardScale.value = withTiming(
      1,
      { duration: 400, easing: Easing.out(Easing.back(1.5)) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(setPhase)('revealed');
      },
    );
  }, [cardScale, cardOpacity, fogOpacity, createCelebrations, enableHaptics]);

  const handleCapture = useCallback(
    (ghostId: number) => {
      const ghost = ghosts.find((g) => g.id === ghostId);
      if (!ghost) return;

      if (ghost.isTarget) {
        // Hit! Mark captured and start reveal
        setGhostStates((prev) => {
          const next = { ...prev };
          // Mark all remaining floating as hidden
          for (const g of ghosts) {
            if (g.id === ghostId) {
              next[g.id] = 'captured-hit';
            } else if (next[g.id] === 'floating') {
              next[g.id] = 'captured-miss';
            }
          }
          return next;
        });
        if (enableHaptics) triggerHaptic('success', true);

        // Delay reveal to let hit animation play
        const timer = setTimeout(() => startReveal(), config.hitRevealDelay);
        holdTimerRef.current = timer;
      } else {
        // Miss — dissolve this ghost
        setGhostStates((prev) => ({ ...prev, [ghostId]: 'captured-miss' }));
        if (enableHaptics) triggerHaptic('light', true);
      }
    },
    [ghosts, startReveal, enableHaptics, config.hitRevealDelay],
  );

  // Glow border done → onComplete
  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    holdTimerRef.current = setTimeout(() => onComplete(), config.revealHoldDuration);
  }, [onComplete, config.revealHoldDuration]);

  // Reduced motion: skip straight to reveal
  useEffect(() => {
    if (!reducedMotion) return;
    cardOpacity.value = 1;
    cardScale.value = 1;
    fogOpacity.value = 0;
    setPhase('revealed');
    holdTimerRef.current = setTimeout(() => {
      if (onCompleteCalledRef.current) return;
      onCompleteCalledRef.current = true;
      onComplete();
    }, config.revealHoldDuration);
  }, [reducedMotion, cardOpacity, cardScale, fogOpacity, onComplete, config.revealHoldDuration]);

  // ── Animated styles ──
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const fogStyle = useAnimatedStyle(() => ({
    opacity: fogOpacity.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      {/* Fog background */}
      <Animated.View style={[styles.fogOverlay, fogStyle]} />

      {/* Hint text */}
      {phase === 'hunting' && !reducedMotion && (
        <Animated.View style={[styles.hintContainer, hintStyle]}>
          <Text style={styles.hintText}>👻 找到你的角色！</Text>
        </Animated.View>
      )}

      {/* Ghosts — Flexbox grid, never overflows */}
      {!reducedMotion && (
        <View style={styles.ghostGrid}>
          {ghosts.map((ghost) => (
            <AnimatedGhost
              key={ghost.id}
              ghost={ghost}
              onCapture={handleCapture}
              state={ghostStates[ghost.id] ?? 'floating'}
              enableHaptics={enableHaptics}
            />
          ))}
        </View>
      )}

      {/* Celebration particles */}
      {celebrations.length > 0 && (
        <View style={styles.celebrationContainer}>
          {celebrations.map((p) => (
            <CelebrationParticle key={p.id} {...p} />
          ))}
        </View>
      )}

      {/* Revealed card */}
      {(phase === 'revealing' || phase === 'revealed') && (
        <Animated.View
          style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, cardAnimStyle]}
        >
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />

          {phase === 'revealed' && (
            <GlowBorder
              width={cardWidth + common.glowPadding}
              height={cardHeight + common.glowPadding}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={common.glowBorderWidth}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={common.glowFlashCount}
              flashDuration={common.glowFlashDuration}
              onComplete={handleGlowComplete}
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HUNT_COLORS.fog,
  },
  hintContainer: {
    position: 'absolute',
    top: '8%',
    alignSelf: 'center',
    zIndex: 10,
  },
  hintText: {
    fontSize: 20,
    fontWeight: '600',
    color: HUNT_COLORS.hintText,
    textAlign: 'center',
  },
  ghostGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignContent: 'center',
    paddingHorizontal: 12,
    paddingTop: '15%',
    paddingBottom: '10%',
    zIndex: 5,
  },
  ghostCell: {
    width: '33%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  ghostTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ghostBody: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  ghostEmoji: {
    fontSize: 36,
  },
  ghostName: {
    fontSize: 13,
    fontWeight: '500',
    color: HUNT_COLORS.ghostName,
    marginTop: 4,
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
    fontSize: 24,
  },
  cardContainer: {
    zIndex: 20,
    overflow: 'visible',
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
});
