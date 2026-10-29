/**
 * NightReviewShareCard - Hidden share card used for battle report screenshot capture.
 *
 * Shell only: card frame. The report presentation itself lives in
 * NightReviewReportBody, shared with NightReviewModal so the two surfaces
 * cannot drift; the share title prints on the report's masthead.
 */
import { type Ref, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View as RNView, type View } from 'react-native';

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
      <NightReviewReportBody data={data} shareTitle={formatNightReviewShareTitle(roomCode)} />
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
  });
}
