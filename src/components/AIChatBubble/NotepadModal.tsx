/**
 * NotepadModal - 全屏笔记弹窗
 *
 * 在 AI Chat Bubble 的 📝 按钮触发后全屏展示笔记面板。
 * 头部包含标题、清空按钮和关闭按钮。
 * 接收 useNotepad 返回值作为 props，不直接调用 service / AsyncStorage。
 */

import React, { useMemo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/theme';

import type { ChatStyles } from './AIChatBubble.styles';
import { NotepadPanel } from './NotepadPanel';
import type { UseNotepadReturn } from './useNotepad';

// ── Props ────────────────────────────────────────────────

interface NotepadModalProps {
  visible: boolean;
  onClose: () => void;
  notepad: UseNotepadReturn;
  styles: ChatStyles;
  colors: ThemeColors;
}

// ── Component ────────────────────────────────────────────

export const NotepadModal: React.FC<NotepadModalProps> = ({
  visible,
  onClose,
  notepad,
  styles,
  colors,
}) => {
  const notepadStyles = useMemo(
    () => ({
      container: styles.notepadContainer,
      list: styles.notepadList,
      playerRow: styles.notepadPlayerRow,
      playerLabel: styles.notepadPlayerLabel,
      tagBtn: styles.notepadTagBtn,
      tagBtnActive: styles.notepadTagBtnActive,
      tagBtnBad: styles.notepadTagBtnBad,
      tagBtnWithdrawn: styles.notepadTagBtnWithdrawn,
      tagBtnText: styles.notepadTagBtnText,
      tagBtnTextInactive: styles.notepadTagBtnTextInactive,
      playerInput: styles.notepadPlayerInput,
    }),
    [styles],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.notepadModal}>
        {/* Header */}
        <View style={styles.notepadHeader}>
          <Text style={styles.notepadHeaderTitle}>📝 笔记</Text>
          <View style={styles.notepadHeaderButtons}>
            <TouchableOpacity
              onPress={notepad.clearAll}
              style={styles.notepadHeaderBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.notepadHeaderBtnText}>🗑️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.notepadHeaderBtn} activeOpacity={0.7}>
              <Text style={styles.notepadHeaderBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notepad list */}
        <NotepadPanel
          state={notepad.state}
          playerCount={notepad.playerCount}
          onNoteChange={notepad.setNote}
          onCycleHand={notepad.cycleHand}
          onCycleIdentity={notepad.cycleIdentity}
          styles={notepadStyles}
          colors={colors}
        />
      </SafeAreaView>
    </Modal>
  );
};
