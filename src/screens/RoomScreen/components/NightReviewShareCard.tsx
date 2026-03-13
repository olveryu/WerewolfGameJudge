/**
 * NightReviewShareCard - Hidden share card used for battle report screenshot capture.
 *
 * Renders the same content sections as NightReviewModal without actions/overlay.
 */
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View as RNView,
  type View,
} from 'react-native';

import { STATUS_ICONS } from '@/config/iconTokens';
import {
  borderRadius,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
} from '@/theme';

import type { NightReviewData } from '../NightReview.helpers';

interface NightReviewShareCardProps {
  data: NightReviewData;
  roomNumber: string;
}

export const NightReviewShareCard = forwardRef<View, NightReviewShareCardProps>(
  ({ data, roomNumber }, ref) => {
    const colors = useColors();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const styles = useMemo(
      () => createStyles(colors, screenWidth, screenHeight),
      [colors, screenWidth, screenHeight],
    );

    return (
      <RNView ref={ref} collapsable={false} style={styles.card}>
        <Text style={styles.title}>房间 {roomNumber} 战报</Text>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <Text style={styles.disclaimer}>
            <Ionicons
              name={STATUS_ICONS.WARNING}
              size={typography.secondary}
              color={colors.warning}
            />
            {' 仅供裁判及观战者参考'}
          </Text>

          <Text style={styles.sectionTitle}>行动摘要</Text>
          {data.actionLines.map((line, i) => (
            <Text key={`share-action-${i}`} style={styles.line}>
              {line}
            </Text>
          ))}

          <RNView style={styles.divider} />

          <Text style={styles.sectionTitle}>全员身份</Text>
          {data.identityLines.map((line, i) => (
            <Text key={`share-identity-${i}`} style={styles.line}>
              {line}
            </Text>
          ))}
        </ScrollView>
      </RNView>
    );
  },
);

NightReviewShareCard.displayName = 'NightReviewShareCard';

function createStyles(colors: ThemeColors, screenWidth: number, screenHeight: number) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      padding: spacing.large,
      width: screenWidth * 0.88,
      maxHeight: screenHeight * 0.75,
    },
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    scrollView: {
      flexGrow: 0,
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
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      paddingLeft: spacing.small,
    },
    divider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
  });
}
