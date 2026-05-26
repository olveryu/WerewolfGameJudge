/**
 * RoleCardSimple - role card modal shown directly without animation
 *
 * After tapping "查看身份" the role info is shown directly, with no animation.
 * Card content reuses RoleCardContent; this component only handles the Modal wrapper + "我知道了" button.
 * Roles with variants show a variant-switching pill bar below the card; tapping a pill switches card content and fires the callback.
 * Renders Modal and button. Does not import services, contains no business logic, and does not duplicate card UI.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { isValidRoleId, ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import type React from 'react';
import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import {
  getFactionColor,
  RoleCardContent,
} from '@/components/RoleRevealEffects/common/RoleCardContent';
import { UI_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, fixed, spacing, typography, withAlpha } from '@/theme';

interface RoleCardSimpleProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
  /**
   * When true, shows the role's real identity (skipping displayAs disguise).
   * Used for the judge-view skill preview. Defaults to false.
   */
  showRealIdentity?: boolean;
  /**
   * Dual-Seer label (1 or 2), derived from seerLabelMap.
   * When present, the role name shows as "X号预言家". Only used in seer+mirrorSeer coexistence configs.
   */
  seerLabel?: number;
  /**
   * Full list of variant roleIds (including the base role).
   * Shows the variant pill bar when present and length > 1.
   */
  variantIds?: string[];
  /** Currently selected variant roleId. */
  activeVariant?: string;
  /** Callback when the user taps a pill to switch variant. */
  onVariantSelect?: (variantId: string) => void;
  /**
   * Callback for the AI strategy button; receives the currently displayed roleId (including variant switch).
   * When present, the AI button is shown; otherwise hidden.
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

const styles = StyleSheet.create({
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
