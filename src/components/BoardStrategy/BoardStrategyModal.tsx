/**
 * BoardStrategyModal — Board strategy bottom-sheet modal.
 *
 * Bottom sheet that slides up to display BoardStrategyContent.
 * Hidden when boardName is null. Shared by RoomScreen / BoardPickerScreen / EncyclopediaScreen.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  textStyles,
  withAlpha,
} from '@/theme';

import { BoardStrategyContent } from './BoardStrategyContent';

// ── Props ─────────────────────────────────────────────────────────────────────

interface BoardStrategyModalProps {
  boardName: string | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BoardStrategyModal: React.FC<BoardStrategyModalProps> = ({ boardName, onClose }) => {
  return (
    <Modal visible={boardName !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.modal}
          onPress={() => {
            /* prevent dismiss */
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {boardName} · 攻略
            </Text>
            <Button variant="icon" size="sm" onPress={onClose}>
              <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
            </Button>
          </View>
          {boardName && <BoardStrategyContent boardName={boardName} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(colors.background, 0.5),
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xlarge,
    borderTopRightRadius: borderRadius.xlarge,
    paddingHorizontal: spacing.large,
    paddingBottom: spacing.large,
    maxHeight: '85%',
    width: '100%',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.medium,
    paddingBottom: spacing.small,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
    flex: 1,
  },
});
