/**
 * ActionMessage.tsx - Displays the current action prompt/message
 */
import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, type ThemeColors } from '../../../theme';
import { TESTIDS } from '../../../testids';

export interface ActionMessageProps {
  /** The message to display */
  message: string;
}

export const ActionMessage: React.FC<ActionMessageProps> = ({ message }) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Text style={styles.actionMessage} testID={TESTIDS.actionMessage}>
      {message}
    </Text>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionMessage: {
      textAlign: 'center',
      fontSize: typography.body,
      color: colors.text,
      marginTop: spacing.medium,
      marginBottom: spacing.small,
      paddingHorizontal: spacing.medium,
    },
  });
}

export default ActionMessage;
