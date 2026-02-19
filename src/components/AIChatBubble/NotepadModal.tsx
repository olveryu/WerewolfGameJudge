/**
 * NotepadModal - 全屏笔记弹窗
 *
 * 在 AI Chat Bubble 的 📝 按钮触发后全屏展示单列笔记面板。
 * 头部包含标题、清空按钮和关闭按钮。底部显示角色阵营图例。
 * 接收 useNotepad 返回值作为 props，不直接调用 service / AsyncStorage。
 */

import React, { useMemo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChatStyles } from './AIChatBubble.styles';
import { NotepadPanel } from './NotepadPanel';
import type { UseNotepadReturn } from './useNotepad';

// ── Props ────────────────────────────────────────────────

interface NotepadModalProps {
  visible: boolean;
  onClose: () => void;
  notepad: UseNotepadReturn;
  styles: ChatStyles;
}

// ── Component ────────────────────────────────────────────

export const NotepadModal: React.FC<NotepadModalProps> = ({
  visible,
  onClose,
  notepad,
  styles,
}) => {
  const notepadStyles = useMemo(
    () => ({
      container: styles.notepadContainer,
      list: styles.notepadList,
      listContent: styles.notepadListContent,
      card: styles.notepadCard,
      cardGood: styles.notepadCardGood,
      cardBad: styles.notepadCardBad,
      cardHeader: styles.notepadCardHeader,
      seatBtn: styles.notepadSeatBtn,
      seatNumber: styles.notepadSeatNumber,
      seatPlaceholder: styles.notepadSeatPlaceholder,
      roleBadge: styles.notepadRoleBadge,
      roleBadgeGood: styles.notepadRoleBadgeGood,
      roleBadgeBad: styles.notepadRoleBadgeBad,
      roleBadgeText: styles.notepadRoleBadgeText,
      roleBadgeTextGood: styles.notepadRoleBadgeTextGood,
      roleBadgeTextBad: styles.notepadRoleBadgeTextBad,
      handTag: styles.notepadHandTag,
      handTagActive: styles.notepadHandTagActive,
      handTagText: styles.notepadHandTagText,
      handTagTextActive: styles.notepadHandTagTextActive,
      noteInput: styles.notepadNoteInput,
      popoverOverlay: styles.notepadPopoverOverlay,
      popover: styles.notepadPopover,
      popoverTitle: styles.notepadPopoverTitle,
      popoverGrid: styles.notepadPopoverGrid,
      popoverTag: styles.notepadPopoverTag,
      popoverTagSelectedGood: styles.notepadPopoverTagSelectedGood,
      popoverTagSelectedBad: styles.notepadPopoverTagSelectedBad,
      popoverTagText: styles.notepadPopoverTagText,
      popoverTagTextSelected: styles.notepadPopoverTagTextSelected,
      popoverClearBtn: styles.notepadPopoverClearBtn,
      popoverClearText: styles.notepadPopoverClearText,
      legend: styles.notepadLegend,
      legendItem: styles.notepadLegendItem,
      legendDot: styles.notepadLegendDot,
      legendDotGood: styles.notepadLegendDotGood,
      legendDotBad: styles.notepadLegendDotBad,
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
          roleTags={notepad.roleTags}
          onNoteChange={notepad.setNote}
          onToggleHand={notepad.toggleHand}
          onSetRole={notepad.setRole}
          styles={notepadStyles}
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
        </View>
      </SafeAreaView>
    </Modal>
  );
};
