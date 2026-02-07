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
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { TESTIDS } from '../../../testids';
import { type BottomActionPanelStyles } from './styles';

export interface BottomActionPanelProps {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Button elements (ActionButton, HostControlButtons, etc.) */
  children: React.ReactNode;
  /** Pre-created styles from parent */
  styles: BottomActionPanelStyles;
}

const BottomActionPanelComponent: React.FC<BottomActionPanelProps> = ({
  message,
  showMessage = false,
  children,
  styles,
}) => {
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

BottomActionPanel.displayName = 'BottomActionPanel';
