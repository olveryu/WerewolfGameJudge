/**
 * NightReviewShareCard - Hidden share card used for battle report screenshot capture.
 *
 * Shell only: card frame and share title. The report presentation itself lives
 * in NightReviewReportBody, shared with NightReviewModal so the two surfaces
 * cannot drift.
 */
import { type Ref, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View as RNView, type View } from 'react-native';

import { borderRadius, colors, fixed, spacing, type ThemeColors, typography } from '@/theme';

import type { NightReviewData } from '../NightReview.helpers';
import { formatNightReviewShareTitle, NIGHT_REVIEW_CARD_WIDTH_RATIO } from '../nightReviewLayout';
import { NightReviewReportBody } from './NightReviewReportBody';

interface NightReviewShareCardProps {
  data: NightReviewData;
  roomCode: string;
  ref?: Ref<View>;
}

export function NightReviewShareCard({ data, roomCode, ref }: NightReviewShareCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, screenWidth), [screenWidth]);

  return (
    <RNView ref={ref} collapsable={false} style={styles.card}>
      <Text style={styles.title}>{formatNightReviewShareTitle(roomCode)}</Text>

      <NightReviewReportBody data={data} />
    </RNView>
  );
}

function createStyles(colors: ThemeColors, screenWidth: number) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      padding: spacing.large,
      width: screenWidth * NIGHT_REVIEW_CARD_WIDTH_RATIO,
    },
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
  });
}
