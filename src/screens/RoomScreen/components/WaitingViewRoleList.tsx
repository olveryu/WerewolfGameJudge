/**
 * WaitingViewRoleList.tsx - Shows players who haven't viewed their roles
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, shadows, type ThemeColors } from '../../../theme';

export interface WaitingViewRoleListProps {
  /** Seat numbers (0-indexed) of players who haven't viewed roles */
  seatIndices: number[];
}

export const WaitingViewRoleList: React.FC<WaitingViewRoleListProps> = ({ seatIndices }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (seatIndices.length === 0) {
    return null;
  }

  // Convert 0-indexed to 1-indexed for display
  const seatNumbers = seatIndices.map((s) => `${s + 1}号`).join(', ');

  return (
    <View style={styles.actionLogContainer}>
      <Text style={styles.actionLogTitle}>⏳ 等待查看身份</Text>
      <Text style={styles.actionLogItem}>{seatNumbers}</Text>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionLogContainer: {
      marginTop: spacing.medium,
      marginHorizontal: spacing.medium,
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      ...shadows.sm,
    },
    actionLogTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.small,
    },
    actionLogItem: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      paddingVertical: spacing.tight / 2, // ~2
    },
  });
}

export default WaitingViewRoleList;
