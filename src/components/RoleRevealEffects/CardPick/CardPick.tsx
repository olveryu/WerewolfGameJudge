/**
 * CardPick - 桌面抽牌揭示效果（Reanimated 4 + Canvas 2D）
 *
 * 动画流程：木质画框 + 散落筹码的桌面 → 面朝下的牌平铺（网格排列）→
 * 玩家点选一张 → 其余牌暗化消失 → 金色粒子拖尾飞向中央 →
 * 充能光环脉冲 → 翻转（侧光条扫过） → 揭示角色。
 *
 * `remainingCards` 决定桌面上展示多少张牌（= 总人数 - 已查看人数），
 * 让后查看的玩家看到更少的牌，营造"越来越少"的紧张感。
 * 渲染抽牌动画与触觉反馈。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { borderRadius, colors } from '@/theme';

import CardPickOverlayCanvas from './CardPickOverlayCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const TABLE_COLORS = {
  /** 桌面 — 暖色亚麻 */
  felt: ['#e6dfd5', '#f0ebe3', '#e6dfd5'] as const,
  /** 牌背 — 象牙白 */
  cardBack: ['#f5f1eb', '#faf7f2', '#f5f1eb'] as const,
  /** 牌背装饰 — 青铜 */
  accent: '#8b7355',
  accentLight: '#b8a080',
  /** 牌背中央符号 */
  symbol: '♠',
  /** Wood frame */
  woodDark: '#5a3a1e',
  woodLight: '#8b6914',
};

// ─── Extended props ─────────────────────────────────────────────────────
interface CardPickProps extends RoleRevealEffectProps {
  /** Number of remaining (unviewed) cards to display on the table */
  remainingCards?: number;
}

