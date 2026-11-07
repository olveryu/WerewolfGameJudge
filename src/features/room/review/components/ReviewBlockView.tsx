/**
 * The block switch. Every kind of the closed vocabulary renders here; the
 * declared return type makes a kind without a renderer a type error. The
 * small blocks (section, divider, stats, facts, paragraph) live inline.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_PALETTE } from '../reportTheme';
import type { ReviewBlock } from '../types';
import { ReviewGroupsBlock } from './ReviewGroupsBlock';
import { ReviewHeroBlock } from './ReviewHeroBlock';
import { ReviewImageBlock } from './ReviewImageBlock';
import { ReviewRosterBlock } from './ReviewRosterBlock';
import { ReviewScoreboardBlock } from './ReviewScoreboardBlock';
import { ReviewTimelineBlock } from './ReviewTimelineBlock';

export function ReviewBlockView({
  block,
  blockId,
}: {
  readonly block: ReviewBlock;
  /** Page-unique block identity, `${pageKey}/${index}`. */
  readonly blockId: string;
}): React.ReactElement {
  switch (block.kind) {
    case 'hero':
      return <ReviewHeroBlock block={block} />;
    case 'stats':
      return (
        <View style={styles.stats}>
          {block.items.map((item) => (
            <View key={item.label} style={styles.stat}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      );
    case 'section':
      return (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {block.title}
          </Text>
          <View style={styles.sectionRule} />
        </View>
      );
    case 'divider':
      return <View style={styles.perforation} />;
    case 'groups':
      return <ReviewGroupsBlock block={block} />;
    case 'roster':
      return <ReviewRosterBlock block={block} />;
    case 'facts':
      return (
        <View style={styles.facts}>
          {block.items.map((item) => (
            <View key={item.label} style={styles.fact}>
              <Text style={styles.factLabel}>{item.label}</Text>
              <Text style={styles.factValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      );
    case 'timeline':
      return <ReviewTimelineBlock block={block} />;
    case 'scoreboard':
      return <ReviewScoreboardBlock block={block} />;
    case 'paragraph':
      return (
        <View style={styles.captioned}>
          {block.caption !== null && <Text style={styles.caption}>{block.caption}</Text>}
          <Text style={[styles.paragraph, block.isMissing ? styles.paragraphMissing : null]}>
            {block.text}
          </Text>
        </View>
      );
    case 'image':
      return <ReviewImageBlock block={block} blockId={blockId} />;
  }
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    borderWidth: fixed.borderWidth,
    borderColor: REPORT_PALETTE.cardBorder,
    borderRadius: borderRadius.small,
    paddingVertical: spacing.small,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  statLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textMuted,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  sectionTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: spacing.micro,
    color: REPORT_PALETTE.text,
  },
  sectionRule: {
    flex: 1,
    height: fixed.divider,
    backgroundColor: REPORT_PALETTE.cardBorder,
  },
  perforation: {
    borderTopWidth: fixed.borderWidthThick,
    borderTopColor: REPORT_PALETTE.cardBorder,
    borderStyle: 'dashed',
    marginTop: spacing.small,
  },
  facts: {
    gap: spacing.small,
  },
  fact: {
    flexDirection: 'row',
    gap: spacing.medium,
  },
  factLabel: {
    width: '30%',
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: REPORT_PALETTE.textMuted,
  },
  factValue: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: REPORT_PALETTE.text,
  },
  captioned: {
    gap: spacing.tight,
  },
  caption: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textSecondary,
  },
  paragraph: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: REPORT_PALETTE.text,
  },
  paragraphMissing: {
    color: REPORT_PALETTE.textMuted,
    fontStyle: 'italic',
  },
});
