/**
 * ChooseBottomCardModal — 盗宝大师底牌选择弹窗
 *
 * 展示 3 张底牌供盗宝大师选择。狼人阵营卡牌灰色 disabled，非狼牌可点击。
 * 点击后弹出确认对话框，确认后通过 onChoose(cardIndex) 回调提交。
 * 纯展示组件：不 import service，不含业务逻辑判断。
 */
import { getRoleDisplayName, type RoleId } from '@werewolf/game-engine/models/roles';
import { ROLE_SPECS } from '@werewolf/game-engine/models/roles/spec/specs';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import React, { memo, useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  borderRadius,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  useColors,
} from '@/theme';
import { CANCEL_BUTTON, confirmButton, showAlert } from '@/utils/alert';
import { getRoleBadge } from '@/utils/roleBadges';

interface BottomCardItem {
  roleId: string;
  displayName: string;
  isWolf: boolean;
}

/**
 * 根据底牌 Faction 分布计算阵营显示文案。
 * 规则（同 description）：含狼→狼人阵营；无狼+≥2神→神职阵营；无狼+≥2民→平民阵营。
 */
function getTeamDisplayLabel(bottomCards: readonly string[]): string {
  const factions = bottomCards.map((r) => ROLE_SPECS[r as keyof typeof ROLE_SPECS]?.faction);
  if (factions.some((f) => f === Faction.Wolf)) return '狼人阵营';
  const godCount = factions.filter((f) => f === Faction.God).length;
  if (godCount >= 2) return '神职阵营';
  const villagerCount = factions.filter((f) => f === Faction.Villager).length;
  if (villagerCount >= 2) return '平民阵营';
  return '好人阵营';
}

interface ChooseBottomCardModalProps {
  visible: boolean;
  bottomCards: readonly string[];
  confirmText: string;
  onChoose: (cardIndex: number) => void;
  onClose: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.large,
      width: '85%',
      maxWidth: 360,
    },
    title: {
      ...textStyles.subtitle,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.micro,
    },
    teamSubtitle: {
      ...textStyles.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    cardList: {
      gap: spacing.small,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardDisabled: {
      opacity: 0.4,
    },
    cardBadge: {
      width: 40,
      height: 40,
      marginRight: spacing.small,
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      ...textStyles.body,
      color: colors.text,
      fontWeight: typography.weights.semibold,
    },
    cardNameDisabled: {
      color: colors.textMuted,
    },
    cardHint: {
      ...textStyles.caption,
      color: colors.textMuted,
      marginTop: spacing.micro,
    },
    cancelButton: {
      marginTop: spacing.medium,
      alignItems: 'center',
      padding: spacing.small,
    },
    cancelText: {
      ...textStyles.body,
      color: colors.textSecondary,
    },
  });
}

const ChooseBottomCardModalComponent: React.FC<ChooseBottomCardModalProps> = ({
  visible,
  bottomCards,
  confirmText,
  onChoose,
  onClose,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const cards: BottomCardItem[] = useMemo(
    () =>
      bottomCards.map((roleId) => {
        const spec = ROLE_SPECS[roleId as keyof typeof ROLE_SPECS];
        return {
          roleId,
          displayName: getRoleDisplayName(roleId),
          isWolf: spec?.faction === Faction.Wolf,
        };
      }),
    [bottomCards],
  );

  const handleCardPress = (cardIndex: number, card: BottomCardItem) => {
    showAlert('确认选择', `${confirmText}\n\n${card.displayName}`, [
      CANCEL_BUTTON,
      confirmButton(() => onChoose(cardIndex)),
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>选择底牌</Text>
          <Text style={styles.teamSubtitle}>你的阵营：{getTeamDisplayLabel(bottomCards)}</Text>
          <View style={styles.cardList}>
            {cards.map((card, index) => (
              <TouchableOpacity
                key={`${card.roleId}-${index}`}
                style={[styles.card, card.isWolf && styles.cardDisabled]}
                disabled={card.isWolf}
                activeOpacity={0.7}
                onPress={() => handleCardPress(index, card)}
              >
                <Image source={getRoleBadge(card.roleId as RoleId)} style={styles.cardBadge} />
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, card.isWolf && styles.cardNameDisabled]}>
                    {card.displayName}
                  </Text>
                  {card.isWolf && <Text style={styles.cardHint}>狼人阵营 · 不可选</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ChooseBottomCardModal = memo(ChooseBottomCardModalComponent);
