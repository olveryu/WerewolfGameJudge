/**
 * StageSettleRescue — the one host self-rescue / waiting display for an
 * overdue stage deadline (D3 follow-up).
 *
 * The overdue decision lives once in `useStageDeadline` (`isOverdue`:
 * deadline passed + `SETTLE_RETRY_GRACE_MS`); this component only
 * renders it. It shows nothing while the countdown is running or while
 * there is no deadline. Once overdue it shows the game's waiting
 * sentence; the host additionally gets a retry button that re-drives
 * the current phase's settle through the game's existing settle
 * dispatch (`<game>.phase.retrySettle`). Non-hosts see a
 * waiting-for-host hint, never the button. The retry is not an expire
 * send. A rejection surfaces through the room's existing submit
 * pipeline (the game's failure message), a transport failure through
 * its error pipeline — this component adds no feedback of its own.
 *
 * Content layer: the sentences are props — each game passes its own.
 * (The pre-grace waiting text, `remainingSeconds === 0` before the
 * grace elapses, lands in the C commit; this commit renders only the
 * overdue states.)
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing, textStyles } from '@/theme';

interface StageSettleRescueProps {
  /** Remaining whole seconds; null without a deadline. */
  readonly remainingSeconds: number | null;
  /** From `useStageDeadline`: the deadline passed and the grace elapsed. */
  readonly isOverdue: boolean;
  /** Only the host sees the retry button. */
  readonly isHost: boolean;
  /** The room session's in-flight flag: shows the button spinner while the retry is in flight. */
  readonly isRetrying: boolean;
  /** Submits the game's `<game>.phase.retrySettle` command. */
  readonly onRetry: () => void;
  /** Per-game sentence shown once the settle is overdue. */
  readonly waitingLabel: string;
  /** Retry button label; defaults to '重新推进'. */
  readonly retryLabel?: string;
  /** Hint for non-hosts once overdue; defaults to '等待房主处理'. */
  readonly waitingForHostLabel?: string;
}

export const StageSettleRescue: React.FC<StageSettleRescueProps> = ({
  remainingSeconds,
  isOverdue,
  isHost,
  isRetrying,
  onRetry,
  waitingLabel,
  retryLabel = '重新推进',
  waitingForHostLabel = '等待房主处理',
}) => {
  if (remainingSeconds === null || remainingSeconds > 0 || !isOverdue) return null;
  return (
    <View style={styles.container} testID={TESTIDS.stageSettleRescue}>
      <Text style={styles.waiting}>{waitingLabel}</Text>
      {isHost ? (
        <Button
          variant="secondary"
          size="sm"
          loading={isRetrying}
          onPress={onRetry}
          testID={TESTIDS.stageSettleRescueRetryButton}
          accessibilityLabel={retryLabel}
          icon={
            <Ionicons name="refresh-outline" size={componentSizes.icon.sm} color={colors.primary} />
          }
        >
          {retryLabel}
        </Button>
      ) : (
        <Text style={styles.hint}>{waitingForHostLabel}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  waiting: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    flex: 1,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
});
