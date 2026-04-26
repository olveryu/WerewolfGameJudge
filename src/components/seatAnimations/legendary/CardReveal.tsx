/**
 * CardReveal — 翻牌登场
 *
 * Legendary entrance: a card flips from back to front in 3D perspective,
 * golden sparkles scatter on flip, card fades to reveal actual avatar.
 */
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { LEGENDARY_DURATION } from '../durations';
import type { SeatAnimationProps } from '../SeatAnimationProps';
import { AnimatedCircle } from '../svgAnimatedPrimitives';

const SPARKLE_COUNT = 8;

const Sparkle = memo<{ index: number; size: number; trigger: { value: number } }>(
  ({ index, size, trigger }) => {
    const angle = (index / SPARKLE_COUNT) * Math.PI * 2;
    const props = useAnimatedProps(() => {
      'worklet';
      const t = trigger.value;
      const dist = t * size * 0.35;
      return {
        cx: size / 2 + Math.cos(angle) * dist,
        cy: size / 2 + Math.sin(angle) * dist,
        r: size * 0.015 * (1 - t * 0.7),
        opacity: t > 0.05 ? (1 - t) * 0.8 : 0,
      } as Record<string, number>;
    });
    return (
      <AnimatedCircle
        animatedProps={props}
        fill={index % 2 === 0 ? 'rgb(255,220,80)' : 'rgb(255,180,50)'}
      />
    );
  },
);
Sparkle.displayName = 'Sparkle';

export const CardReveal = memo<SeatAnimationProps>(
  ({ size, borderRadius, onComplete, children }) => {
    const flipProgress = useSharedValue(0);
    const sparkleProgress = useSharedValue(0);
    const cardFade = useSharedValue(1);
    const childOpacity = useSharedValue(0);

    useEffect(() => {
      flipProgress.value = withTiming(1, {
        duration: LEGENDARY_DURATION * 0.75,
        easing: Easing.inOut(Easing.cubic),
      });
      sparkleProgress.value = withDelay(
        LEGENDARY_DURATION * 0.31,
        withTiming(1, { duration: LEGENDARY_DURATION * 0.5 }),
      );
      cardFade.value = withDelay(
        LEGENDARY_DURATION * 0.63,
        withTiming(0, { duration: LEGENDARY_DURATION * 0.31 }),
      );
      childOpacity.value = withDelay(
        LEGENDARY_DURATION * 0.56,
        withTiming(
          1,
          { duration: LEGENDARY_DURATION * 0.44, easing: Easing.out(Easing.cubic) },
          (f) => {
            if (f) runOnJS(onComplete)();
          },
        ),
      );
    }, [flipProgress, sparkleProgress, cardFade, childOpacity, onComplete]);

    // Card back (visible first half of flip)
    const cardBackStyle = useAnimatedStyle(() => {
      const rotY = flipProgress.value * 180;
      return {
        opacity: rotY < 90 ? cardFade.value : 0,
        transform: [{ perspective: 800 }, { rotateY: `${rotY}deg` }],
      };
    });

    // Card front (visible second half of flip)
    const cardFrontStyle = useAnimatedStyle(() => {
      const rotY = flipProgress.value * 180 - 180;
      return {
        opacity: flipProgress.value > 0.5 ? cardFade.value : 0,
        transform: [{ perspective: 800 }, { rotateY: `${rotY}deg` }],
      };
    });

    const childStyle = useAnimatedStyle(() => ({
      opacity: childOpacity.value,
    }));

    const sparkles = useMemo(() => Array.from({ length: SPARKLE_COUNT }, (_, i) => i), []);

    return (
      <View style={[styles.container, { width: size, height: size }]}>
        {/* Card back */}
        <Animated.View
          style={[
            styles.card,
            styles.cardRadius,
            { width: size * 0.7, height: size * 0.9, left: size * 0.15, top: size * 0.05 },
            cardBackStyle,
          ]}
        >
          <View style={[styles.cardBack, styles.cardRadius]} />
        </Animated.View>
        {/* Card front */}
        <Animated.View
          style={[
            styles.card,
            styles.cardRadius,
            { width: size * 0.7, height: size * 0.9, left: size * 0.15, top: size * 0.05 },
            cardFrontStyle,
          ]}
        >
          <View style={[styles.cardFront, styles.cardRadius]} />
        </Animated.View>
        {/* Sparkles */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {sparkles.map((i) => (
            <Sparkle key={i} index={i} size={size} trigger={sparkleProgress} />
          ))}
        </Svg>
        {/* Actual avatar */}
        <Animated.View
          style={[styles.childWrapper, { width: size, height: size, borderRadius }, childStyle]}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);
CardReveal.displayName = 'CardReveal';

const CARD_BACK_BG = 'rgb(60,40,100)';
const CARD_FRONT_BG = 'rgb(240,230,200)';
const CARD_BORDER = 'rgb(180,150,80)';

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden' },
  childWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  card: { position: 'absolute', backfaceVisibility: 'hidden' },
  cardRadius: { borderRadius: 8 },
  cardBack: { flex: 1, backgroundColor: CARD_BACK_BG, borderWidth: 2, borderColor: CARD_BORDER },
  cardFront: { flex: 1, backgroundColor: CARD_FRONT_BG, borderWidth: 2, borderColor: CARD_BORDER },
});
