/**
 * NightProgressIndicator.tsx - Shows night phase progress
 *
 * Displays current step number and total steps based on the active night plan.
 * Only visible during ongoing game (status === 'ongoing').
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';

export interface NightProgressIndicatorProps {
  /** Current step index (1-based for display) */
  currentStep: number;
  /** Total number of steps in the night plan */
  totalSteps: number;
  /** Optional: current role name for display */
  currentRoleName?: string;
}

export const NightProgressIndicator: React.FC<NightProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  currentRoleName,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Calculate progress percentage
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <View style={styles.container} testID={TESTIDS.nightProgressIndicator}>
      <View style={styles.headerRow}>
        <Text style={styles.stepText}>
          步骤 {currentStep}/{totalSteps}
        </Text>
        {currentRoleName && <Text style={styles.roleText}>{currentRoleName}</Text>}
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.tight,
    },
    stepText: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: colors.text,
    },
    roleText: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
    },
    progressBarContainer: {
      height: spacing.tight, // 4
      backgroundColor: colors.border,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
  });
}

export default NightProgressIndicator;
