/**
 * NightReviewModal - Night action review modal (for judge/spectator)
 *
 * Displays a summary of all night-1 actions and the true identity of every player.
 * Renders Modal UI with pre-built data; no service imports, no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { CloseButton } from '@/components/CloseButton';
import { STATUS_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import { colors, fixed, spacing, textStyles, typography } from '@/theme';

import type { NightReviewData } from '../NightReview.helpers';

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  onClose: () => void;
}

export const NightReviewModal: React.FC<NightReviewModalProps> = ({ visible, data, onClose }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const contentStyle = useMemo(
    () => ({ width: screenWidth * 0.88, maxHeight: screenHeight * 0.75 }),
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
      <CloseButton onPress={onClose} />

      <Text style={styles.title}>夜晚行动回顾</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Fair play reminder */}
        <Text style={styles.disclaimer}>
          <Ionicons
            name={STATUS_ICONS.WARNING}
            size={typography.secondary}
            color={colors.warning}
          />
          {' 仅供裁判及观战者参考'}
        </Text>

        {/* Action summary section */}
        <Text style={styles.sectionTitle}>行动摘要</Text>
        {data.actionLines.map((line, i) => (
          <Text key={`action-${i}`} style={styles.line}>
            {line}
          </Text>
        ))}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Identity table section */}
        <Text style={styles.sectionTitle}>全员身份</Text>
        {data.identityLines.map((line, i) => (
          <Text key={`identity-${i}`} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    ...textStyles.bodySemibold,
    color: colors.primary,
    marginBottom: spacing.small,
  },
  disclaimer: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  line: {
    fontSize: typography.secondary,
    color: colors.text,
    lineHeight: typography.lineHeights.secondary,
    paddingLeft: spacing.small,
  },
  divider: {
    height: fixed.divider,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
  },
});
