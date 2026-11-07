/** Railed groups: a colored rail, a title with an optional tag, rows, and a footnote. */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_ACCENT_COLORS, REPORT_PALETTE } from '../reportTheme';
import type { ReviewBlock, ReviewGroup } from '../types';
import { ReviewInlineLine, ReviewTag } from './ReviewAtoms';

type GroupsBlock = Extract<ReviewBlock, { readonly kind: 'groups' }>;

function Group({ group }: { readonly group: ReviewGroup }) {
  return (
    <View style={styles.group}>
      <View style={[styles.rail, { backgroundColor: REPORT_ACCENT_COLORS[group.railTone] }]} />
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>{group.title}</Text>
          {group.tag !== null && <ReviewTag text={group.tag.text} tone={group.tag.tone} />}
        </View>
        {group.rows.map((row, index) => (
          <View key={index} style={row.isDimmed ? styles.dimmed : null}>
            <ReviewInlineLine inlines={row.cells} textStyle={styles.rowText} />
          </View>
        ))}
        {group.footnote !== null && <Text style={styles.footnote}>{group.footnote}</Text>}
      </View>
    </View>
  );
}

export function ReviewGroupsBlock({ block }: { readonly block: GroupsBlock }) {
  return (
    <View style={styles.list}>
      {block.groups.map((group, index) => (
        <Group key={index} group={group} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.small,
  },
  group: {
    flexDirection: 'row',
    borderWidth: fixed.borderWidth,
    borderColor: REPORT_PALETTE.cardBorder,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  rail: {
    width: spacing.tight + spacing.micro,
  },
  inner: {
    flex: 1,
    minWidth: 0,
    padding: spacing.medium,
    gap: spacing.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  title: {
    flexShrink: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  rowText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: REPORT_PALETTE.text,
  },
  dimmed: {
    opacity: fixed.disabledOpacity,
  },
  footnote: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textMuted,
  },
});
