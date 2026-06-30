/**
 * GameModePickerSheet — bottom sheet shown when creating a room: pick werewolf or fibking.
 */
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { borderRadius, colors, spacing, typography } from '@/theme';

interface GameModePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickWerewolf: () => void;
  onPickFib: () => void;
}

export const GameModePickerSheet: React.FC<GameModePickerSheetProps> = ({
  visible,
  onClose,
  onPickWerewolf,
  onPickFib,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose} testID="mode-picker-overlay">
      <Pressable style={styles.sheet} onPress={() => {}}>
        <Text style={styles.title}>选择游戏模式</Text>
        <View style={styles.row}>
          <Pressable style={styles.card} onPress={onPickWerewolf} testID="mode-werewolf">
            <Text style={styles.emoji}>🐺</Text>
            <Text style={styles.cardTitle}>狼人杀</Text>
            <Text style={styles.cardSub}>经典身份推理</Text>
          </Pressable>
          <Pressable style={styles.card} onPress={onPickFib} testID="mode-fibking">
            <Text style={styles.emoji}>🤥</Text>
            <Text style={styles.cardTitle}>瞎掰王</Text>
            <Text style={styles.cardSub}>猜真假释义</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlayLight, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xlarge,
    borderTopRightRadius: borderRadius.xlarge,
    padding: spacing.large,
    gap: spacing.medium,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.medium },
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.large,
    alignItems: 'center',
    gap: spacing.tight,
  },
  emoji: { fontSize: typography.hero },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  cardSub: { fontSize: typography.caption, color: colors.textMuted },
});
