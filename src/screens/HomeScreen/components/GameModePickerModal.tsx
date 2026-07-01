/**
 * GameModePickerModal — centered dialog shown when creating a room.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

interface GameModePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPickWerewolf: () => void;
  onPickFib: () => void;
}

export const GameModePickerModal: React.FC<GameModePickerModalProps> = ({
  visible,
  onClose,
  onPickWerewolf,
  onPickFib,
}) => (
  <BaseCenterModal
    visible={visible}
    onClose={onClose}
    dismissOnOverlayPress
    contentStyle={styles.modal}
    testID="mode-picker-modal"
  >
    <Text style={styles.title}>选择游戏模式</Text>
    <Text style={styles.subtitle}>选择本局要创建的游戏</Text>
    <View style={styles.options}>
      <Pressable style={styles.option} onPress={onPickWerewolf} testID="mode-werewolf">
        <View style={styles.iconWrap}>
          <Ionicons name="moon-outline" size={componentSizes.icon.lg} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.cardTitle}>狼人杀</Text>
          <Text style={styles.cardSub}>经典身份推理</Text>
        </View>
        <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
      </Pressable>
      <Pressable style={styles.option} onPress={onPickFib} testID="mode-fibking">
        <View style={styles.iconWrap}>
          <Ionicons
            name="chatbubbles-outline"
            size={componentSizes.icon.lg}
            color={colors.primary}
          />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.cardTitle}>瞎掰王</Text>
          <Text style={styles.cardSub}>猜真假释义</Text>
        </View>
        <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
      </Pressable>
    </View>
  </BaseCenterModal>
);

const styles = StyleSheet.create({
  modal: {
    width: '88%',
    maxWidth: 420,
    padding: spacing.large,
    gap: spacing.medium,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  options: { gap: spacing.small },
  option: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.medium,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: spacing.micro,
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  cardSub: { fontSize: typography.caption, color: colors.textMuted },
});
