/** Pictionary waiting-stage frame: shared stage skeleton with this game's pinned heading. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { StageFrame } from '@/features/room/components/StageFrame';
import { formatCountdownSeconds } from '@/features/room/model/formatCountdown';
import { TESTIDS } from '@/testids';
import { colors, spacing, textStyles, withAlpha } from '@/theme';
import { componentSizes } from '@/theme/tokens';

interface PictionaryStageFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly remainingSeconds: number | null;
  readonly children: React.ReactNode;
}

interface PictionaryStageHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly remainingSeconds: number | null;
}

export const PictionaryStageHeading: React.FC<PictionaryStageHeadingProps> = ({
  eyebrow,
  title,
  description,
  remainingSeconds,
}) => {
  const isUrgent = remainingSeconds !== null && remainingSeconds <= 10;
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View
        style={[styles.timer, isUrgent && styles.urgentTimer]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          remainingSeconds === null ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`
        }
      >
        <Ionicons
          name={remainingSeconds === 0 ? 'sync-outline' : 'time-outline'}
          size={componentSizes.icon.sm}
          color={isUrgent ? colors.error : colors.textSecondary}
        />
        <Text style={[styles.timerText, isUrgent && styles.urgentTimerText]}>
          {remainingSeconds === null
            ? '不限时'
            : remainingSeconds === 0
              ? '切换中'
              : formatCountdownSeconds(remainingSeconds)}
        </Text>
      </View>
    </View>
  );
};

export const PictionaryStageFrame: React.FC<PictionaryStageFrameProps> = ({
  eyebrow,
  title,
  description,
  remainingSeconds,
  children,
}) => {
  return (
    <StageFrame
      testID={TESTIDS.pictionaryStageFrame}
      keyboardShouldPersistTaps="handled"
      header={
        <PictionaryStageHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          remainingSeconds={remainingSeconds}
        />
      }
    >
      {children}
    </StageFrame>
  );
};

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  title: { ...roomSurfaceStyles.title, marginTop: spacing.tight },
  description: { ...textStyles.secondary, color: colors.textSecondary, marginTop: spacing.tight },
  timer: roomSurfaceStyles.timer,
  urgentTimer: { backgroundColor: withAlpha(colors.error, 0.15) },
  timerText: roomSurfaceStyles.timerText,
  urgentTimerText: { color: colors.error },
});
