/**
 * DisabledReasonCaption — The blocker of a disabled room action,
 * rendered directly under the button so the reason is visible on the
 * same screen instead of only behind a press. Shared by the host
 * management panel and the bottom action panel.
 */
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing, textStyles } from '@/theme';

interface DisabledReasonCaptionProps {
  readonly reason: string;
}

const DisabledReasonCaptionComponent: React.FC<DisabledReasonCaptionProps> = ({ reason }) => {
  return <Text style={styles.caption}>{reason}</Text>;
};

const styles = StyleSheet.create({
  caption: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginTop: spacing.tight,
  },
});

export const DisabledReasonCaption = memo(DisabledReasonCaptionComponent);
DisabledReasonCaption.displayName = 'DisabledReasonCaption';
