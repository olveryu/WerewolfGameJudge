/**
 * ChooseBottomCardModal — 底牌选择弹窗（盗宝大师 / 盗贼共用）
 *
 * 纯展示组件：调用方通过 disabledIndices 控制哪些卡牌灰色 disabled。
 * 点击可选牌后弹出确认对话框，确认后通过 onChoose(cardIndex) 回调提交。
 * 不 import service，不含业务逻辑判断。
 */
import { getRoleDisplayName, type RoleId } from '@werewolf/game-engine/models/roles';
import type React from 'react';
import { memo, useMemo } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles, type ThemeColors, typography } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';
import { getRoleBadge } from '@/utils/roleBadges';

interface BottomCardItem {
  roleId: string;
  displayName: string;
}

interface ChooseBottomCardModalProps {
  visible: boolean;
  bottomCards: readonly string[];
  confirmText: string;
  /** Indices of cards that should be greyed out and non-clickable. */
  disabledIndices: number[];
  /** Hint text shown below disabled card names (e.g. "狼人阵营 · 不可选"). */
  disabledHint?: string;
  /** Full subtitle text displayed below the title. */
  subtitle: string;
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
  disabledIndices,
  disabledHint,
  subtitle,
  onChoose,
  onClose,
}) => {
  const styles = useMemo(() => createStyles(colors), []);

  const cards: BottomCardItem[] = useMemo(
    () =>
      bottomCards.map((roleId) => ({
        roleId,
        displayName: getRoleDisplayName(roleId),
      })),
    [bottomCards],
  );

  const handleCardPress = (cardIndex: number, card: BottomCardItem) => {
    showConfirmAlert('确认选择', `${confirmText}\n\n${card.displayName}`, () =>
      onChoose(cardIndex),
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>选择底牌</Text>
          <Text style={styles.teamSubtitle}>{subtitle}</Text>
          <View style={styles.cardList}>
            {cards.map((card, index) => {
              const isDisabled = disabledIndices.includes(index);
              return (
                <TouchableOpacity
                  key={`${card.roleId}-${index}`}
                  style={[styles.card, isDisabled && styles.cardDisabled]}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                  onPress={() => handleCardPress(index, card)}
                >
                  <Image source={getRoleBadge(card.roleId as RoleId)} style={styles.cardBadge} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, isDisabled && styles.cardNameDisabled]}>
                      {card.displayName}
                    </Text>
                    {isDisabled && disabledHint && (
                      <Text style={styles.cardHint}>{disabledHint}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
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
