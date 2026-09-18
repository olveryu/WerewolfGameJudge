/** Collection-owned reveal artwork around the authoritative role card; acknowledgement stays explicit. */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedG } from '@/components/seatFlairs/svgAnimatedPrimitives';
import {
  MYTHIC_COLLECTION_COLORS,
  MYTHIC_ENTRY_DURATION,
  type MythicCollection,
} from '@/config/mythicVisual';
import { borderRadius, colors, spacing, typography } from '@/theme';

import { RoleCardContent } from './common/RoleCardContent';
import { CONFIG } from './config';
import { useRevealLifecycle } from './hooks/useRevealLifecycle';
import { createAlignmentThemes, type RoleRevealEffectProps } from './types';

const REVEALS = {
  astral: { id: 'fateReweave', name: '命盘重构' },
  ocean: { id: 'oceanPearl', name: '万海开珠' },
  ink: { id: 'unfoldLandscape', name: '长卷开天' },
} as const;

function StarSegment({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const colors = MYTHIC_COLLECTION_COLORS.astral;
  const props = useAnimatedProps(() => ({
    transform: `rotate(${index * 45 + progress.value * 35} 100 150) translate(${progress.value * 185} 0)`,
    opacity: 1 - progress.value,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Path
        d="M100 150 L270 79 A184 184 0 0 1 270 221 Z"
        fill={colors.dark}
        stroke={colors.secondary}
        strokeWidth={2}
      />
      <Path
        d="M128 150 H250 M172 126 V174 M192 117 V183 M212 108 V192"
        stroke={colors.primary}
        strokeWidth={1.5}
      />
      <Circle cx={237} cy={150} r={7} fill={colors.pearl} />
    </AnimatedG>
  );
}

function RevealArtwork({
  collection,
  progress,
}: {
  collection: MythicCollection;
  progress: SharedValue<number>;
}) {
  const colors = MYTHIC_COLLECTION_COLORS[collection];
  const left = useAnimatedProps(() => ({
    transform: `translate(${-progress.value * 120} 0) rotate(${-progress.value * (collection === 'ocean' ? 28 : 0)} 100 290)`,
    opacity: 1 - progress.value,
  }));
  const right = useAnimatedProps(() => ({
    transform: `translate(${progress.value * 120} 0) rotate(${progress.value * (collection === 'ocean' ? 28 : 0)} 100 290)`,
    opacity: 1 - progress.value,
  }));
  const pearl = useAnimatedProps(() => ({
    opacity: 1 - Math.min(1, progress.value * 2),
    transform: `translate(100 150) scale(${1 + progress.value * 2})`,
  }));
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 300" pointerEvents="none">
      {collection === 'astral' ? (
        Array.from({ length: 8 }, (_, index) => (
          <StarSegment key={index} index={index} progress={progress} />
        ))
      ) : (
        <>
          {[
            { side: -1, props: left },
            { side: 1, props: right },
          ].map(({ side, props }) => (
            <AnimatedG key={side} animatedProps={props}>
              <G transform={side === 1 ? 'translate(200 0) scale(-1 1)' : undefined}>
                {collection === 'ocean' ? (
                  <>
                    <Path
                      d="M100 295 C75 270 -15 205 -10 115 C-8 45 60 -5 100 10 Z"
                      fill={colors.dark}
                      stroke={colors.secondary}
                      strokeWidth={3}
                    />
                    <Path
                      d="M100 288 Q2 145 72 15 M100 288 Q-15 135 48 24 M100 288 Q-20 160 24 52 M100 288 Q-12 184 8 84"
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={3}
                    />
                    <Path
                      d="M100 278 Q33 147 90 16"
                      fill="none"
                      stroke={colors.pearl}
                      strokeWidth={1.5}
                    />
                  </>
                ) : (
                  <>
                    <Rect x={0} y={5} width={100} height={290} fill={colors.pearl} />
                    <Path
                      d="M0 245 L32 183 L49 204 L75 142 L100 194 V272 H0 Z"
                      fill={colors.primary}
                    />
                    <Path
                      d="M0 270 L24 225 L46 250 L66 199 L100 255 V285 H0 Z"
                      fill={colors.dark}
                    />
                    <Path d="M94 0 V300" stroke={colors.secondary} strokeWidth={8} />
                    <Path
                      d="M18 51 Q50 37 72 57 M18 77 Q38 58 64 72"
                      fill="none"
                      stroke={colors.dark}
                      strokeWidth={3}
                    />
                  </>
                )}
              </G>
            </AnimatedG>
          ))}
          <AnimatedG animatedProps={pearl}>
            {collection === 'ocean' ? (
              <>
                <Circle r={21} fill={colors.primary} opacity={0.4} />
                <Circle r={13} fill={colors.pearl} />
                <Circle cx={-4} cy={-4} r={4} fill={colors.secondary} />
              </>
            ) : (
              <>
                <Rect x={-16} y={-20} width={32} height={40} fill={colors.secondary} />
                <Path
                  d="M-9 -12 V12 H9 V-12 M0 -15 V15 M-10 0 H10"
                  stroke={colors.pearl}
                  strokeWidth={3}
                />
              </>
            )}
          </AnimatedG>
        </>
      )}
    </Svg>
  );
}

/** Plays once, exposes the real identity, then completes only after user acknowledgement. */
export function MythicCollectionReveal({
  collection,
  role,
  onComplete,
  reducedMotion = false,
  testIDPrefix = 'role-reveal',
}: RoleRevealEffectProps & { collection: MythicCollection }) {
  const artworkColors = MYTHIC_COLLECTION_COLORS[collection];
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(
    CONFIG.common.cardMaxWidth,
    width * CONFIG.common.cardWidthRatio,
    (height * 0.58) / CONFIG.common.cardAspectRatio,
  );
  const cardHeight = cardWidth * CONFIG.common.cardAspectRatio;
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const [isRevealed, setIsRevealed] = useState(reducedMotion);
  const reveal = useCallback(() => setIsRevealed(true), []);
  const { fireComplete } = useRevealLifecycle({ onComplete });
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: reducedMotion ? 0 : MYTHIC_ENTRY_DURATION, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(reveal);
      },
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion, reveal]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (progress.value - 0.15) / 0.5)),
  }));
  const themes = createAlignmentThemes(colors);
  const presentation = REVEALS[collection];
  return (
    <View style={styles.container} testID={`${testIDPrefix}-${presentation.id}`}>
      <View
        style={[
          styles.card,
          { width: cardWidth, height: cardHeight, borderColor: artworkColors.secondary },
        ]}
      >
        <Animated.View
          style={cardStyle}
          accessibilityElementsHidden={!isRevealed}
          importantForAccessibility={isRevealed ? 'auto' : 'no-hide-descendants'}
        >
          <RoleCardContent
            roleId={role.id}
            width={cardWidth}
            height={cardHeight}
            revealMode
            revealGradient={themes[role.alignment].revealGradient}
            testID={`${testIDPrefix}-collection-card`}
          />
        </Animated.View>
        {!isRevealed && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <RevealArtwork collection={collection} progress={progress} />
          </View>
        )}
      </View>
      {isRevealed ? (
        <Pressable
          accessibilityRole="button"
          onPress={fireComplete}
          testID={`${testIDPrefix}-collection-confirm`}
          style={[styles.confirm, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.confirmText, { color: colors.textInverse }]}>我知道了</Text>
        </Pressable>
      ) : (
        <Text style={[styles.title, { color: artworkColors.pearl }]}>{presentation.name}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.large,
    paddingTop: spacing.xlarge,
  },
  card: { overflow: 'hidden', borderRadius: borderRadius.medium, borderWidth: 2 },
  confirm: {
    paddingHorizontal: spacing.xlarge,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
  },
  confirmText: { fontSize: typography.body },
  title: { fontSize: typography.title, paddingVertical: spacing.small },
});
