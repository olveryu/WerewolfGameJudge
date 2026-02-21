/**
 * NotepadModal - 全屏笔记弹窗
 *
 * 在 AI Chat Bubble 的 📝 按钮触发后全屏展示单列笔记面板。
 * 头部包含标题、清空按钮和关闭按钮。底部显示角色阵营图例。
 * 接收 useNotepad 返回值作为 props，不直接调用 service / AsyncStorage。
 */

import React, { useMemo } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      cardWolf: styles.notepadCardWolf,
      cardGod: styles.notepadCardGod,
      cardVillager: styles.notepadCardVillager,
      cardThird: styles.notepadCardThird,
      cardHeader: styles.notepadCardHeader,
      seatBtn: styles.notepadSeatBtn,
      seatNumber: styles.notepadSeatNumber,
      seatPlaceholder: styles.notepadSeatPlaceholder,
      roleBadge: styles.notepadRoleBadge,
      roleBadgeWolf: styles.notepadRoleBadgeWolf,
      roleBadgeGod: styles.notepadRoleBadgeGod,
      roleBadgeVillager: styles.notepadRoleBadgeVillager,
      roleBadgeThird: styles.notepadRoleBadgeThird,
      roleBadgeText: styles.notepadRoleBadgeText,
      roleBadgeTextWolf: styles.notepadRoleBadgeTextWolf,
      roleBadgeTextGod: styles.notepadRoleBadgeTextGod,
      roleBadgeTextVillager: styles.notepadRoleBadgeTextVillager,
      roleBadgeTextThird: styles.notepadRoleBadgeTextThird,
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
      popoverTagSelectedWolf: styles.notepadPopoverTagSelectedWolf,
      popoverTagSelectedGod: styles.notepadPopoverTagSelectedGod,
      popoverTagSelectedVillager: styles.notepadPopoverTagSelectedVillager,
      popoverTagSelectedThird: styles.notepadPopoverTagSelectedThird,
      popoverTagText: styles.notepadPopoverTagText,
      popoverTagTextWolf: styles.notepadPopoverTagTextWolf,
      popoverTagTextGod: styles.notepadPopoverTagTextGod,
      popoverTagTextVillager: styles.notepadPopoverTagTextVillager,
      popoverTagTextThird: styles.notepadPopoverTagTextThird,
      popoverTagTextSelected: styles.notepadPopoverTagTextSelected,
      popoverClearBtn: styles.notepadPopoverClearBtn,
      popoverClearText: styles.notepadPopoverClearText,
      legend: styles.notepadLegend,
      legendItem: styles.notepadLegendItem,
      legendDot: styles.notepadLegendDot,
      legendDotWolf: styles.notepadLegendDotWolf,
      legendDotGod: styles.notepadLegendDotGod,
      legendDotVillager: styles.notepadLegendDotVillager,
      legendDotThird: styles.notepadLegendDotThird,
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

        {/* Public note area — side-by-side */}
        <View style={styles.notepadPublicSection}>
          <Text style={styles.notepadPublicLabel}>📋 记录</Text>
          <View style={styles.notepadPublicRow}>
            <TextInput
              style={styles.notepadPublicInput}
              value={notepad.state.publicNoteLeft}
              onChangeText={notepad.setPublicNoteLeft}
              multiline
              textAlignVertical="top"
            />
            <TextInput
              style={styles.notepadPublicInput}
              value={notepad.state.publicNoteRight}
              onChangeText={notepad.setPublicNoteRight}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Legend */}
        <View style={notepadStyles.legend}>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotGod]} />
            <Text style={notepadStyles.legendText}>神职</Text>
          </View>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotVillager]} />
            <Text style={notepadStyles.legendText}>平民</Text>
          </View>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotWolf]} />
            <Text style={notepadStyles.legendText}>狼人</Text>
          </View>
          <View style={notepadStyles.legendItem}>
            <View style={[notepadStyles.legendDot, notepadStyles.legendDotThird]} />
            <Text style={notepadStyles.legendText}>第三方</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
