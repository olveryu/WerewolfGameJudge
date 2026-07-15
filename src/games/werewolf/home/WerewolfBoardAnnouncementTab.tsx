/** Werewolf board release tab contributed to the product announcement modal. */

import Ionicons from '@expo/vector-icons/Ionicons';
import {
  PRESET_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameAnnouncementTabContentProps } from '@/features/home/model/GameHomeContribution';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

import { getWerewolfBoardsByVersion, WEREWOLF_BOARD_VERSIONS_DESC } from './boardAnnouncements';

const CATEGORY_COLOR: Readonly<Record<TemplateCategory, string>> = {
  [TemplateCategory.Classic]: colors.god,
  [TemplateCategory.Advanced]: colors.primary,
  [TemplateCategory.Special]: colors.warning,
  [TemplateCategory.ThirdParty]: colors.third,
};

const COLLAPSE_THRESHOLD = 6;

export const WerewolfBoardAnnouncementTab: React.FC<GameAnnouncementTabContentProps> = ({
  maxHeight,
}) => {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const boardsByVersion = useMemo(() => getWerewolfBoardsByVersion(PRESET_TEMPLATES), []);
  const latestVersion = WEREWOLF_BOARD_VERSIONS_DESC[0];

  return (
    <ScrollView style={[styles.scrollArea, { maxHeight }]} showsVerticalScrollIndicator={false}>
      {boardsByVersion.map(({ version, boards }, groupIndex) => {
        const isLatest = version === latestVersion;
        const shouldCollapse = boards.length >= COLLAPSE_THRESHOLD;
        const isExpanded = expandedVersions.has(version);

        return (
          <View key={version}>
            {groupIndex > 0 && <View style={styles.separator} />}
            <View style={[styles.versionGroup, isLatest && styles.versionGroupLatest]}>
              <View style={styles.versionHeaderRow}>
                <View
                  style={[
                    styles.versionBar,
                    { backgroundColor: isLatest ? colors.primary : colors.border },
                  ]}
                />
                <Text style={styles.versionTitle}>
                  {version === 'v1.0.0' ? 'v1.0.0 首发' : `${version} 新增`}
                </Text>
                {isLatest && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
              </View>

              {shouldCollapse && !isExpanded ? (
                <Pressable
                  style={styles.expandButton}
                  onPress={() => setExpandedVersions((previous) => new Set(previous).add(version))}
                >
                  <Text style={styles.expandButtonText}>展开 {boards.length} 套板子</Text>
                  <Ionicons
                    name="chevron-down"
                    size={componentSizes.icon.xs}
                    color={colors.primary}
                  />
                </Pressable>
              ) : (
                <View style={styles.boardChips}>
                  {boards.map((board) => {
                    const categoryColor = CATEGORY_COLOR[board.category];
                    return (
                      <View key={board.name} style={styles.boardChipRow}>
                        <View style={styles.boardChip}>
                          <Text style={styles.boardChipText}>{board.name}</Text>
                        </View>
                        <Text style={[styles.categoryLabel, { color: categoryColor }]}>
                          {TEMPLATE_CATEGORY_LABELS[board.category]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {shouldCollapse && isExpanded && (
                <Pressable
                  style={styles.expandButton}
                  onPress={() =>
                    setExpandedVersions((previous) => {
                      const next = new Set(previous);
                      next.delete(version);
                      return next;
                    })
                  }
                >
                  <Text style={styles.expandButtonText}>收起</Text>
                  <Ionicons
                    name="chevron-up"
                    size={componentSizes.icon.xs}
                    color={colors.primary}
                  />
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    marginBottom: spacing.small,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
  },
  versionGroup: {
    gap: spacing.small,
  },
  versionGroupLatest: {
    backgroundColor: withAlpha(colors.primary, 0.04),
    borderRadius: borderRadius.small,
    padding: spacing.small,
    marginHorizontal: -spacing.small,
  },
  versionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  versionBar: {
    width: 3,
    height: 14,
    borderRadius: borderRadius.full,
  },
  versionTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  newBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
  },
  newBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  boardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  boardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  boardChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  boardChipText: {
    fontSize: typography.caption,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  categoryLabel: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.medium,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.tight,
  },
  expandButtonText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
