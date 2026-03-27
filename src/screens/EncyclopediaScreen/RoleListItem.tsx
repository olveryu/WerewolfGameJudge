/**
 * RoleListItem — 角色图鉴卡片
 *
 * 垂直布局：顶部 badge + 角色名 + 阵营 chip + 能力 tag chips。
 * flex: 1 配合父级 gridRow 实现 2 列等宽。
 * 纯展示组件，不 import service，不含业务逻辑。
 */
import { ROLE_SPECS, type RoleAbilityTag, type RoleId } from '@werewolf/game-engine/models/roles';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { TESTIDS } from '@/testids';
import {
  borderRadius,
  componentSizes,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

import { TAG_COLOR_KEY, TAG_LABELS } from './constants';

// ── Types ────────────────────────────────────────────────────

interface RoleListItemProps {
  roleId: RoleId;
  factionColor: string;
  onPress: (roleId: RoleId) => void;
  colors: ThemeColors;
}

// ── Component ────────────────────────────────────────────────

const BADGE_SIZE = componentSizes.avatar.md;

export const RoleListItem = React.memo<RoleListItemProps>(function RoleListItem({
  roleId,
  factionColor,
  onPress,
  colors,
}) {
  const spec = ROLE_SPECS[roleId];
  const tags = spec.tags ?? [];

  return (
    <Pressable
      testID={TESTIDS.encyclopediaRoleItem(roleId)}
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => onPress(roleId)}
    >
      {/* Top accent bar */}
      <View style={[styles.accentBar, { backgroundColor: factionColor }]} />

      {/* Badge */}
      <Image source={getRoleBadge(roleId)} style={styles.badge} />

      {/* Name */}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {spec.displayName}
      </Text>

      {/* Tag chips */}
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag: RoleAbilityTag) => {
            const tagColor = colors[TAG_COLOR_KEY[tag]];
            return (
              <View
                key={tag}
                style={[styles.tagChip, { backgroundColor: withAlpha(tagColor, 0.12) }]}
              >
                <Text style={[styles.tagChipText, { color: tagColor }]}>{TAG_LABELS[tag]}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
});

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
