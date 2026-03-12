/**
 * RoleCardSimple - 无动画直接显示角色卡片模态框
 *
 * 点击"查看身份"后直接显示角色信息，无任何动画。
 * 卡片内容复用 RoleCardContent，本组件仅负责 Modal 包裹 + "我知道了"按钮。
 * 有变体的角色在卡片下方显示变体切换 pill bar，点击 pill 切换卡片内容并同步回调。
 * 渲染 Modal 与按钮。不 import service，不含业务逻辑，不重复卡片 UI。
 */
import { isValidRoleId, ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  getFactionColor,
  RoleCardContent,
} from '@/components/RoleRevealEffects/common/RoleCardContent';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
  withAlpha,
} from '@/theme';

interface RoleCardSimpleProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
  /**
   * 为 true 时显示角色真实身份（跳过 displayAs 伪装）。
   * 用于裁判视角的技能预览。默认 false。
   */
  showRealIdentity?: boolean;
  /**
   * 双预言家编号（1 或 2），由 seerLabelMap 派生。
   * 存在时角色名显示为 "X号预言家"。仅 seer+mirrorSeer 共存配置使用。
   */
  seerLabel?: number;
  /**
   * 全部变体 roleId 列表（含 base role）。
   * 存在且 length > 1 时显示变体切换 pill bar。
   */
  variantIds?: string[];
  /** 当前选中的变体 roleId。 */
  activeVariant?: string;
  /** 用户点击 pill 切换变体时的回调。 */
  onVariantSelect?: (variantId: string) => void;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({
  visible,
  roleId,
  onClose,
  showRealIdentity,
  seerLabel,
  variantIds,
  activeVariant,
  onVariantSelect,
}) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 320);
  const cardHeight = cardWidth * 1.5;
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible || !roleId) return null;

  const factionColor = getFactionColor(roleId, colors);
  const showVariantBar = variantIds && variantIds.length > 1 && onVariantSelect;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop — sibling (not parent) so clicks don't bubble to card */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.cardWrapper}>
          <RoleCardContent
            testID="role-card-modal"
            roleId={roleId}
            width={cardWidth}
            height={cardHeight}
            showRealIdentity={showRealIdentity}
            seerLabel={seerLabel}
          />

          {/* Variant pill bar */}
          {showVariantBar && (
            <View style={styles.variantBar}>
              {variantIds.map((id) => {
                const spec = isValidRoleId(id) ? ROLE_SPECS[id] : undefined;
                const isActive = id === activeVariant;
                return (
                  <TouchableOpacity
                    key={id}
                    testID={TESTIDS.configVariantOption(id)}
                    style={[
                      styles.variantPill,
                      isActive && [styles.variantPillActive, { borderColor: factionColor }],
                    ]}
                    activeOpacity={fixed.activeOpacity}
                    onPress={() => onVariantSelect(id)}
                  >
                    <Text
                      style={[
                        styles.variantPillText,
                        isActive && [styles.variantPillTextActive, { color: factionColor }],
                      ]}
                    >
                      {spec?.displayName ?? id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: factionColor }]}
            onPress={onClose}
          >
            <Text style={styles.confirmButtonText}>知道了</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardWrapper: {
      alignItems: 'center',
      position: 'relative',
      zIndex: 1,
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
    confirmButton: {
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginTop: spacing.small,
    },
    confirmButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
    },
  });
}
