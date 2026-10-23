/**
 * NightReviewShareCard - Hidden share card used for battle report screenshot capture.
 *
 * Shell only: card frame and share title. The report presentation itself lives
 * in NightReviewReportBody, shared with NightReviewModal so the two surfaces
 * cannot drift.
 */
import { type Ref, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View as RNView, type View } from 'react-native';

import { spacing, typography } from '@/theme';

import type { NightReviewData } from '../NightReview.helpers';
import {
  formatNightReviewShareTitle,
  NIGHT_REPORT_PALETTE,
  NIGHT_REVIEW_CARD_WIDTH_RATIO,
} from '../nightReviewLayout';
import { NightReviewReportBody } from './NightReviewReportBody';

interface NightReviewShareCardProps {
  data: NightReviewData;
  roomCode: string;
  ref?: Ref<View>;
}

export function NightReviewShareCard({ data, roomCode, ref }: NightReviewShareCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(screenWidth), [screenWidth]);

  return (
    <RNView ref={ref} collapsable={false} style={styles.card}>
      <Text style={styles.title}>{formatNightReviewShareTitle(roomCode)}</Text>

      <NightReviewReportBody data={data} />
    </RNView>
  );
}

function createStyles(screenWidth: number) {
  return StyleSheet.create({
    // The captured card is the report itself: light surface edge-to-edge,
    // the report body prints its page inside.
    card: {
      backgroundColor: NIGHT_REPORT_PALETTE.background,
      width: screenWidth * NIGHT_REVIEW_CARD_WIDTH_RATIO,
    },
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: NIGHT_REPORT_PALETTE.text,
      textAlign: 'center',
      paddingTop: spacing.large,
    },
  });
}
