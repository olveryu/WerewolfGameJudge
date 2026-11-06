/**
 * RoomProgressIndicator - Shows game-provided room progress.
 *
 * Displays the current step, total steps, and an optional game-owned label.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import { type RoomProgressIndicatorStyles } from './styles';

interface RoomProgressIndicatorProps {
  /** Current step index (1-based for display) */
  currentStep: number;
  /** Total number of steps in the active sequence */
  totalSteps: number;
  /** Optional game-owned label for the current step. */
  currentLabel?: string;
  /** Pre-created styles from parent */
  styles: RoomProgressIndicatorStyles;
}

const RoomProgressIndicatorComponent: React.FC<RoomProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  currentLabel,
  styles,
}) => {
  // Calculate progress percentage
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <View style={styles.container} testID={TESTIDS.roomProgressIndicator}>
      <View style={styles.headerRow}>
        <Text style={styles.stepText}>
          第{currentStep}步 / 共{totalSteps}步
        </Text>
        {currentLabel && <Text style={styles.labelText}>{currentLabel}</Text>}
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

export const RoomProgressIndicator = memo(RoomProgressIndicatorComponent);

RoomProgressIndicator.displayName = 'RoomProgressIndicator';
