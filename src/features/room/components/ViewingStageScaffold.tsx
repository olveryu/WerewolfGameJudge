/**
 * Viewing stage scaffold — the shared shell every identity game
 * renders while its dealt secrets are being viewed and play has not
 * begun (the middle of the deal → view → begin flow). The shell owns
 * only the frame: stage title, viewing progress, an optional hint,
 * and a slot for the game's own card content. Game semantics (what
 * the secret is, who may begin) stay with the game; the host's begin
 * action itself lives in the host management panel, as in werewolf.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';

/** Stage max width, aligned with the per-game stage frames. */
const VIEWING_STAGE_MAX_WIDTH = 430;

export function ViewingStageScaffold({
  title,
  progressLabel,
  hint,
  children,
  testID,
}: {
  readonly title: string;
  /** Short progress summary, e.g. 已查看 3/5. */
  readonly progressLabel: string;
  readonly hint: string | null;
  readonly children?: ReactNode;
  readonly testID?: string;
}) {
  return (
    <View style={styles.outer} testID={testID}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.progress}>{progressLabel}</Text>
        </View>
        <View style={styles.content}>
          {children}
          {hint !== null ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    width: '100%',
    maxWidth: VIEWING_STAGE_MAX_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    gap: spacing.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...textStyles.heading,
    color: colors.text,
  },
  progress: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  content: {
    gap: spacing.small,
  },
  hint: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
});
