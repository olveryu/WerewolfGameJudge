/**
 * ActionMessage.tsx - Displays the current action prompt/message
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { Text } from 'react-native';
import { TESTIDS } from '../../../testids';
import { type ActionMessageStyles } from './styles';

export interface ActionMessageProps {
  /** The message to display */
  message: string;
  /** Pre-created styles from parent */
  styles: ActionMessageStyles;
}

function arePropsEqual(prev: ActionMessageProps, next: ActionMessageProps): boolean {
  return prev.message === next.message && prev.styles === next.styles;
}

const ActionMessageComponent: React.FC<ActionMessageProps> = ({ message, styles }) => {
  return (
    <Text style={styles.actionMessage} testID={TESTIDS.actionMessage}>
      {message}
    </Text>
  );
};

export const ActionMessage = memo(ActionMessageComponent, arePropsEqual);

ActionMessage.displayName = 'ActionMessage';
