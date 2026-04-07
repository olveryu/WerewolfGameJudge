/**
 * RoleDetailSheet — 角色详情底部面板
 *
 * 底部滑入的 Modal 面板，展示角色完整信息：badge 大图 + 角色名 + 阵营 +
 * structuredDescription（复用 RoleDescriptionView）+ 能力 tag chips。
 * 纯展示组件，不 import service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import {
  getRoleSpec,
  getRoleStructuredDescription,
  isWolfRole,
  type RoleAbilityTag,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import React, { useCallback, useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildRolePlayGuidePrompt } from '@/components/AIChatBubble/rolePlayGuide';
import { Button } from '@/components/Button';
import { RoleDescriptionView } from '@/components/RoleDescriptionView';
import { UI_ICONS } from '@/config/iconTokens';
import { isAIChatReady } from '@/services/feature/AIChatService';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';
import { requestAIChatMessage } from '@/utils/aiChatBridge';
import { showConfirmAlert } from '@/utils/alertPresets';
import { getRoleBadge } from '@/utils/roleBadges';

import { TAG_COLOR_KEY, TAG_LABELS } from './constants';

// ── Helpers ──────────────────────────────────────────────────

function getFactionColor(roleId: RoleId, colors: ThemeColors): string {
  if (isWolfRole(roleId)) return colors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return colors.god;
  if (spec?.faction === Faction.Special) return colors.third;
  return colors.villager;
}

function getFactionLabel(roleId: RoleId): string {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.God) return '神职阵营';
  if (spec?.faction === Faction.Special) return '第三方阵营';
  return '好人阵营';
}

// ── Types ────────────────────────────────────────────────────

interface RoleDetailSheetProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────

const HERO_BADGE_SIZE = componentSizes.avatar.xl;

export const RoleDetailSheet: React.FC<RoleDetailSheetProps> = ({ visible, roleId, onClose }) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);

  const showAIButton = isAIChatReady();

  const handleAskAI = useCallback(() => {
    if (!roleId) return;
    const prompt = buildRolePlayGuidePrompt(roleId);
    if (!prompt) return;
    const spec = getRoleSpec(roleId);
    const roleName = spec?.displayName ?? roleId;
    showConfirmAlert('AI 攻略', `让 AI 分析「${roleName}」的玩法？`, () => {
      onClose();
      requestAIChatMessage({
        fullText: prompt,
        displayText: `${roleName} 攻略`,
        maxTokens: 1024,
      });
    });
  }, [roleId, onClose]);

  if (!visible || !roleId) return null;

  const spec = getRoleSpec(roleId);
  if (!spec) return null;

  const factionColor = getFactionColor(roleId, colors);
  const factionLabel = getFactionLabel(roleId);
  const structuredDesc = getRoleStructuredDescription(roleId);
  const tags = spec.tags ?? [];
  const englishName = 'englishName' in spec ? (spec.englishName as string) : undefined;

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
              <Image source={getRoleBadge(roleId)} style={styles.heroBadge} />
              <View style={styles.heroInfo}>
                <Text style={[styles.heroName, { color: colors.text }]}>{spec.displayName}</Text>
                {englishName && (
                  <Text style={[styles.heroEnglishName, { color: colors.textSecondary }]}>
                    {englishName}
                  </Text>
                )}
                <View
                  style={[
                    styles.heroFactionChip,
                    { backgroundColor: withAlpha(factionColor, 0.15) },
                  ]}
                >
                  <Text style={[styles.heroFactionText, { color: factionColor }]}>
                    {factionLabel}
                  </Text>
                </View>
              </View>
              {/* AI pill */}
              {showAIButton && (
                <Pressable
                  style={[styles.aiPill, { backgroundColor: withAlpha(factionColor, 0.15) }]}
                  onPress={handleAskAI}
                  accessibilityLabel="AI 攻略"
                >
                  <Ionicons
                    name={UI_ICONS.AI_ASSISTANT}
                    size={typography.caption}
                    color={factionColor}
                  />
                  <Text style={[styles.aiPillText, { color: factionColor }]}>AI 攻略</Text>
                </Pressable>
              )}
            </View>

            {/* Ability Tags */}
            {tags.length > 0 && (
              <View style={styles.tagsSection}>
                {tags.map((tag: RoleAbilityTag) => {
                  const tagColor = colors[TAG_COLOR_KEY[tag]];
                  return (
                    <View
                      key={tag}
                      style={[styles.detailTagChip, { backgroundColor: withAlpha(tagColor, 0.12) }]}
                    >
                      <Text style={[styles.detailTagText, { color: tagColor }]}>
                        {TAG_LABELS[tag]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Description */}
            <View style={styles.descriptionSection}>
              <RoleDescriptionView
                structuredDescription={structuredDesc}
                descriptionFallback={spec.description}
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
    // AI pill in hero section
    aiPill: {
      position: 'absolute',
      right: spacing.small,
      top: spacing.small,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
    },
    aiPillText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
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
    // Close
    closeButton: {
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      alignSelf: 'center',
      marginTop: spacing.medium,
    },
    closeButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
  });
}
