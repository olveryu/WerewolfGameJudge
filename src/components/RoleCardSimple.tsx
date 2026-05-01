/**
 * RoleCardSimple - 无动画直接显示角色卡片模态框
 *
 * 点击"查看身份"后直接显示角色信息，无任何动画。
 * 卡片内容复用 RoleCardContent，本组件仅负责 Modal 包裹 + "我知道了"按钮。
 * 有变体的角色在卡片下方显示变体切换 pill bar，点击 pill 切换卡片内容并同步回调。
 * 渲染 Modal 与按钮。不 import service，不含业务逻辑，不重复卡片 UI。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { isValidRoleId, ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import {
  getFactionColor,
  RoleCardContent,
} from '@/components/RoleRevealEffects/common/RoleCardContent';
import { UI_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  fixed,
  spacing,
  type ThemeColors,
  typography,
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
  /**
   * 点击 AI 攻略按钮的回调，接收当前显示的 roleId（含变体切换）。
   * 存在时显示 AI 按钮，不存在时隐藏。
   */
  onAskAI?: (displayRoleId: RoleId) => void;
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
  onAskAI,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 360);
  const cardHeight = cardWidth * 1.5;
  const styles = useMemo(() => createStyles(colors), []);

  const showAIButton = !!onAskAI;
  const displayRoleId = activeVariant ?? roleId;

  const handleAskAI = useCallback(() => {
    if (!displayRoleId || !onAskAI) return;
    onAskAI(displayRoleId as RoleId);
  }, [displayRoleId, onAskAI]);

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

          {/* AI pill — overlaid on card, below faction badge */}
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

          <View style={styles.confirmButton}>
            <Button variant="primary" buttonColor={factionColor} onPress={onClose}>
              知道了
            </Button>
          </View>
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
    confirmButton: {
      marginTop: spacing.medium,
      width: '100%',
    },
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
}
