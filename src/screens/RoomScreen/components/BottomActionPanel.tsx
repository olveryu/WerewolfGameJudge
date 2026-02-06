/**
 * BottomActionPanel.tsx - Floating bottom action panel
 *
 * A card-like panel fixed at the bottom of RoomScreen that combines
 * the action message prompt and action buttons into a unified,
 * visually distinct section with rounded top corners and shadow.
 *
 * This component is purely presentational:
 * - Renders message + button children
 * - No business logic, no service imports
 */
import React, { useMemo, memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';

export interface BottomActionPanelProps {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Button elements (ActionButton, HostControlButtons, etc.) */
  children: React.ReactNode;
}

const BottomActionPanelComponent: React.FC<BottomActionPanelProps> = ({
  message,
  showMessage = false,
  children,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Don't render if there's nothing to show
  const hasButtons = React.Children.count(children) > 0;
  if (!hasButtons && !showMessage) return null;

  return (
    <View style={styles.container} testID={TESTIDS.bottomActionPanel}>
      {/* Action Message */}
      {showMessage && message ? (
        <Text style={styles.message} testID={TESTIDS.actionMessage}>
          {message}
        </Text>
      ) : null}

      {/* Button Row */}
      {hasButtons && <View style={styles.buttonRow}>{children}</View>}
    </View>
  );
};

export const BottomActionPanel = memo(BottomActionPanelComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingTop: spacing.medium,
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.xlarge,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      // Shadow for elevation effect
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        android: {
          elevation: 8,
        },
        web: {
          boxShadow: '0 -3px 12px rgba(0, 0, 0, 0.08)',
        },
      }),
    },
    message: {
      textAlign: 'center',
      fontSize: typography.body,
      color: colors.text,
      marginBottom: spacing.small,
      paddingHorizontal: spacing.small,
      lineHeight: typography.body * 1.4,
    },
    buttonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.small,
    },
  });
}

export default BottomActionPanel;
