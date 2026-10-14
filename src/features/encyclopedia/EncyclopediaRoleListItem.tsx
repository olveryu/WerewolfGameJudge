/**
 * EncyclopediaRoleListItem — 图鉴角色卡片（自狼人杀 RoleListItem 整段搬入、改吃条目）。
 *
 * Vertical layout: top accent bar + image + role name + ability tag chips.
 * flex: 1 with parent gridRow yields a 2-column equal-width layout.
 * Pure presentational component; no service imports, no business logic.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

import type { EncyclopediaRoleEntry } from './encyclopediaSource';

// ── Types ────────────────────────────────────────────────────

interface EncyclopediaRoleListItemProps {
  entry: EncyclopediaRoleEntry;
  factionColor: string;
  onPress: (roleId: string) => void;
}

// ── Component ────────────────────────────────────────────────

const BADGE_SIZE = componentSizes.avatar.md;

/** Role list card. */
export const EncyclopediaRoleListItem = React.memo<EncyclopediaRoleListItemProps>(
  function EncyclopediaRoleListItem({ entry, factionColor, onPress }) {
    const tags = entry.tags ?? [];

    return (
      <Pressable
        testID={TESTIDS.encyclopediaRoleItem(entry.id)}
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => onPress(entry.id)}
      >
        {/* Top accent bar */}
        <View style={[styles.accentBar, { backgroundColor: factionColor }]} />

        {/* Badge */}
        {entry.listImage !== undefined && <Image source={entry.listImage} style={styles.badge} />}

        {/* Name */}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {entry.displayName}
        </Text>

        {/* Tag chips */}
        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.map((tag) => {
              const tagColor = colors[tag.colorKey];
              return (
                <View
                  key={tag.key}
                  style={[styles.tagChip, { backgroundColor: withAlpha(tagColor, 0.12) }]}
                >
                  <Text style={[styles.tagChipText, { color: tagColor }]}>{tag.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    );
  },
);

// ── Styles ───────────────────────────────────────────────────

const ACCENT_BAR_HEIGHT = 3;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    overflow: 'hidden',
    paddingBottom: spacing.small,
    ...shadows.sm,
  },
  accentBar: {
    width: '100%',
    height: ACCENT_BAR_HEIGHT,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    marginTop: spacing.small,
  },
  name: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.tight,
    paddingHorizontal: spacing.small,
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.tight,
    marginTop: spacing.tight,
    paddingHorizontal: spacing.small,
  },
  tagChip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
  },
  tagChipText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.medium,
  },
});
