/**
 * TarotDraw - 塔罗牌占卜揭示效果（Canvas 2D + Reanimated 4）
 *
 * 动画流程：星空+水晶球+蜡烛的占卜场景 → 牌从桌面转盘旋转 →
 * 玩家点选 → 金色光丝拖尾飞向中央 → 六角魔法阵浮现 → 翻转揭示 → 命运之语。
 * 使用 `useSharedValue` 驱动所有动画，Canvas DOM Component 负责场景渲染。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

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
import { borderRadius, colors, crossPlatformTextShadow } from '@/theme';

import { CardBackView } from './CardBackView';
import TarotSceneCanvas from './TarotSceneCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const TAROT_COLORS = {
  gold: '#d4af37',
  goldGlow: '#ffd700',
  velvetFringe: '#c9a84c',
};

// ─── Fortune quotes per alignment ──────────────────────────────────────
const FORTUNE_QUOTES: Record<string, string> = {
  wolf: '暗月低语，獠牙已露…',
  god: '圣光降临，命运已定…',
  villager: '晨曦微暖，守护前行…',
  third: '迷雾深处，命运未知…',
};

interface WheelCard {
  id: number;
  angle: number;
}

// ─── Main component ─────────────────────────────────────────────────────
export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];
  const config = CONFIG.tarot ?? { flipDuration: 800, revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<'waiting' | 'drawing' | 'flipping' | 'revealed'>('waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [flipStartTime, setFlipStartTime] = useState(0);
  const [drawStartTime, setDrawStartTime] = useState(0);
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: config.revealHoldDuration,
  });

  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;
  const wheelRadius = Math.min(screenWidth * 0.32, 130);
  const mcRadius = cardWidth * 0.55;

  const wheelCards: WheelCard[] = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count,
    }));
  }, []);

  // ── Shared values ──
  const wheelRotation = useSharedValue(0);
  const wheelOpacity = useSharedValue(1);
  const wheelScale = useSharedValue(1);
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(-wheelRadius);
  const drawnCardScale = useSharedValue(1);
  const drawnCardOpacity = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const fortuneOpacity = useSharedValue(0);
  const velvetOpacity = useSharedValue(0);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) void triggerHaptic('heavy', true);
    fortuneOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
  }, [enableHaptics, fortuneOpacity]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    setFlipStartTime(performance.now());
    if (enableHaptics) void triggerHaptic('medium', true);

    flipProgress.value = withTiming(
      1,
      { duration: config.flipDuration ?? 800, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(enterRevealed);
      },
    );
  }, [flipProgress, config.flipDuration, enableHaptics, enterRevealed]);

  const beginFlipAfterDelay = useCallback(() => {
    drawnCardScale.value = withDelay(300, withTiming(1, { duration: 1 }));
    flipProgress.value = withDelay(
      300,
      withTiming(0, { duration: 1 }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(startFlipping);
      }),
    );
  }, [drawnCardScale, flipProgress, startFlipping]);

  const startDrawing = useCallback(() => {
    setPhase('drawing');
    setDrawStartTime(performance.now());
    if (enableHaptics) void triggerHaptic('medium', true);

    drawnCardOpacity.value = 1;

    // Fade out wheel
    wheelScale.value = withTiming(0.5, { duration: 400 });
    wheelOpacity.value = withTiming(0, { duration: 400 });

    // Move drawn card to center
    drawnCardX.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    drawnCardY.value = withTiming(
      0,
      { duration: 500, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) scheduleOnRN(beginFlipAfterDelay);
      },
    );
  }, [
    drawnCardX,
    drawnCardY,
    drawnCardOpacity,
    wheelScale,
    wheelOpacity,
    enableHaptics,
    beginFlipAfterDelay,
  ]);

  const handleCardSelect = useCallback(
    (cardIndex: number) => {
      if (phase !== 'waiting') return;
      setSelectedCardIndex(cardIndex);
      cancelAnimation(wheelRotation);
      if (enableHaptics) void triggerHaptic('medium', true);

      // Calculate selected card position in wheel
      const currentRotation = wheelRotation.value;
      const cardAngle = wheelCards[cardIndex]!.angle;
      const totalAngle = currentRotation * Math.PI * 2 + cardAngle - Math.PI / 2;
      const x = Math.cos(totalAngle) * wheelRadius;
      const y = Math.sin(totalAngle) * wheelRadius;

      drawnCardX.value = x;
      drawnCardY.value = y;

      startDrawing();
    },
    [
      phase,
      wheelCards,
      wheelRadius,
      wheelRotation,
      drawnCardX,
      drawnCardY,
      enableHaptics,
      startDrawing,
    ],
  );

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      flipProgress.value = 1;
      wheelOpacity.value = 0;
      drawnCardOpacity.value = 1;
      drawnCardScale.value = 1;
      setPhase('revealed');
      fireComplete();
      return;
    }

    // Slow spin: 4 seconds per revolution
    wheelRotation.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
    // Velvet table fades in
    velvetOpacity.value = withTiming(1, { duration: 800 });
  }, [
    reducedMotion,
    flipProgress,
    wheelOpacity,
    drawnCardOpacity,
    drawnCardScale,
    wheelRotation,
    velvetOpacity,
    fireComplete,
  ]);

  // ── Auto-select if user doesn't tap (unified 8s timeout) ──
  const autoSelectRandom = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * wheelCards.length);
    handleCardSelect(randomIndex);
  }, [wheelCards.length, handleCardSelect]);
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'waiting' && !reducedMotion,
    autoSelectRandom,
  );

  // ── Animated styles ──
  const wheelStyle = useAnimatedStyle(() => ({
    opacity: wheelOpacity.value,
    transform: [{ scale: wheelScale.value }, { rotate: `${wheelRotation.value * 360}deg` }],
  }));

  const drawnCardStyle = useAnimatedStyle(() => ({
    opacity: drawnCardOpacity.value,
    transform: [
      { translateX: drawnCardX.value },
      { translateY: drawnCardY.value },
      { scale: drawnCardScale.value },
      { perspective: 1200 },
      {
        rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  const backOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value < 0.5 ? 1 : 0,
  }));

  const frontOpacityStyle = useAnimatedStyle(() => ({
    opacity: flipProgress.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: -1 }],
  }));

  const velvetStyle = useAnimatedStyle(() => ({
    opacity: velvetOpacity.value,
  }));

  const fortuneStyle = useAnimatedStyle(() => ({
    opacity: fortuneOpacity.value,
  }));

  // Canvas scene phase
  const scenePhase = reducedMotion ? 'hidden' : phase;

  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Canvas scene layer (stars, crystal ball, candles, magic circle, trail) */}
      {!reducedMotion && (
        <TarotSceneCanvas
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
          phase={scenePhase}
          flipStartTime={flipStartTime}
          drawStartTime={drawStartTime}
          magicCircleCx={screenWidth / 2}
          magicCircleCy={screenHeight / 2}
          magicCircleRadius={mcRadius}
        />
      )}

      {/* Velvet table cloth — bottom 1/3 */}
      {!reducedMotion && (
        <Animated.View style={[styles.velvetTable, { height: screenHeight * 0.35 }, velvetStyle]}>
          <LinearGradient
            colors={['#1a0a2e00', '#1a0a2e', '#12071e']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.3 }}
          />
          {/* Gold fringe line */}
          <View style={styles.velvetFringe} />
        </Animated.View>
      )}

      {/* Wheel of cards */}
      {phase !== 'revealed' && (
        <Animated.View
          testID={`${testIDPrefix}-wheel`}
          style={[
            styles.wheel,
            {
              width: wheelRadius * 2.5,
              height: wheelRadius * 2.5,
            },
            wheelStyle,
          ]}
        >
          {wheelCards.map((card, index) => {
            const x = Math.cos(card.angle - Math.PI / 2) * wheelRadius;
            const y = Math.sin(card.angle - Math.PI / 2) * wheelRadius;
            const rotation = (card.angle * 180) / Math.PI;
            const isSelected = selectedCardIndex === index;

            return (
              <View
                key={card.id}
                style={[
                  styles.wheelCard,
                  isSelected && styles.hidden,
                  {
                    width: cardWidth * 0.32,
                    height: cardHeight * 0.32,
                    transform: [{ translateX: x }, { translateY: y }, { rotate: `${rotation}deg` }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => handleCardSelect(index)}
                  disabled={phase !== 'waiting'}
                  style={styles.pressableFill}
                >
                  <CardBackView width={cardWidth * 0.32} height={cardHeight * 0.32} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Drawn card (fly to center → flip) */}
      <Animated.View
        testID={`${testIDPrefix}-drawn-card`}
        style={[
          styles.drawnCard,
          { width: cardWidth, height: cardHeight },
          phase === 'waiting' ? styles.pointerEventsNone : styles.pointerEventsAuto,
          drawnCardStyle,
        ]}
      >
        {/* Card back */}
        <Animated.View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
          <CardBackView width={cardWidth} height={cardHeight} />
        </Animated.View>

        {/* Card front */}
        <Animated.View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
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
        </Animated.View>
      </Animated.View>

      {/* Fortune quote — appears after reveal */}
      {phase === 'revealed' && (
        <Animated.View style={[styles.fortuneContainer, { top: insets.top + 60 }, fortuneStyle]}>
          <Animated.Text style={styles.fortuneText}>
            {FORTUNE_QUOTES[role.alignment] ?? FORTUNE_QUOTES.villager}
          </Animated.Text>
        </Animated.View>
      )}

      <HintWithWarning
        hintText={
          phase === 'waiting' ? '🔮 凭直觉选一张牌' : phase === 'drawing' ? '✨ 翻牌中…' : null
        }
        showWarning={autoTimeoutWarning}
      />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pointerEventsNone: { pointerEvents: 'none' as const },
  pointerEventsAuto: { pointerEvents: 'auto' as const },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070012',
  },
  wheel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCard: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    boxShadow: '0px 4px 6px rgba(0,0,0,0.3)',
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    boxShadow: `0px 10px 20px rgba(212,175,55,0.5)`,
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
  hidden: {
    opacity: 0,
  },
  pressableFill: {
    flex: 1,
  },
  velvetTable: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  velvetFringe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: TAROT_COLORS.velvetFringe,
    opacity: 0.5,
  },
  fortuneContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  fortuneText: {
    fontSize: 18,
    fontWeight: '500',
    color: TAROT_COLORS.gold,
    textAlign: 'center',
    ...crossPlatformTextShadow(TAROT_COLORS.goldGlow, 0, 0, 12),
  },
});
