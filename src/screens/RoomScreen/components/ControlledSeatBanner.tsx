/**
 * ControlledSeatBanner.tsx - Debug mode banner showing currently controlled bot seat
 *
 * Shows a banner at the top of the screen when Host is controlling a bot seat.
 * Also shows a hint banner when no bot is controlled but bots are present.
 * Allows quick release of control.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { useColors, type ThemeColors, spacing, typography, borderRadius } from '../../../theme';

export interface ControlledSeatBannerStyles {
  container: ViewStyle;
  hintContainer: ViewStyle;
  text: TextStyle;
  hintText: TextStyle;
  releaseButton: ViewStyle;
  releaseButtonText: TextStyle;
}

export interface ControlledSeatBannerProps {
  /** Mode: 'hint' shows takeover hint, 'controlled' shows controlled bot */
  mode: 'hint' | 'controlled';
  /** The seat number being controlled (0-indexed, display as 1-indexed) - required when mode='controlled' */
  controlledSeat?: number;
  /** Display name of the bot being controlled - required when mode='controlled' */
  botDisplayName?: string;
  /** Callback when user wants to release control - required when mode='controlled' */
  onRelease?: () => void;
}

const ControlledSeatBannerComponent: React.FC<ControlledSeatBannerProps> = ({
  mode,
  controlledSeat,
  botDisplayName,
  onRelease,
}) => {
  const colors = useColors();
  const styles = createStyles(colors);

  if (mode === 'hint') {
    return (
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>💡 长按座位可接管机器人</Text>
      </View>
    );
  }

  // mode='controlled': controlledSeat must be a valid number (caller guarantees this)
  // Fail-fast: if controlledSeat is undefined, don't render garbage
  if (controlledSeat === undefined) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        🎮 正在操控 {controlledSeat + 1} 号位（{botDisplayName}）
      </Text>
      <TouchableOpacity style={styles.releaseButton} onPress={onRelease}>
        <Text style={styles.releaseButtonText}>退出</Text>
      </TouchableOpacity>
    </View>
  );
};

function createStyles(colors: ThemeColors): ControlledSeatBannerStyles {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      marginBottom: spacing.small,
      borderRadius: borderRadius.medium,
    },
    hintContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warning,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      marginBottom: spacing.small,
      borderRadius: borderRadius.medium,
    },
    text: {
      fontSize: typography.secondary,
      color: colors.textInverse,
      fontWeight: '600',
      flex: 1,
    },
    hintText: {
      fontSize: typography.secondary,
      color: colors.textInverse,
      fontWeight: '600',
    },
    releaseButton: {
      backgroundColor: colors.surface,
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.small,
      borderRadius: borderRadius.small,
    },
    releaseButtonText: {
      fontSize: typography.caption,
      color: colors.text,
      fontWeight: '600',
    },
  });
}

export const ControlledSeatBanner = memo(ControlledSeatBannerComponent);
export default ControlledSeatBanner;
