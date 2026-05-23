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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { borderRadius, colors, crossPlatformTextShadow } from '@/theme';

import { CardBackView } from './CardBackView';
import TarotSceneCanvas from './TarotSceneCanvas';

// Register keyframe for wheel spin
registerKeyframes('tarotWheelSpin', 'from{transform:rotate(0deg)}to{transform:rotate(360deg)}');

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
  const [wheelOpacity, setWheelOpacity] = useState(1);
  const [wheelScale, setWheelScale] = useState(1);
  const [wheelStopped, setWheelStopped] = useState(false);
  const [drawnCardX, setDrawnCardX] = useState(0);
  const [drawnCardY, setDrawnCardY] = useState(-wheelRadius);
  const [drawnCardScale, setDrawnCardScale] = useState(1);
  const [drawnCardOpacity, setDrawnCardOpacity] = useState(0);
  const [flipProgress, setFlipProgress] = useState(0);
  const [fortuneOpacity, setFortuneOpacity] = useState(0);
  const [velvetOpacity, setVelvetOpacity] = useState(0);
  const wheelStartTimeRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => {
    setPhase('revealed');
    if (enableHaptics) void triggerHaptic('heavy', true);
    schedule(() => setFortuneOpacity(1), 400);
  }, [enableHaptics, schedule]);

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    setFlipStartTime(performance.now());
    if (enableHaptics) void triggerHaptic('medium', true);

    setFlipProgress(1);
    schedule(enterRevealed, config.flipDuration ?? 800);
  }, [config.flipDuration, enableHaptics, enterRevealed, schedule]);

  const beginFlipAfterDelay = useCallback(() => {
    schedule(() => {
      setDrawnCardScale(1);
      startFlipping();
    }, 300);
  }, [startFlipping, schedule]);

  const startDrawing = useCallback(() => {
    setPhase('drawing');
    setDrawStartTime(performance.now());
    if (enableHaptics) void triggerHaptic('medium', true);

    setDrawnCardOpacity(1);

    // Fade out wheel
    setWheelScale(0.5);
    setWheelOpacity(0);

    // Move drawn card to center
    setDrawnCardX(0);
    setDrawnCardY(0);

    schedule(beginFlipAfterDelay, 500);
  }, [enableHaptics, beginFlipAfterDelay, schedule]);

  const handleCardSelect = useCallback(
    (cardIndex: number) => {
      if (phase !== 'waiting') return;
      setSelectedCardIndex(cardIndex);
      setWheelStopped(true);
      if (enableHaptics) void triggerHaptic('medium', true);

      // Calculate selected card position from elapsed time
      const elapsed = performance.now() - wheelStartTimeRef.current;
      const currentRotation = (elapsed / 4000) % 1;
      const cardAngle = wheelCards[cardIndex]!.angle;
      const totalAngle = currentRotation * Math.PI * 2 + cardAngle - Math.PI / 2;
      const x = Math.cos(totalAngle) * wheelRadius;
      const y = Math.sin(totalAngle) * wheelRadius;

      setDrawnCardX(x);
      setDrawnCardY(y);

      startDrawing();
    },
    [phase, wheelCards, wheelRadius, enableHaptics, startDrawing],
  );

  // ── Kick-off ──
  useEffect(() => {
    if (reducedMotion) {
      setFlipProgress(1);
      setWheelOpacity(0);
      setDrawnCardOpacity(1);
      setDrawnCardScale(1);
      setPhase('revealed');
      fireComplete();
      return;
    }

    // Start wheel spin
    wheelStartTimeRef.current = performance.now();
    // Velvet table fades in
    setVelvetOpacity(1);

    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion, fireComplete]);

  // ── Auto-select if user doesn't tap (unified 8s timeout) ──
  const autoSelectRandom = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * wheelCards.length);
    handleCardSelect(randomIndex);
  }, [wheelCards.length, handleCardSelect]);
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'waiting' && !reducedMotion,
    autoSelectRandom,
  );

  // ── Computed styles with CSS transitions ──
  const wheelStyle = {
    opacity: wheelOpacity,
    transform: [{ scale: wheelScale }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '400ms',
    transitionTimingFunction: 'ease-out',
    ...(wheelStopped
      ? {}
      : {
          animationName: 'tarotWheelSpin',
          animationDuration: '4s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }),
  } as never;

  const drawnCardStyle = {
    opacity: drawnCardOpacity,
    transform: [
      { translateX: drawnCardX },
      { translateY: drawnCardY },
      { scale: drawnCardScale },
      { perspective: 1200 },
      { rotateY: `${flipProgress * 180}deg` },
    ],
    transitionProperty: 'opacity, transform',
    transitionDuration: `${config.flipDuration ?? 800}ms`,
    transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
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

  const velvetStyle = {
    opacity: velvetOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '800ms',
  } as never;

  const fortuneStyle = {
    opacity: fortuneOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '800ms',
  } as never;

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
        <View style={[styles.velvetTable, { height: screenHeight * 0.35 }, velvetStyle]}>
          <LinearGradient
            colors={['#1a0a2e00', '#1a0a2e', '#12071e']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.3 }}
          />
          {/* Gold fringe line */}
          <View style={styles.velvetFringe} />
        </View>
      )}

      {/* Wheel of cards */}
      {phase !== 'revealed' && (
        <View
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
        </View>
      )}

      {/* Drawn card (fly to center → flip) */}
      <View
        testID={`${testIDPrefix}-drawn-card`}
        style={[
          styles.drawnCard,
          { width: cardWidth, height: cardHeight },
          phase === 'waiting' ? styles.pointerEventsNone : styles.pointerEventsAuto,
          drawnCardStyle,
        ]}
      >
        {/* Card back */}
        <View style={[styles.cardFace, styles.cardBackZ, backOpacityStyle]}>
          <CardBackView width={cardWidth} height={cardHeight} />
        </View>

        {/* Card front */}
        <View style={[styles.cardFace, styles.cardFrontZ, frontOpacityStyle]}>
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

      {/* Fortune quote — appears after reveal */}
      {phase === 'revealed' && (
        <View style={[styles.fortuneContainer, { top: insets.top + 60 }, fortuneStyle]}>
          <Text style={styles.fortuneText}>
            {FORTUNE_QUOTES[role.alignment] ?? FORTUNE_QUOTES.villager}
          </Text>
        </View>
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
