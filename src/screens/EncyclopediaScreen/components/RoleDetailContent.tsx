/**
 * RoleDetailContent - 角色图鉴结构化详情
 *
 * 在 Modal 内展示角色完整信息，包含结构化字段：
 * badge + 名称 + 阵营/功能/难度标签 + 技能效果 + flags 标记 + 关联角色。
 * 底部提供上一个/下一个导航按钮。
 * 纯展示组件，不 import service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import {
  getRoleSpec,
  isValidRoleId,
  ROLE_SPECS,
  type RoleId,
} from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getFactionName } from '@/components/roleDisplayUtils';
import {
  borderRadius,
  componentSizes,
  fixed,
  spacing,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';
import { getRoleBadge } from '@/utils/roleBadges';

import {
  DIFFICULTY_LABELS,
  getActionTiming,
  getFactionColorKey,
  getFlagLabels,
  getRelatedRoles,
  getRoleCategoryMeta,
} from '../data/roleCategories';

// ============================================
// Types
// ============================================

interface RoleDetailContentProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onRolePress?: (roleId: RoleId) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

// ============================================
// Component
// ============================================

export const RoleDetailContent: React.FC<RoleDetailContentProps> = ({
  visible,
  roleId,
  onClose,
  onPrev,
  onNext,
  onRolePress,
  isFavorite,
  onToggleFavorite,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible || !roleId) return null;

  const spec = getRoleSpec(roleId);
  const meta = getRoleCategoryMeta(roleId);
  const factionColorKey = getFactionColorKey(roleId);
  const factionColor = colors[factionColorKey];
  const factionName = getFactionName(roleId);
  const badgeSource = getRoleBadge(roleId);
  const actionTiming = getActionTiming(roleId);
  const flagLabels = getFlagLabels(roleId);
  const relatedRoles = getRelatedRoles(roleId);
  const difficultyLabel = DIFFICULTY_LABELS[meta.difficulty];

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* 收藏按钮 */}
          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={onToggleFavorite}
              activeOpacity={fixed.activeOpacity}
              accessibilityLabel={isFavorite ? '取消收藏' : '收藏'}
            >
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={componentSizes.icon.md}
                color={isFavorite ? colors.warning : colors.textMuted}
              />
            </TouchableOpacity>
          )}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── 头部：Badge + 名称 ── */}
            <View style={styles.headerSection}>
              <Image source={badgeSource} style={styles.badgeImage} resizeMode="contain" />
              <View style={styles.headerTextCol}>
                <View style={styles.nameRow}>
                  <Text style={[styles.roleName, { color: factionColor }]}>{spec.displayName}</Text>
                  <Text style={styles.emojiLabel}>{spec.emoji}</Text>
                </View>
                <Text style={[styles.factionLabel, { color: colors.textSecondary }]}>
                  {factionName}
                </Text>
              </View>
            </View>

            {/* ── 标签行 ── */}
            <View style={styles.tagRow}>
              <View style={[styles.chip, { backgroundColor: withAlpha(factionColor, 0.12) }]}>
                <Text style={[styles.chipText, { color: factionColor }]}>{meta.functionTag}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: withAlpha(colors.info, 0.12) }]}>
                <Text style={[styles.chipText, { color: colors.info }]}>{actionTiming}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                  {difficultyLabel}
                </Text>
              </View>
            </View>

            {/* ── 技能效果 ── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>技能效果</Text>
              <Text style={[styles.descriptionText, { color: colors.text }]}>
                {spec.description}
              </Text>
            </View>

            {/* ── 特殊标记 ── */}
            {flagLabels.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>特殊标记</Text>
                <View style={styles.flagRow}>
                  {flagLabels.map((label) => (
                    <View
                      key={label}
                      style={[styles.flagChip, { backgroundColor: withAlpha(colors.warning, 0.1) }]}
                    >
                      <Text style={[styles.flagChipText, { color: colors.warning }]}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── 关联角色 ── */}
            {relatedRoles.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>关联角色</Text>
                <View style={styles.relatedRow}>
                  {relatedRoles.map(({ id, reason }) => {
                    const relSpec = isValidRoleId(id) ? ROLE_SPECS[id] : undefined;
                    if (!relSpec) return null;
                    const relColor = colors[getFactionColorKey(id)];
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.relatedChip, { borderColor: withAlpha(relColor, 0.3) }]}
                        activeOpacity={fixed.activeOpacity}
                        onPress={() => onRolePress?.(id)}
                      >
                        <Text style={styles.relatedEmoji}>{relSpec.emoji}</Text>
                        <View>
                          <Text style={[styles.relatedName, { color: colors.text }]}>
                            {relSpec.displayName}
                          </Text>
                          <Text style={[styles.relatedReason, { color: colors.textMuted }]}>
                            {reason}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── 底部导航 ── */}
          <View style={[styles.navBar, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.navButton, !onPrev && styles.navButtonDisabled]}
              onPress={onPrev ?? undefined}
              activeOpacity={fixed.activeOpacity}
              disabled={!onPrev}
              accessibilityLabel="上一个角色"
            >
              <Ionicons
                name="chevron-back"
                size={componentSizes.icon.md}
                color={onPrev ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.navText, { color: onPrev ? colors.primary : colors.textMuted }]}>
                上一个
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={fixed.activeOpacity}
              accessibilityLabel="关闭"
            >
              <Text
                style={[
                  styles.closeButtonText,
                  { color: colors.textInverse, backgroundColor: factionColor },
                ]}
              >
                关闭
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, !onNext && styles.navButtonDisabled]}
              onPress={onNext ?? undefined}
              activeOpacity={fixed.activeOpacity}
              disabled={!onNext}
              accessibilityLabel="下一个角色"
            >
              <Text style={[styles.navText, { color: onNext ? colors.primary : colors.textMuted }]}>
                下一个
              </Text>
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.md}
                color={onNext ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// Styles
// ============================================

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xlarge,
      borderTopRightRadius: borderRadius.xlarge,
      maxHeight: '75%',
      paddingBottom: spacing.medium,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: spacing.small,
      marginBottom: spacing.small,
    },
    favoriteButton: {
      position: 'absolute',
      top: spacing.medium,
      right: spacing.medium,
      zIndex: 1,
      padding: spacing.tight,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.large,
      paddingBottom: spacing.medium,
    },
    // ── Header ──
    headerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.medium,
      gap: spacing.medium,
    },
    badgeImage: {
      width: 72,
      height: 72,
    },
    headerTextCol: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: typography.weights.bold,
    },
    emojiLabel: {
      fontSize: typography.title,
    },
    factionLabel: {
      fontSize: typography.secondary,
      marginTop: spacing.tight,
    },
    // ── Tags ──
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    chip: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
    },
    chipText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.medium,
    },
    // ── Sections ──
    section: {
      marginBottom: spacing.medium,
    },
    sectionTitle: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
      marginBottom: spacing.small,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },
    descriptionText: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
    },
    // ── Flags ──
    flagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    flagChip: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.medium,
    },
    flagChipText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.medium,
    },
    // ── Related Roles ──
    relatedRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    relatedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
    },
    relatedEmoji: {
      fontSize: typography.body,
    },
    relatedName: {
      fontSize: typography.caption,
      fontWeight: typography.weights.medium,
    },
    relatedReason: {
      fontSize: typography.captionSmall,
    },
    // ── Bottom Nav ──
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.medium,
      borderTopWidth: fixed.borderWidth,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      minWidth: 80,
    },
    navButtonDisabled: {
      opacity: fixed.disabledOpacity,
    },
    navText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.medium,
    },
    closeButton: {
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
  });
}