// ─── Mini card back face (memoized) ─────────────────────────────────────
const MiniCardBack: React.FC<{ width: number; height: number }> = React.memo(
  ({ width, height }) => (
    <View style={[styles.miniCardBack, { width, height }]}>
      <LinearGradient
        colors={[...TABLE_COLORS.cardBack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.miniCardInner}>
          <View style={[styles.miniCardBorder, { borderColor: TABLE_COLORS.accentLight }]}>
            <Text style={styles.miniCardSymbol}>{TABLE_COLORS.symbol}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  ),
);
MiniCardBack.displayName = 'MiniCardBack';

// ─── Main component ─────────────────────────────────────────────────────
export const CardPick: React.FC<CardPickProps> = ({
  role,
  onComplete,
  remainingCards = 12,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'card-pick',
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.cardPick;
  const common = CONFIG.common;

  const [phase, setPhase] = useState<'spreading' | 'waiting' | 'picking' | 'flipping' | 'revealed'>(
    'spreading',
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  // ── Lock initial card count at mount (grid layout never re-flows) ──
  const initialCardCountRef = useRef(Math.max(1, Math.min(remainingCards, 16)));
  const initialCardCount = initialCardCountRef.current;

  // Track cards removed by other players viewing their roles in real-time
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set());
  const prevRemainingRef = useRef(remainingCards);
  const aliveCount = initialCardCount - removedIndices.size;

  // ── Card layout calculation (based on locked initial count) ──
  const cols = Math.min(config.maxColumns, initialCardCount);
  const rows = Math.ceil(initialCardCount / cols);
  const miniCardWidth = Math.min(
    screenWidth * config.miniCardWidthRatio,
    (screenWidth - config.cardGap * (cols + 1)) / cols,
  );
  const miniCardHeight = miniCardWidth * config.miniCardAspectRatio;
  const revealCardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const revealCardHeight = revealCardWidth * common.cardAspectRatio;

  // Grid positions for each card (locked to initial count)
  const gridPositions = useMemo(() => {
    const totalGridWidth = cols * miniCardWidth + (cols - 1) * config.cardGap;
    const totalGridHeight = rows * miniCardHeight + (rows - 1) * config.cardGap;
    const startX = -totalGridWidth / 2 + miniCardWidth / 2;
    const startY = -totalGridHeight / 2 + miniCardHeight / 2;

    return Array.from({ length: initialCardCount }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        x: startX + col * (miniCardWidth + config.cardGap),
        y: startY + row * (miniCardHeight + config.cardGap),
      };
    });
  }, [initialCardCount, cols, rows, miniCardWidth, miniCardHeight, config.cardGap]);

  // ── Shared values ──
  const [spreadStarted, setSpreadStarted] = useState(false);
  const [otherCardsOpacity, setOtherCardsOpacity] = useState(1);
  const [drawnCardX, setDrawnCardX] = useState(0);
  const [drawnCardY, setDrawnCardY] = useState(0);
  const [drawnCardOpacity, setDrawnCardOpacity] = useState(0);
  const [flipProgress, setFlipProgress] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // Canvas overlay phase (chips + charge aura + light bars)
  const [canvasPhase, setCanvasPhase] = useState<'idle' | 'charging' | 'flipping' | 'done'>('idle');

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    setCanvasPhase('done');
    if (enableHaptics) void triggerHaptic('heavy', true);
  }, [enableHaptics]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    setCanvasPhase('flipping');
    if (enableHaptics) void triggerHaptic('medium', true);

    setFlipProgress(1);
    schedule(enterRevealed, config.flipDuration);
  }, [config.flipDuration, enableHaptics, enterRevealed, schedule]);

  const startFlipAfterDelay = useCallback(() => {
    // Show charge aura pulse before flip
    setCanvasPhase('charging');
    schedule(startFlipping, 200);
  }, [startFlipping, schedule]);

  const handleCardSelect = useCallback(
    (index: number) => {
      if (phase !== 'waiting') return;
      setSelectedIndex(index);
      setPhase('picking');
      if (enableHaptics) void triggerHaptic('medium', true);

      const pos = gridPositions[index]!;
      // Set initial position to the card's grid position
      setDrawnCardX(pos.x);
      setDrawnCardY(pos.y);
      setDrawnCardOpacity(1);

      // Fade out other cards
      setOtherCardsOpacity(0);

      // Fly to center (CSS transition handles the movement)
      // Use a microtask to ensure initial position is rendered first
      requestAnimationFrame(() => {
        setDrawnCardX(0);
        setDrawnCardY(0);
      });

      schedule(startFlipAfterDelay, config.flyToCenterDuration);
    },
    [
      phase,
      gridPositions,
      config.flyToCenterDuration,
      enableHaptics,
      startFlipAfterDelay,
      schedule,
    ],
  );

  // ── React to other players viewing roles: remove random cards ──
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'spreading') return;

    const diff = prevRemainingRef.current - remainingCards;
    if (diff <= 0) return;
    prevRemainingRef.current = remainingCards;

    setRemovedIndices((prev) => {
      const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
        (i) => !prev.has(i),
      );
      // Keep at least 1 card alive for the player to pick
      const maxRemovable = Math.max(0, aliveIndices.length - 1);
      const toRemove = Math.min(diff, maxRemovable);
      const shuffled = [...aliveIndices].sort(() => Math.random() - 0.5);
      const next = new Set(prev);
      for (let i = 0; i < toRemove; i++) {
        next.add(shuffled[i]!);
      }
      return next;
    });

    if (enableHaptics) void triggerHaptic('light', true);
  }, [remainingCards, phase, initialCardCount, enableHaptics]);

  // ── Kick-off: spread cards onto table ──
  useEffect(() => {
    if (reducedMotion) {
      setFlipProgress(1);
      setSpreadStarted(true);
      setOtherCardsOpacity(0);
      setDrawnCardOpacity(1);
      setPhase('revealed');
      fireComplete();
      return;
    }

    setSpreadStarted(true);
    schedule(() => setPhase('waiting'), config.spreadDuration);

    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion, fireComplete, config.spreadDuration, schedule]);

  // ── Auto-select after timeout if user doesn't tap ──
  const autoSelectRandom = useCallback(() => {
    const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
      (i) => !removedIndices.has(i),
    );
    if (aliveIndices.length === 0) return;
    const randomIndex = aliveIndices[Math.floor(Math.random() * aliveIndices.length)]!;
    handleCardSelect(randomIndex);
  }, [initialCardCount, removedIndices, handleCardSelect]);
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'waiting' && !reducedMotion,
    autoSelectRandom,
  );

  // ── Computed styles for drawn card (fly-to-center + flip) ──
  const drawnCardStyle = {
    opacity: drawnCardOpacity,
    transform: [
      { translateX: drawnCardX },
      { translateY: drawnCardY },
      { perspective: 1200 },
      { rotateY: `${flipProgress * 180}deg` },
    ],
    transitionProperty: 'opacity, transform',
    transitionDuration: `${config.flyToCenterDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  } as never;

  const backOpacityStyle = {
    opacity: flipProgress < 0.5 ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: '50ms',
  } as never;

  const frontOpacityStyle = {
    opacity: flipProgress >= 0.5 ? 1 : 0,
    transform: [{ scaleX: -1 }],
    transitionProperty: 'opacity',
    transitionDuration: '50ms',
  } as never;

  // ── Render ──
  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />
      {/* Table felt background */}
      <LinearGradient
        colors={[...TABLE_COLORS.felt]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Wood frame border */}
      <View style={styles.woodFrame}>
        <View style={styles.woodFrameInner} />
      </View>

      {/* Skia scene layer: chips, trail, charge aura, light bars */}
      {!reducedMotion && (
        <View style={styles.fullScreen}>
          <CardPickOverlayCanvas
            dom={{ style: { flex: 1 } }}
            width={screenWidth}
            height={screenHeight}
            phase={canvasPhase}
          />
        </View>
      )}

      {/* Prompt text with dealer hand */}
      <HintWithWarning
        hintText={
          phase === 'spreading' || phase === 'waiting'
            ? aliveCount === 1
              ? '🤚 最后一张，点击翻开'
              : `🤚 还剩 ${aliveCount} 张，点选一张`
            : null
        }
        showWarning={autoTimeoutWarning}
        hintTextStyle={styles.hintAccent}
      />

      {/* Card grid — all face-down mini cards */}
      {(phase === 'spreading' || phase === 'waiting' || phase === 'picking') && (
        <View
          testID={`${testIDPrefix}-grid`}
          style={[styles.gridCenter, { width: screenWidth, height: screenHeight }]}
        >
          {gridPositions.map((pos, index) => {
            const isSelected = selectedIndex === index;
            // Don't render selected card here during picking — it's rendered separately
            if (isSelected && phase === 'picking') return null;

            return (
              <AnimatedMiniCard
                key={`card-${pos.x}-${pos.y}`}
                index={index}
                x={pos.x}
                y={pos.y}
                width={miniCardWidth}
                height={miniCardHeight}
                visible={spreadStarted}
                otherCardsOpacity={otherCardsOpacity}
                isSelected={isSelected}
                removed={removedIndices.has(index)}
                staggerDelay={index * config.spreadStagger}
                spreadDuration={config.spreadDuration}
                onPress={handleCardSelect}
                disabled={phase !== 'waiting' || removedIndices.has(index)}
                testIDPrefix={testIDPrefix}
              />
            );
          })}
        </View>
      )}

      {/* Drawn card (fly to center → flip) — only mount after selection */}
      {selectedIndex !== null && (
        <View
          testID={`${testIDPrefix}-drawn-card`}
          style={[
            styles.drawnCard,
            { width: revealCardWidth, height: revealCardHeight },
            drawnCardStyle,
          ]}
        >
          {/* Card back */}
          <View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
            <MiniCardBack width={revealCardWidth} height={revealCardHeight} />
          </View>

          {/* Card front */}
          <View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
            <RoleCardContent
              roleId={role.id as RoleId}
              width={revealCardWidth}
              height={revealCardHeight}
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />

            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={revealCardWidth}
                cardHeight={revealCardHeight}
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

// ─── Animated mini card on the table ────────────────────────────────────
interface AnimatedMiniCardProps {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  otherCardsOpacity: number;
  isSelected: boolean;
  /** Whether this card was removed by another player viewing their role */
  removed: boolean;
  staggerDelay: number;
  spreadDuration: number;
  onPress: (index: number) => void;
  disabled: boolean;
  testIDPrefix: string;
}

const AnimatedMiniCard: React.FC<AnimatedMiniCardProps> = React.memo(
  ({
    index,
    x,
    y,
    width,
    height,
    visible,
    otherCardsOpacity,
    isSelected,
    removed,
    staggerDelay,
    spreadDuration,
    onPress,
    disabled,
    testIDPrefix,
  }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    const cfg = CONFIG.cardPick;

    const alive = removed ? 0 : 1;
    const shown = visible ? 1 : 0;
    const opacity = (isSelected ? 1 : otherCardsOpacity) * shown * alive;
    const scale = (visible ? 1 : 0.3) * (0.6 + 0.4 * alive);
    const rotateZ = (1 - alive) * 8;

    const animStyle = {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }, { rotateZ: `${rotateZ}deg` }],
      transitionProperty: 'opacity, transform',
      transitionDuration: `${removed ? cfg.cardRemoveExitDuration : spreadDuration}ms`,
      transitionDelay: `${visible && !removed ? staggerDelay : 0}ms`,
      transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
    } as never;

    return (
      <View
        testID={`${testIDPrefix}-card-${index}`}
        style={[styles.miniCardWrapper, { width, height }, animStyle]}
      >
        <Pressable
          onPress={handlePress}
          disabled={disabled}
          style={styles.pressableFill}
          accessibilityRole="button"
          accessibilityLabel={`牌 ${index + 1}`}
        >
          <MiniCardBack width={width} height={height} />
        </Pressable>
      </View>
    );
  },
);
AnimatedMiniCard.displayName = 'AnimatedMiniCard';

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  woodFrame: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 4,
    borderColor: TABLE_COLORS.woodDark,
    borderRadius: borderRadius.medium,
    pointerEvents: 'none',
  },
  woodFrameInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: TABLE_COLORS.woodLight,
    borderRadius: borderRadius.small,
    margin: 3,
  },
  gridCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardWrapper: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.12)',
  },
  miniCardBack: {
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  miniCardInner: {
    flex: 1,
    padding: 5,
  },
  miniCardBorder: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCardSymbol: {
    fontSize: 22,
    color: TABLE_COLORS.accent,
    opacity: 0.6,
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.15)',
    overflow: 'visible',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.medium,
    overflow: 'visible',
    backfaceVisibility: 'hidden',
  },
  cardBackZ: {
    zIndex: 2,
  },
  cardFrontZ: {
    zIndex: 1,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  pressableFill: {
    flex: 1,
  },
  hintAccent: {
    color: TABLE_COLORS.accent,
    letterSpacing: 1,
  },
});
