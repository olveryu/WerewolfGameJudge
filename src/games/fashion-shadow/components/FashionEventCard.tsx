/** FashionEventCard — animated case briefing derived from the authoritative round catalog. */
import { FASHION_ROUND_BY_NUMBER } from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { FashionCaseIllustration } from './FashionCaseIllustration';

interface FashionEventCardProps {
  readonly roundNumber: 1 | 2 | 3 | 4;
  readonly voteQuestion: string | null;
}

export const FashionEventCard: React.FC<FashionEventCardProps> = ({
  roundNumber,
  voteQuestion,
}) => {
  const round = FASHION_ROUND_BY_NUMBER[roundNumber];
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(reveal);
    if (reducedMotion) {
      reveal.value = 1;
      return;
    }

    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 420 });
    return () => cancelAnimation(reveal);
  }, [reducedMotion, reveal, round.eventId]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 16 }],
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.metaRow}>
        <Text style={styles.location}>{round.location}</Text>
        <View style={styles.esgBadge}>
          <Text style={styles.esg}>ESG · {round.esg}</Text>
        </View>
      </View>
      <Text style={styles.eventId}>CASE {round.eventId}</Text>
      <Text style={styles.title}>{round.eventTitle}</Text>
      <FashionCaseIllustration round={roundNumber} />
      <Text style={styles.description}>{round.eventDescription}</Text>
      <View style={styles.evidencePreview}>
        <Text style={styles.evidenceLabel}>本轮潜在线索</Text>
        <Text style={styles.evidenceTitle}>
          {round.evidenceId} · {round.evidenceTitle}
        </Text>
      </View>
      {voteQuestion !== null ? (
        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>INVESTIGATION QUESTION</Text>
          <Text style={styles.question}>{voteQuestion}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.surfaceMuted,
    padding: spacing.large,
    gap: spacing.small,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  location: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  esgBadge: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyanSoft,
    backgroundColor: fashionShadowColors.neonCyanSoft,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  esg: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  eventId: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  description: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  evidencePreview: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPinkSoft,
    backgroundColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  evidenceLabel: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  evidenceTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  questionBlock: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.border,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  questionLabel: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  question: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
});
