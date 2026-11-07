/** A ranking: rank badge, seat medal, name with an optional tag, score. Ranks come from the game. */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_PALETTE, REPORT_SWATCHES } from '../reportTheme';
import type { ReviewBlock } from '../types';
import { ReviewTag, SeatMedal } from './ReviewAtoms';

type ScoreboardBlock = Extract<ReviewBlock, { readonly kind: 'scoreboard' }>;

/** The podium: the first three ranks wear the highlight swatch. */
const PODIUM_RANK_LIMIT = 3;

export function ReviewScoreboardBlock({ block }: { readonly block: ScoreboardBlock }) {
  return (
    <View>
      {block.rows.map((row) => {
        const swatch = REPORT_SWATCHES[row.rank <= PODIUM_RANK_LIMIT ? 'highlight' : 'neutral'];
        return (
          <View key={row.seat} style={styles.row}>
            <View style={[styles.rank, { backgroundColor: swatch.bg, borderColor: swatch.border }]}>
              <Text style={[styles.rankText, { color: swatch.text }]}>{row.rank}</Text>
            </View>
            <SeatMedal seat={row.seat} size="inline" tone="neutral" isStamped={false} />
            <Text style={styles.name} numberOfLines={1}>
              {row.name}
            </Text>
            {row.tag !== null && <ReviewTag text={row.tag.text} tone={row.tag.tone} />}
            <Text style={styles.score}>{row.scoreText}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small,
    borderBottomWidth: fixed.divider,
    borderBottomColor: REPORT_PALETTE.divider,
  },
  rank: {
    minWidth: spacing.large,
    paddingHorizontal: spacing.tight,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    alignItems: 'center',
  },
  rankText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  name: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  score: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
});
