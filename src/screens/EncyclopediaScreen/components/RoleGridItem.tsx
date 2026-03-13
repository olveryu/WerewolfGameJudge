/**
 * RoleGridItem - 角色图鉴 2 列信息卡片
 *
 * 展示角色 badge、名称、阵营色竖条、功能标签、难度标签、一句话摘要。
 * 纯展示组件，接收 styles prop，不 import service，不含业务逻辑。
 */
import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import React from 'react';
import {
  Image,
  type ImageStyle,
  Pressable,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { TESTIDS } from '@/testids';
import { type ThemeColors, withAlpha } from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

import { DIFFICULTY_LABELS, getRoleCategoryMeta } from '../data/roleCategories';

// ============================================
// Types
// ============================================

export interface RoleGridItemStyles {
  card: ViewStyle;
  cardInner: ViewStyle;
  factionBar: ViewStyle;
  badgeImage: ImageStyle;
  headerRow: ViewStyle;
  nameText: TextStyle;
  emojiText: TextStyle;
  tagRow: ViewStyle;
  factionChip: ViewStyle;
  factionChipText: TextStyle;
  difficultyChip: ViewStyle;
  difficultyChipText: TextStyle;
  summaryText: TextStyle;
}

interface RoleGridItemProps {
  roleId: RoleId;
  factionColor: string;
  itemWidth: number;
  onPress: (roleId: RoleId) => void;
  colors: ThemeColors;
  styles: RoleGridItemStyles;
  isFavorite?: boolean;
}

// ============================================
// Component
// ============================================

export const RoleGridItem = React.memo<RoleGridItemProps>(function RoleGridItem({
  roleId,
  factionColor,
  itemWidth,
  onPress,
  colors,
  styles,
  isFavorite,
}) {
  const spec = ROLE_SPECS[roleId];
  const meta = getRoleCategoryMeta(roleId);
  const badgeSource = getRoleBadge(roleId);
  const difficultyLabel = DIFFICULTY_LABELS[meta.difficulty];

  return (
    <Pressable
      testID={TESTIDS.encyclopediaRoleItem(roleId)}
      style={[styles.card, { width: itemWidth }]}
      onPress={() => onPress(roleId)}
    >
      {/* 左侧阵营色竖条 */}
      <View style={[styles.factionBar, { backgroundColor: factionColor }]} />

      <View style={styles.cardInner}>
        {/* 顶部：Badge + 名称 + Emoji */}
        <View style={styles.headerRow}>
          <Image source={badgeSource} style={styles.badgeImage} resizeMode="contain" />
          <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
            {spec.displayName}
          </Text>
          <Text style={styles.emojiText}>{spec.emoji}</Text>
          {isFavorite && <Text style={styles.emojiText}>⭐</Text>}
        </View>

        {/* 标签行：功能标签 + 难度 */}
        <View style={styles.tagRow}>
          <View style={[styles.factionChip, { backgroundColor: withAlpha(factionColor, 0.12) }]}>
            <Text style={[styles.factionChipText, { color: factionColor }]}>
              {meta.functionTag}
            </Text>
          </View>
          <View
            style={[styles.difficultyChip, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
          >
            <Text style={[styles.difficultyChipText, { color: colors.textSecondary }]}>
              {difficultyLabel}
            </Text>
          </View>
        </View>

        {/* 一句话摘要 */}
        <Text style={[styles.summaryText, { color: colors.textSecondary }]} numberOfLines={2}>
          {spec.description}
        </Text>
      </View>
    </Pressable>
  );
});
