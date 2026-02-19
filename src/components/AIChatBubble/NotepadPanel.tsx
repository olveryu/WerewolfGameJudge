/**
 * NotepadPanel - 笔记面板（全屏 NotepadModal 内嵌单列 12 行）
 *
 * 显示玩家卡片列表：每行包含座位号🎭（可点击选角色）+ 角色徽标 + 上警标签 + 笔记输入。
 * 点击座位号弹出角色选择气泡，选中后在座位号旁显示角色徽标。
 * 卡片背景色随角色猜测自动变化（好人阵营/狼人阵营）。
 * 接收 notepad 状态和操作回调（来自 useNotepad），接收 styles prop。
 * 不直接调用 service / AsyncStorage / game-engine。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  Modal,
  type NativeSyntheticEvent,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NotepadStyles } from './AIChatBubble.styles';
import type { NotepadState, RoleTagInfo } from './useNotepad';

// ── Constants ────────────────────────────────────────────

const MIN_INPUT_HEIGHT = 22;

// ── NotepadCard (独立组件，管理自身 TextInput 高度) ─────

interface NotepadCardProps {
  seat: number;
  hand: boolean;
  selectedRoleId: RoleId | null;
  noteText: string;
  roleTags: readonly RoleTagInfo[];
  onNoteChange: (seat: number, text: string) => void;
  onToggleHand: (seat: number) => void;
  onSeatPress: (seat: number) => void;
  styles: NotepadStyles;
}

const NotepadCard: React.FC<NotepadCardProps> = React.memo(
  ({
    seat,
    hand,
    selectedRoleId,
    noteText,
    roleTags,
    onNoteChange,
    onToggleHand,
    onSeatPress,
    styles,
  }) => {
    const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);

    const handleContentSizeChange = useCallback(
      (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
        const h = e.nativeEvent.contentSize.height;
        setInputHeight(Math.max(MIN_INPUT_HEIGHT, h));
      },
      [],
    );

    const selectedTag = selectedRoleId
      ? (roleTags.find((t) => t.roleId === selectedRoleId) ?? null)
      : null;

    const cardBgStyle = selectedTag
      ? selectedTag.team === 'wolf'
        ? styles.cardBad
        : styles.cardGood
      : undefined;

    return (
      <View style={[styles.card, cardBgStyle]}>
        {/* Seat + role badge + hand */}
        <View style={styles.cardHeader}>
          <TouchableOpacity
            onPress={() => onSeatPress(seat)}
            style={styles.seatBtn}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Text style={styles.seatNumber}>{seat}</Text>
            <View
              style={[
                styles.roleBadge,
                selectedTag &&
                  (selectedTag.team === 'wolf' ? styles.roleBadgeBad : styles.roleBadgeGood),
              ]}
            >
              <Text style={selectedTag ? styles.roleBadgeText : styles.seatPlaceholder}>
                {selectedTag ? selectedTag.shortName : '🎭'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onToggleHand(seat)}
            style={[styles.handTag, hand && styles.handTagActive]}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Text style={[styles.handTagText, hand && styles.handTagTextActive]}>上警</Text>
          </TouchableOpacity>
        </View>

        {/* Note input — fills remaining width, auto-grow */}
        <TextInput
          style={[styles.noteInput, { height: inputHeight }]}
          value={noteText}
          onChangeText={(text) => onNoteChange(seat, text)}
          onContentSizeChange={handleContentSizeChange}
          multiline
        />
      </View>
    );
  },
);
NotepadCard.displayName = 'NotepadCard';

// ── RolePickerModal (角色选择气泡) ───────────────────────

interface RolePickerModalProps {
  seat: number | null;
  selectedRoleId: RoleId | null;
  roleTags: readonly RoleTagInfo[];
  onSelect: (seat: number, roleId: RoleId | null) => void;
  onClose: () => void;
  styles: NotepadStyles;
}

const RolePickerModal: React.FC<RolePickerModalProps> = React.memo(
  ({ seat, selectedRoleId, roleTags, onSelect, onClose, styles }) => {
    if (seat === null) return null;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.popoverOverlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.popover} onStartShouldSetResponder={() => true}>
            <Text style={styles.popoverTitle}>座位 {seat} · 角色猜测</Text>
            <View style={styles.popoverGrid}>
              {roleTags.map((tag) => {
                const isSelected = selectedRoleId === tag.roleId;
                const isGood = tag.team !== 'wolf';
                return (
                  <TouchableOpacity
                    key={tag.roleId}
                    onPress={() => onSelect(seat, tag.roleId)}
                    style={[
                      styles.popoverTag,
                      isSelected &&
                        (isGood ? styles.popoverTagSelectedGood : styles.popoverTagSelectedBad),
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.popoverTagText, isSelected && styles.popoverTagTextSelected]}
                    >
                      {tag.shortName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* Clear selection */}
              <TouchableOpacity
                onPress={() => onSelect(seat, null)}
                style={styles.popoverClearBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.popoverClearText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  },
);
RolePickerModal.displayName = 'RolePickerModal';

// ── Props ────────────────────────────────────────────────

interface NotepadPanelProps {
  state: NotepadState;
  playerCount: number;
  roleTags: readonly RoleTagInfo[];
  onNoteChange: (seat: number, text: string) => void;
  onToggleHand: (seat: number) => void;
  onSetRole: (seat: number, roleId: RoleId | null) => void;
  styles: NotepadStyles;
}

// ── Seat list data ───────────────────────────────────────

interface SeatItem {
  seat: number;
}

// ── Component ────────────────────────────────────────────

export const NotepadPanel: React.FC<NotepadPanelProps> = ({
  state,
  playerCount,
  roleTags,
  onNoteChange,
  onToggleHand,
  onSetRole,
  styles,
}) => {
  const [pickerSeat, setPickerSeat] = useState<number | null>(null);

  const seats = React.useMemo<SeatItem[]>(() => {
    const arr: SeatItem[] = [];
    for (let i = 1; i <= playerCount; i++) {
      arr.push({ seat: i });
    }
    return arr;
  }, [playerCount]);

  const keyExtractor = useCallback((item: SeatItem) => String(item.seat), []);

  const handleSeatPress = useCallback((seat: number) => {
    setPickerSeat(seat);
  }, []);

  const handlePickerSelect = useCallback(
    (seat: number, roleId: RoleId | null) => {
      onSetRole(seat, roleId);
      setPickerSeat(null);
    },
    [onSetRole],
  );

  const handlePickerClose = useCallback(() => {
    setPickerSeat(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SeatItem>) => {
      const { seat } = item;
      return (
        <NotepadCard
          seat={seat}
          hand={state.handStates[seat] ?? false}
          selectedRoleId={state.roleGuesses[seat] ?? null}
          noteText={state.playerNotes[seat] ?? ''}
          roleTags={roleTags}
          onNoteChange={onNoteChange}
          onToggleHand={onToggleHand}
          onSeatPress={handleSeatPress}
          styles={styles}
        />
      );
    },
    [state, onToggleHand, handleSeatPress, onNoteChange, styles, roleTags],
  );

  const pickerSelectedRoleId = pickerSeat !== null ? (state.roleGuesses[pickerSeat] ?? null) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={seats}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />
      <RolePickerModal
        seat={pickerSeat}
        selectedRoleId={pickerSelectedRoleId}
        roleTags={roleTags}
        onSelect={handlePickerSelect}
        onClose={handlePickerClose}
        styles={styles}
      />
    </View>
  );
};
