/** Shared visual frame for one active Pictionary task or reveal state. */

import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CountdownPill } from '@/features/room/components/CountdownPill';
import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { TESTIDS } from '@/testids';
import { colors, spacing, textStyles } from '@/theme';

export const PICTIONARY_STAGE_MAX_WIDTH = 430;

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
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <CountdownPill remainingSeconds={remainingSeconds} zeroLabel="切换中" />
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content} testID={TESTIDS.pictionaryStageFrame}>
        <PictionaryStageHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          remainingSeconds={remainingSeconds}
        />
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
    maxWidth: PICTIONARY_STAGE_MAX_WIDTH,
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
    color: colors.textSecondary,
  },
  title: { ...roomSurfaceStyles.title, marginTop: spacing.tight },
  description: { ...textStyles.secondary, color: colors.textSecondary, marginTop: spacing.tight },
});
