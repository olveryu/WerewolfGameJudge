/**
 * RoleCardSimple (werewolf) - 狼人杀角色卡弹窗的薄包装。
 *
 * Props 与原版完全一致，内部改用共享 `RoleCardSimple` + `toRevealRoleData` 适配器。
 * 狼人杀专属 UI（AI pill、变体 pill bar）通过共享组件的 `footer` 插槽传入。
 *
 * 注意：AI pill 和按钮的阵营色必须基于真实 roleId（非 displayAs 后），
 * 与原版 `getFactionColor(roleId)` 行为一致（如 mirrorSeer 显示村民绿）。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ROLE_SPECS, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { RoleCardSimple as SharedRoleCardSimple } from '@/features/room/components/RoleCardSimple';
import { getFactionColor } from '@/games/werewolf/components/RoleRevealEffects/common/RoleCardContent';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, typography, withAlpha } from '@/theme';

import { toRevealRoleData } from './WerewolfRoleCardAdapter';

interface RoleCardSimpleProps {
  readonly visible: boolean;
  readonly roleId: RoleId | null;
  readonly onClose: () => void;
  /**
   * When true, shows the role's real identity (skipping displayAs disguise).
   * Used for the judge-view skill preview. Defaults to false.
   */
  readonly showRealIdentity?: boolean;
  /**
   * Dual-Seer label (1 or 2), derived from seerLabelMap.
   * When present, the role name shows as "X号预言家". Only used in seer+mirrorSeer coexistence configs.
   */
  readonly seerLabel?: number;
  /**
   * Full list of variant roleIds (including the base role).
   * Shows the variant pill bar when present and length > 1.
   */
  readonly variantIds?: readonly RoleId[];
  /** Currently selected variant roleId. */
  readonly activeVariant?: RoleId;
  /** Callback when the user taps a pill to switch variant. */
  readonly onVariantSelect?: (variantId: RoleId) => void;
  /**
   * Callback for the AI strategy button; receives the currently displayed roleId (including variant switch).
   * When present, the AI button is shown; otherwise hidden.
   */
  readonly onAskAI?: (displayRoleId: RoleId) => void;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({
  visible,
  roleId,
  onClose,
  showRealIdentity,
  seerLabel,
  variantIds,
  activeVariant,
  onAskAI,
  onVariantSelect,
}) => {
  // 显示的 roleId（变体切换时用 activeVariant）
  const displayRoleId = activeVariant ?? roleId;

  // 通用角色数据（displayAs/seerLabel 已在适配器内处理）
  const revealData = useMemo(
    () =>
      displayRoleId != null
        ? toRevealRoleData(displayRoleId, { showRealIdentity, seerLabel })
        : null,
    [displayRoleId, showRealIdentity, seerLabel],
  );

  // AI pill 和按钮的阵营色：基于真实 roleId（非 displayAs），与原版一致
  const realFactionColor = roleId != null ? getFactionColor(roleId, colors) : colors.villager;

  const handleAskAI = useCallback(() => {
    if (displayRoleId == null || onAskAI == null) return;
    onAskAI(displayRoleId);
  }, [displayRoleId, onAskAI]);

  const showAIButton = onAskAI != null;
  const showVariantBar = variantIds != null && variantIds.length > 1 && onVariantSelect != null;

  const footer = useMemo(() => {
    if (!showAIButton && !showVariantBar) return null;
    return (
      <>
        {/* AI pill — overlaid on card, below faction badge */}
        {showAIButton && (
          <Pressable
            style={[styles.aiPill, { backgroundColor: withAlpha(realFactionColor, 0.15) }]}
            onPress={handleAskAI}
            accessibilityLabel="AI 攻略"
          >
            <Ionicons
              name={UI_ICONS.AI_ASSISTANT}
              size={typography.caption}
              color={realFactionColor}
            />
            <Text style={[styles.aiPillText, { color: realFactionColor }]}>AI 攻略</Text>
          </Pressable>
        )}

        {/* Variant pill bar */}
        {showVariantBar && variantIds != null && onVariantSelect != null && (
          <View style={styles.variantBar}>
            {variantIds.map((id) => {
              const spec = ROLE_SPECS[id];
              const isActive = id === activeVariant;
              return (
                <TouchableOpacity
                  key={id}
                  testID={TESTIDS.configVariantOption(id)}
                  style={[
                    styles.variantPill,
                    isActive && [styles.variantPillActive, { borderColor: realFactionColor }],
                  ]}
                  activeOpacity={fixed.activeOpacity}
                  onPress={() => onVariantSelect(id)}
                >
                  <Text
                    style={[
                      styles.variantPillText,
                      isActive && [styles.variantPillTextActive, { color: realFactionColor }],
                    ]}
                  >
                    {spec.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  }, [
    showAIButton,
    showVariantBar,
    variantIds,
    activeVariant,
    onVariantSelect,
    realFactionColor,
    handleAskAI,
  ]);

  // 共享组件的 role 为 null 时不渲染，与原版 `if (!visible || !roleId) return null` 等价
  if (!visible || roleId == null) return null;

  return (
    <SharedRoleCardSimple
      visible={visible}
      role={revealData}
      onClose={onClose}
      confirmText="知道了"
      footer={footer}
    />
  );
};

const styles = StyleSheet.create({
  aiPill: {
    position: 'absolute',
    right: spacing.small,
    top: spacing.xlarge,
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
  variantBar: {
    flexDirection: 'row',
    gap: spacing.small,
    marginTop: spacing.medium,
    marginBottom: spacing.small,
  },
  variantPill: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: withAlpha(colors.surface, 0.9),
  },
  variantPillActive: {
    backgroundColor: withAlpha(colors.surface, 0.95),
    borderWidth: fixed.borderWidthThick,
  },
  variantPillText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  variantPillTextActive: {
    fontWeight: typography.weights.semibold,
  },
});
