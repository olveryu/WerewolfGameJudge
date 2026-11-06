/**
 * ChooseBottomCardModal — Bottom card selection modal (shared by Treasure Master / Thief)
 *
 * Pure display component over the engine's `BottomCardChoice`: each card
 * carries its own selectability and rejection reason. Tapping a selectable
 * card shows a confirmation dialog; on confirm, submits via onChoose(cardIndex).
 */
import {
  type BottomCardChoice,
  getRoleDisplayName,
} from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';
import { memo, useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Modal } from '@/components/AppModal';
import { getRoleBadge } from '@/games/werewolf/assets/roleBadges';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, spacing, textStyles, type ThemeColors, typography } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

interface ChooseBottomCardModalProps {
  visible: boolean;
  choice: BottomCardChoice;
  confirmText: string;
  onChoose: (cardIndex: number) => void | Promise<void>;
  onClose: () => void;
}

function createStyles(colors: ThemeColors, screenHeight: number) {
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
      maxWidth: 400,
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
    cardListScroll: {
      maxHeight: screenHeight * 0.45,
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
  choice,
  confirmText,
  onChoose,
  onClose,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, screenHeight), [screenHeight]);

  const handleCardPress = (cardIndex: number, displayName: string) => {
    showConfirmAlert('确认选择', `${confirmText}\n\n${displayName}`, () => onChoose(cardIndex));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container} testID={TESTIDS.chooseBottomCardModal}>
          <Text style={styles.title}>选择底牌</Text>
          <Text style={styles.teamSubtitle}>{choice.hint}</Text>
          <ScrollView
            style={styles.cardListScroll}
            contentContainerStyle={styles.cardList}
            showsVerticalScrollIndicator={false}
          >
            {choice.cards.map((card, index) => {
              const isDisabled = !card.isSelectable;
              const displayName = getRoleDisplayName(card.roleId);
              return (
                <TouchableOpacity
                  key={`${card.roleId}-${index}`}
                  testID={TESTIDS.chooseBottomCardOption(index)}
                  style={[styles.card, isDisabled && styles.cardDisabled]}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDisabled }}
                  activeOpacity={0.7}
                  onPress={() => handleCardPress(index, displayName)}
                >
                  <Image source={getRoleBadge(card.roleId)} style={styles.cardBadge} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, isDisabled && styles.cardNameDisabled]}>
                      {displayName}
                    </Text>
                    {card.reason !== null && <Text style={styles.cardHint}>{card.reason}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ChooseBottomCardModal = memo(ChooseBottomCardModalComponent);
