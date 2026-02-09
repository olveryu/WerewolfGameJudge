/**
 * NightProgressIndicator.tsx - Shows night phase progress
 *
 * Displays current step number and total steps based on the active night plan.
 * Only visible during ongoing game (status === 'ongoing').
 *
 * Performance: Memoized, receives pre-created styles from parent.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { type NightProgressIndicatorStyles } from './styles';
import { TESTIDS } from '@/testids';

export interface NightProgressIndicatorProps {
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

export const NightProgressIndicator = memo(NightProgressIndicatorComponent);

NightProgressIndicator.displayName = 'NightProgressIndicator';
