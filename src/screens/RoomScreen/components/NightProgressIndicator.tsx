/**
 * NightProgressIndicator.tsx - Shows night phase progress
 *
 * Displays current step number and total steps based on the active night plan.
 * Only visible during ongoing game (status === Ongoing).
 *
 * Performance: Memoized, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { type NightProgressIndicatorStyles } from './styles';

interface NightProgressIndicatorProps {
  /** Current step index (1-based for display) */
  currentStep: number;
  /** Total number of steps in the night plan */
  totalSteps: number;
  /** Optional: current role name for display */
  currentRoleName?: string;
  /** Pre-created styles from parent */
  styles: NightProgressIndicatorStyles;
}

const NightProgressIndicatorComponent: React.FC<NightProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  currentRoleName,
  styles,
}) => {
  // Calculate progress percentage
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <View style={styles.container} testID={TESTIDS.nightProgressIndicator}>
      <View style={styles.headerRow}>
        <Text style={styles.stepText}>
          第{currentStep}步 / 共{totalSteps}步
        </Text>
        {currentRoleName && <Text style={styles.roleText}>{currentRoleName}</Text>}
      </View>
      <View style={styles.progressBarContainer}>
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
        />
      </View>
    </View>
  );
};

export const NightProgressIndicator = memo(NightProgressIndicatorComponent);

NightProgressIndicator.displayName = 'NightProgressIndicator';
