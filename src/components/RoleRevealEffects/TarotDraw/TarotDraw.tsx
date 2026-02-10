/**
 * TarotDraw - 转盘抽卡揭示效果
 *
 * 动画流程：多张牌围成一圈旋转 → 减速 → 抽出飞向中央 → 翻转揭示。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef,useState } from 'react';
import { Animated, Easing, Pressable,StyleSheet, useWindowDimensions, View } from 'react-native';

import { GlowBorder } from '@/components/RoleRevealEffects/common/GlowBorder';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { canUseNativeDriver } from '@/components/RoleRevealEffects/utils/platform';
import type { RoleId } from '@/models/roles';
import { borderRadius, shadows,useColors } from '@/theme';

const TAROT_COLORS = {
  cardBack: ['#2a2a4e', '#3d3d64', '#2a2a4e'] as const,
  gold: '#d4af37',
  goldGlow: '#ffd700',
  cardFrontGradient: ['#f5f5f5', '#ffffff', '#f5f5f5'] as const,
};

interface WheelCard {
  id: number;
  angle: number;
}

const CardBackFace: React.FC<{ width: number; height: number }> = React.memo(
  ({ width, height }) => (
    <View style={[styles.cardBackFace, { width, height }]}>
      <LinearGradient
        colors={[...TAROT_COLORS.cardBack]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardBackInner}>
          <View style={[styles.cardBackBorder, { borderColor: TAROT_COLORS.gold }]}>
            <Animated.Text style={styles.symbolText}>☽</Animated.Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  ),
);
CardBackFace.displayName = 'CardBackFace';

export const TarotDraw: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'tarot-draw',
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const theme = ALIGNMENT_THEMES[role.alignment];
  const config = CONFIG.tarot ?? { flipDuration: 800, revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<'waiting' | 'drawing' | 'flipping' | 'revealed'>('waiting');
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const onCompleteCalledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const wheelRotationValueRef = useRef(0);

  const cardWidth = Math.min(screenWidth * 0.7, 260);
  const cardHeight = cardWidth * 1.4;
  const wheelRadius = Math.min(screenWidth * 0.32, 130);

  const wheelCards: WheelCard[] = useMemo(() => {
    const count = 8;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count,
    }));
  }, []);

  const wheelRotation = useMemo(() => new Animated.Value(0), []);
  const wheelOpacity = useMemo(() => new Animated.Value(1), []);
  const wheelScale = useMemo(() => new Animated.Value(1), []);

  const drawnCardX = useMemo(() => new Animated.Value(0), []);
  const drawnCardY = useMemo(() => new Animated.Value(-wheelRadius), [wheelRadius]);
  const drawnCardScale = useMemo(() => new Animated.Value(1), []);
  const drawnCardOpacity = useMemo(() => new Animated.Value(0), []);
  const drawnCardRotateZ = useMemo(() => new Animated.Value(0), []);

  const flipProgress = useMemo(() => new Animated.Value(0), []);

  const cleanup = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    spinAnimRef.current?.stop();
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Track wheelRotation value via listener (avoids accessing private _value)
  useEffect(() => {
    const listenerId = wheelRotation.addListener(({ value }) => {
      wheelRotationValueRef.current = value;
    });
    return () => wheelRotation.removeListener(listenerId);
  }, [wheelRotation]);

  const flipRotateY = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backOpacity = flipProgress.interpolate({
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [1, 1, 0, 0],
  });

  const frontOpacity = flipProgress.interpolate({
    inputRange: [0, 0.48, 0.52, 1],
    outputRange: [0, 0, 1, 1],
  });

  const startFlipping = useCallback(() => {
    setPhase('flipping');
    if (enableHaptics) triggerHaptic('medium', true);

    Animated.timing(flipProgress, {
      toValue: 1,
      duration: config.flipDuration ?? 800,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      setPhase('revealed');
      if (enableHaptics) triggerHaptic('heavy', true);
    });
  }, [flipProgress, config.flipDuration, enableHaptics]);

  const startDrawing = useCallback(() => {
    setPhase('drawing');
    if (enableHaptics) triggerHaptic('medium', true);

    drawnCardOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(wheelScale, {
        toValue: 0.5,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(wheelOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(drawnCardX, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(drawnCardY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start(() => {
      const t = setTimeout(() => startFlipping(), 300);
      timersRef.current.push(t);
    });
  }, [
    drawnCardX,
    drawnCardY,
    drawnCardOpacity,
    wheelScale,
    wheelOpacity,
    enableHaptics,
    startFlipping,
  ]);

  // 点击选牌时调用
  const handleCardSelect = useCallback(
    (cardIndex: number) => {
      if (phase !== 'waiting') return;
      setSelectedCardIndex(cardIndex);
      spinAnimRef.current?.stop();
      if (enableHaptics) triggerHaptic('medium', true);

      // 获取选中牌的位置
      const currentRotation = wheelRotationValueRef.current || 0;
      const cardAngle = wheelCards[cardIndex].angle;
      const totalAngle = currentRotation * Math.PI * 2 + cardAngle - Math.PI / 2;
      const x = Math.cos(totalAngle) * wheelRadius;
      const y = Math.sin(totalAngle) * wheelRadius;

      // 设置抽出牌的初始位置
      drawnCardX.setValue(x);
      drawnCardY.setValue(y);
      drawnCardOpacity.setValue(1);

      startDrawing();
    },
    [
      phase,
      wheelCards,
      wheelRadius,
      drawnCardX,
      drawnCardY,
      drawnCardOpacity,
      enableHaptics,
      startDrawing,
    ],
  );

  const startSpinning = useCallback(() => {
    // 慢速旋转：4秒转一圈（等待玩家选牌）
    const spin = Animated.loop(
      Animated.timing(wheelRotation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: canUseNativeDriver,
      }),
    );
    spinAnimRef.current = spin;
    spin.start();
  }, [wheelRotation]);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;

    const t = setTimeout(() => {
      onComplete();
    }, config.revealHoldDuration ?? 1200);
    timersRef.current.push(t);
  }, [onComplete, config.revealHoldDuration]);

  useEffect(() => {
    if (reducedMotion) {
      flipProgress.setValue(1);
      wheelOpacity.setValue(0);
      drawnCardOpacity.setValue(1);
      drawnCardScale.setValue(1);
      setPhase('revealed');
      return;
    }

    startSpinning();
  }, [reducedMotion, flipProgress, wheelOpacity, drawnCardOpacity, drawnCardScale, startSpinning]);

  const wheelRotateZ = wheelRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      testID={`${testIDPrefix}-container`}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <LinearGradient colors={[...TAROT_COLORS.cardFrontGradient]} style={StyleSheet.absoluteFill} />

      {/* 提示文字 */}
      {phase === 'waiting' && (
        <View style={styles.promptContainer}>
          <Animated.Text style={[styles.promptText, { color: TAROT_COLORS.gold }]}>
            选择一张牌
          </Animated.Text>
        </View>
      )}

      {phase !== 'revealed' && (
        <Animated.View
          testID={`${testIDPrefix}-wheel`}
          style={[
            styles.wheel,
            {
              width: wheelRadius * 2.5,
              height: wheelRadius * 2.5,
              opacity: wheelOpacity,
              transform: [{ scale: wheelScale }, { rotate: wheelRotateZ }],
            },
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
                  {
                    width: cardWidth * 0.55,
                    height: cardHeight * 0.55,
                    opacity: isSelected ? 0 : 1,
                    transform: [{ translateX: x }, { translateY: y }, { rotate: `${rotation}deg` }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => handleCardSelect(index)}
                  disabled={phase !== 'waiting'}
                  style={{ flex: 1 }}
                >
                  <CardBackFace width={cardWidth * 0.55} height={cardHeight * 0.55} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      <Animated.View
        testID={`${testIDPrefix}-drawn-card`}
        style={[
          styles.drawnCard,
          {
            width: cardWidth,
            height: cardHeight,
            opacity: drawnCardOpacity,
            transform: [
              { translateX: drawnCardX },
              { translateY: drawnCardY },
              { scale: drawnCardScale },
              {
                rotate: drawnCardRotateZ.interpolate({
                  inputRange: [-180, 180],
                  outputRange: ['-180deg', '180deg'],
                }),
              },
              { perspective: 1200 },
              { rotateY: flipRotateY },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.cardFace, styles.cardBack, { opacity: backOpacity }]}>
          <CardBackFace width={cardWidth} height={cardHeight} />
        </Animated.View>

        <Animated.View
          style={[
            styles.cardFace,
            styles.cardFront,
            {
              opacity: frontOpacity,
              transform: [{ scaleX: -1 }],
            },
          ]}
        >
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />

          {phase === 'revealed' && (
            <GlowBorder
              width={cardWidth + 8}
              height={cardHeight + 8}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={3}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={3}
              flashDuration={200}
              onComplete={handleGlowComplete}
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCard: {
    position: 'absolute',
    borderRadius: borderRadius.small,
    shadowColor: shadows.md.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  cardBackFace: {
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
  },
  cardBackInner: {
    flex: 1,
    padding: 6,
  },
  cardBackBorder: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolText: {
    fontSize: 36,
    color: TAROT_COLORS.gold,
    textShadowColor: TAROT_COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  drawnCard: {
    borderRadius: borderRadius.medium,
    shadowColor: TAROT_COLORS.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    zIndex: 2,
  },
  cardFront: {
    zIndex: 1,
  },
  glowBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
  },
  promptContainer: {
    position: 'absolute',
    top: 60,
    alignItems: 'center',
  },
  promptText: {
    fontSize: 20,
    fontWeight: '600',
    textShadowColor: TAROT_COLORS.goldGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
