/** The conclusion block: headline (with an optional display figure), stamped seats, byline. */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_ACCENT_COLORS, REPORT_PALETTE, REPORT_TEXT_COLORS } from '../reportTheme';
import type { ReviewBlock, ReviewStamp } from '../types';
import { SeatMedal } from './ReviewAtoms';

type HeroBlock = Extract<ReviewBlock, { readonly kind: 'hero' }>;

function Stamp({ stamp }: { readonly stamp: ReviewStamp }) {
  return (
    <View style={[styles.stamp, { borderColor: REPORT_ACCENT_COLORS[stamp.tone] }]}>
      <SeatMedal seat={stamp.seat} size="stamp" tone={stamp.tone} isStamped />
      <View style={styles.stampBody}>
        <Text style={styles.stampTitle}>{stamp.title}</Text>
        <Text style={[styles.stampCaption, { color: REPORT_TEXT_COLORS[stamp.tone] }]}>
          {stamp.caption}
        </Text>
        {stamp.note !== null && <Text style={styles.stampNote}>{stamp.note}</Text>}
      </View>
    </View>
  );
}

export function ReviewHeroBlock({ block }: { readonly block: HeroBlock }) {
  return (
    <View style={styles.hero}>
      <Text
        style={[styles.headline, { color: REPORT_TEXT_COLORS[block.tone] }]}
        accessibilityRole="header"
      >
        {block.headline.map((run, index) =>
          run.kind === 'text' ? (
            run.text
          ) : (
            <Text key={index} style={[styles.figure, { color: REPORT_TEXT_COLORS[run.tone] }]}>
              {run.text}
            </Text>
          ),
        )}
      </Text>
      {block.stamps.length > 0 && (
        <View style={styles.stampRow}>
          {block.stamps.map((stamp) => (
            <Stamp key={stamp.seat} stamp={stamp} />
          ))}
        </View>
      )}
      {block.byline !== null && <Text style={styles.byline}>{block.byline}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.medium,
  },
  headline: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
  },
  figure: {
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: typography.weights.bold,
  },
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  stamp: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    borderWidth: fixed.borderWidthThick,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
  },
  stampBody: {
    flex: 1,
  },
  stampTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  stampCaption: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    marginTop: spacing.micro,
  },
  stampNote: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: REPORT_PALETTE.textMuted,
  },
  byline: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: REPORT_PALETTE.textSecondary,
  },
});
