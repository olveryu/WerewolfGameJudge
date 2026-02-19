/**
 * NotepadModal - 全屏笔记弹窗
 *
 * 在 AI Chat Bubble 的 📝 按钮触发后全屏展示 2×6 网格笔记面板。
 * 头部包含标题、清空按钮和关闭按钮。底部显示身份图例。
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
      listContent: styles.notepadListContent,
      gridRow: styles.notepadGridRow,
      card: styles.notepadCard,
      cardGood: styles.notepadCardGood,
      cardBad: styles.notepadCardBad,
      cardSuspect: styles.notepadCardSuspect,
      cardHeader: styles.notepadCardHeader,
      seatNumber: styles.notepadSeatNumber,
      identityBtn: styles.notepadIdentityBtn,
      identityBtnText: styles.notepadIdentityBtnText,
      handTag: styles.notepadHandTag,
      handTagActive: styles.notepadHandTagActive,
      handTagText: styles.notepadHandTagText,
      handTagTextActive: styles.notepadHandTagTextActive,
      roleTagRow: styles.notepadRoleTagRow,
      roleTag: styles.notepadRoleTag,
      roleTagSelectedGood: styles.notepadRoleTagSelectedGood,
      roleTagSelectedBad: styles.notepadRoleTagSelectedBad,
      roleTagText: styles.notepadRoleTagText,
      roleTagTextSelected: styles.notepadRoleTagTextSelected,
      noteInput: styles.notepadNoteInput,
      legend: styles.notepadLegend,
      legendItem: styles.notepadLegendItem,
      legendDot: styles.notepadLegendDot,
      legendDotGood: styles.notepadLegendDotGood,
      legendDotBad: styles.notepadLegendDotBad,
      legendDotSuspect: styles.notepadLegendDotSuspect,
      legendText: styles.notepadLegendText,
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

        {/* Notepad grid */}
        <NotepadPanel
          state={notepad.state}
          playerCount={notepad.playerCount}
          onNoteChange={notepad.setNote}
          onToggleHand={notepad.toggleHand}
          onCycleIdentity={notepad.cycleIdentity}
          onSetRole={notepad.setRole}
          styles={notepadStyles}
          colors={colors}
        />

        {/* Legend */}
        <View style={notepadStyles.legend}>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotGood]} />
            <Text style={notepadStyles.legendText}>好人</Text>
          </View>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotBad]} />
            <Text style={notepadStyles.legendText}>狼人</Text>
          </View>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotSuspect]} />
            <Text style={notepadStyles.legendText}>存疑</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
