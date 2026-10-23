/**
 * NightReviewModal - Night action review modal (for judge/spectator)
 *
 * Shell only: modal frame, close button, title and scrolling. The report
 * presentation itself lives in NightReviewReportBody, shared with the share
 * card so the two surfaces cannot drift.
 */
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { CloseButton } from '@/components/CloseButton';
import { TESTIDS } from '@/testids';
import { borderRadius, spacing, typography } from '@/theme';

import type { NightReviewData } from '../NightReview.helpers';
import { NIGHT_REPORT_PALETTE, NIGHT_REVIEW_CARD_WIDTH_RATIO } from '../nightReviewLayout';
import { NightReviewReportBody } from './NightReviewReportBody';

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  onClose: () => void;
}

export const NightReviewModal: React.FC<NightReviewModalProps> = ({ visible, data, onClose }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // The frame takes the report's light surface: the report body prints
  // its page edge-to-edge inside the modal.
  const contentStyle = useMemo(
    () => ({
      width: screenWidth * NIGHT_REVIEW_CARD_WIDTH_RATIO,
      maxHeight: screenHeight * 0.75,
      backgroundColor: NIGHT_REPORT_PALETTE.background,
      borderRadius: borderRadius.xlarge,
      padding: 0,
    }),
    [screenWidth, screenHeight],
  );

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      contentStyle={contentStyle}
      testID={TESTIDS.nightReviewModal}
      dismissOnOverlayPress
    >
      <CloseButton onPress={onClose} variant="onOverlay" />

      <Text style={styles.title}>本局复盘</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <NightReviewReportBody data={data} />
      </ScrollView>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    color: NIGHT_REPORT_PALETTE.text,
    textAlign: 'center',
    paddingTop: spacing.large,
    marginBottom: spacing.small,
  },
  scrollView: {
    flex: 1,
  },
});
