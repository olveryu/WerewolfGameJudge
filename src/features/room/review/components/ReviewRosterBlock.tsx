/**
 * The identity wall. Two columns hold role-only rows (the werewolf
 * roster); one column holds named rows with the role under the name.
 */

import { StyleSheet, Text, View } from 'react-native';

import { fixed, spacing, typography } from '@/theme';

import { REPORT_PALETTE, REPORT_TEXT_COLORS } from '../reportTheme';
import type { ReviewBlock, ReviewRosterRow } from '../types';
import { SeatMedal } from './ReviewAtoms';

type RosterBlock = Extract<ReviewBlock, { readonly kind: 'roster' }>;

function RosterRow({ row, columns }: { readonly row: ReviewRosterRow; readonly columns: 1 | 2 }) {
  const outText = row.isOut ? styles.struck : null;
  return (
    <View style={[styles.row, columns === 2 ? styles.halfRow : null]}>
      <SeatMedal seat={row.seat} size="roster" tone={row.seatTone} isStamped={false} />
      {row.name === null ? (
        <Text style={[styles.primary, styles.fill, outText]} numberOfLines={1}>
          {row.role}
        </Text>
      ) : (
        <View style={styles.identity}>
          <Text style={[styles.primary, outText]} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.role}>{row.role}</Text>
        </View>
      )}
      <Text
        style={[
          styles.status,
          { color: REPORT_TEXT_COLORS[row.statusTone] },
          row.isOut ? styles.statusOut : null,
        ]}
      >
        {row.status}
      </Text>
    </View>
  );
}

export function ReviewRosterBlock({ block }: { readonly block: RosterBlock }) {
  return (
    <View style={block.columns === 2 ? styles.grid : null}>
      {block.rows.map((row) => (
        <RosterRow key={row.seat} row={row} columns={block.columns} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small - spacing.micro,
    borderBottomWidth: fixed.divider,
    borderBottomColor: REPORT_PALETTE.divider,
  },
  halfRow: {
    width: '50%',
    paddingHorizontal: spacing.small,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  fill: {
    flex: 1,
  },
  primary: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  struck: {
    color: REPORT_PALETTE.textMuted,
    textDecorationLine: 'line-through',
  },
  role: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textSecondary,
  },
  status: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.semibold,
  },
  statusOut: {
    fontWeight: typography.weights.bold,
  },
});
