/**
 * EncyclopediaRoleDetailSheet — 图鉴角色详情底部 sheet（自狼人杀 RoleDetailSheet 搬入）。
 *
 * 展示 hero（详情图 + 角色名 + 副标题 + 阵营 chip）、能力标签 chips 与
 * 结构化介绍。介绍渲染统一走共享 StructuredDescriptionView（与角色卡同源）；
 * 游戏专属的 hero 附加动作（如狼人杀 AI 攻略 pill）经 headerExtra 插槽注入。
 * Pure presentation component, does not import service, no business logic.
 */
import type React from 'react';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { StructuredDescriptionView } from '@/features/room/components/StructuredDescriptionView';
import {
  borderRadius,
  colors,
  componentSizes,
  createSharedStyles,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import type { EncyclopediaRoleEntry } from './encyclopediaSource';

// ── Types ────────────────────────────────────────────────────

interface EncyclopediaRoleDetailSheetProps {
  /** 要展示的角色条目；null 时不渲染。 */
  entry: EncyclopediaRoleEntry | null;
  onClose: () => void;
  /** hero 区右上附加动作插槽（游戏专属，如 AI 攻略入口）；缺省不显。 */
  headerExtra?: (entry: EncyclopediaRoleEntry, onClose: () => void) => React.ReactNode;
}

// ── Component ────────────────────────────────────────────────

const HERO_BADGE_SIZE = componentSizes.avatar.xl;

/** Role detail bottom sheet. */
export const EncyclopediaRoleDetailSheet: React.FC<EncyclopediaRoleDetailSheetProps> = ({
  entry,
  onClose,
  headerExtra,
}) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [insets.bottom]);

  if (!entry) return null;

  const factionColor = colors[entry.factionColorKey];
  const tags = entry.tags ?? [];

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      {/* Overlay backdrop */}
      <Pressable style={styles.overlay} onPress={onClose} />

      {/* Sheet container */}
      <View style={styles.sheetContainer}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scrollContent}>
            {/* Hero section */}
            <View style={[styles.heroSection, { backgroundColor: withAlpha(factionColor, 0.06) }]}>
              {entry.detailImage !== undefined && (
                <Image source={entry.detailImage} style={styles.heroBadge} />
              )}
              <View style={styles.heroInfo}>
                <Text style={[styles.heroName, { color: colors.text }]}>{entry.displayName}</Text>
                {entry.subtitle ? (
                  <Text style={[styles.heroEnglishName, { color: colors.textSecondary }]}>
                    {entry.subtitle}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.heroFactionChip,
                    { backgroundColor: withAlpha(factionColor, 0.15) },
                  ]}
                >
                  <Text style={[styles.heroFactionText, { color: factionColor }]}>
                    {entry.factionLabel}
                  </Text>
                </View>
              </View>
              {/* 游戏专属附加动作（如 AI 攻略 pill） */}
              {headerExtra?.(entry, onClose)}
            </View>

            {/* Ability Tags */}
            {tags.length > 0 && (
              <View style={styles.tagsSection}>
                {tags.map((tag) => {
                  const tagColor = colors[tag.colorKey];
                  return (
                    <View
                      key={tag.key}
                      style={[styles.detailTagChip, { backgroundColor: withAlpha(tagColor, 0.12) }]}
                    >
                      <Text style={[styles.detailTagText, { color: tagColor }]}>{tag.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Description */}
            <View style={styles.descriptionSection}>
              <StructuredDescriptionView
                fields={entry.structuredFields}
                descriptionFallback={entry.description ?? ''}
                factionColor={factionColor}
                scrollEnabled={false}
              />
            </View>

            {/* Action button */}
            <Button variant="primary" buttonColor={factionColor} onPress={onClose}>
              知道了
            </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ───────────────────────────────────────────────────

function createStyles(colors: ThemeColors, bottomInset: number) {
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    sheetContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '85%',
    },
    sheet: {
      ...shared.sheetBase,
      ...shadows.lg,
      maxHeight: '100%',
    },
    handle: {
      ...shared.sheetHandle,
    },
    scrollContent: {
      paddingBottom: Math.max(spacing.medium, bottomInset + spacing.small),
    },
    // Hero
    heroSection: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.medium,
    },
    heroBadge: {
      width: HERO_BADGE_SIZE,
      height: HERO_BADGE_SIZE,
    },
    heroInfo: {
      flex: 1,
      marginLeft: spacing.medium,
      alignItems: 'flex-start',
    },
    heroName: {
      ...textStyles.titleBold,
    },
    heroEnglishName: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      marginTop: spacing.micro,
    },
    heroFactionChip: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
      marginTop: spacing.tight,
    },
    heroFactionText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.semibold,
    },
    // Tags
    tagsSection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    detailTagChip: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
    },
    detailTagText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
    },
    // Description
    descriptionSection: {
      marginBottom: spacing.medium,
    },
  });
}
