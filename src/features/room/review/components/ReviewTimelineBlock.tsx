/**
 * Ordered steps behind a dotted rail. A neutral step wears the hollow dot
 * of the werewolf night timeline; a toned step fills its dot with the
 * tone's accent. The content's bottom padding carries the rail across the
 * gap to the next dot, so the rail reads as one continuous line.
 */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_ACCENT_COLORS, REPORT_PALETTE } from '../reportTheme';
import type { ReviewBlock, ReviewTimelineStep } from '../types';
import { ReviewInlineLine } from './ReviewAtoms';

type TimelineBlock = Extract<ReviewBlock, { readonly kind: 'timeline' }>;

function TimelineStep({
  step,
  isLast,
}: {
  readonly step: ReviewTimelineStep;
  readonly isLast: boolean;
}) {
  const isHollow = step.tone === 'neutral';
  const accent = REPORT_ACCENT_COLORS[step.tone];
  return (
    <View style={styles.row}>
      <View style={styles.railColumn}>
        <View
          style={[
            styles.dot,
            { borderColor: accent, backgroundColor: isHollow ? REPORT_PALETTE.background : accent },
          ]}
        />
        {!isLast && <View style={styles.rail} />}
      </View>
      <View style={[styles.content, isLast ? null : styles.contentSpaced]}>
        {step.title !== null && <Text style={styles.title}>{step.title}</Text>}
        {step.lines.map((line, index) => (
          <ReviewInlineLine key={index} inlines={line} textStyle={styles.lineText} />
        ))}
      </View>
    </View>
  );
}

export function ReviewTimelineBlock({ block }: { readonly block: TimelineBlock }) {
  return (
    <View>
      {block.steps.map((step, index) => (
        <TimelineStep key={index} step={step} isLast={index === block.steps.length - 1} />
      ))}
    </View>
  );
}

const DOT_SIZE = spacing.small + spacing.tight;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  railColumn: {
    width: DOT_SIZE,
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    marginTop: spacing.tight,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
  },
  rail: {
    flex: 1,
    width: fixed.divider,
    backgroundColor: REPORT_PALETTE.divider,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.tight,
  },
  contentSpaced: {
    paddingBottom: spacing.small,
  },
  title: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  lineText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: REPORT_PALETTE.text,
  },
});
