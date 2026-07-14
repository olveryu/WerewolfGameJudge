/**
 * HintWithWarning — bottom mutually-exclusive hint / warning text region.
 *
 * Shared bottom text UI for all reveal effects: replaces hintText when autoTimeoutWarning is active.
 * Does not import services; contains no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { crossPlatformTextShadow } from '@/theme';

const WARNING_COLOR = 'rgba(255, 200, 50, 0.9)';
const DEFAULT_HINT_COLOR = 'rgba(255, 255, 255, 0.85)';

interface HintWithWarningProps {
  /** Current phase hint text; null = no hint to show */
  hintText: string | null;
  /** Auto-timeout warning active (from useAutoTimeout) */
  showWarning: boolean;
  /** Optional style override for hint text */
  hintTextStyle?: StyleProp<TextStyle>;
}

export const HintWithWarning: React.FC<HintWithWarningProps> = ({
  hintText,
  showWarning,
  hintTextStyle,
}) => {
  if (showWarning) {
    return (
      <View style={styles.container}>
        <Text style={styles.warningText}>
          <Ionicons name="hourglass-outline" size={18} color={WARNING_COLOR} /> 即将自动揭晓…
        </Text>
      </View>
    );
  }

  if (hintText) {
    return (
      <View style={styles.container}>
        <Text style={[styles.hintText, hintTextStyle]}>{hintText}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  hintText: {
    fontSize: 20,
    fontWeight: '700',
    color: DEFAULT_HINT_COLOR,
    textAlign: 'center',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
  warningText: {
    fontSize: 18,
    fontWeight: '600',
    color: WARNING_COLOR,
    textAlign: 'center',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
});
