/** Shared visual frame for one active Pictionary task or reveal state. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fixed, spacing, textStyles, typography } from '@/theme';

const PHONE_STAGE_MAX_WIDTH = 430;

interface PictionaryStageFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly remainingSeconds: number | null;
  readonly children: React.ReactNode;
}

function formatRemainingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export const PictionaryStageFrame: React.FC<PictionaryStageFrameProps> = ({
  eyebrow,
  title,
  description,
  remainingSeconds,
  children,
}) => {
  const isUrgent = remainingSeconds !== null && remainingSeconds <= 10;
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
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
              size={18}
              color={isUrgent ? colors.error : colors.textSecondary}
            />
            <Text style={[styles.timerText, isUrgent && styles.urgentTimerText]}>
              {remainingSeconds === null
                ? '不限时'
                : remainingSeconds === 0
                  ? '切换中'
                  : formatRemainingTime(remainingSeconds)}
            </Text>
          </View>
        </View>
        {children}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.medium },
  content: {
    width: '100%',
    maxWidth: PHONE_STAGE_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.medium,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.medium,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  title: { ...textStyles.headingBold, color: colors.text, marginTop: spacing.tight },
  description: { ...textStyles.secondary, color: colors.textSecondary, marginTop: spacing.tight },
  timer: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  urgentTimer: { borderColor: colors.error },
  timerText: { ...textStyles.secondarySemibold, color: colors.textSecondary },
  urgentTimerText: { color: colors.error },
});
