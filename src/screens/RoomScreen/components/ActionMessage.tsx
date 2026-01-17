/**
 * ActionMessage.tsx - Displays the current action prompt/message
 *
 * Uses the real styles from RoomScreen.styles.ts
 */

import React from 'react';
import { Text } from 'react-native';
import { styles } from '../RoomScreen.styles';
import { TESTIDS } from '../../../testids';

export interface ActionMessageProps {
  /** The message to display */
  message: string;
}

export const ActionMessage: React.FC<ActionMessageProps> = ({ message }) => {
  return (
    <Text style={styles.actionMessage} testID={TESTIDS.actionMessage}>
      {message}
    </Text>
  );
};

export default ActionMessage;
