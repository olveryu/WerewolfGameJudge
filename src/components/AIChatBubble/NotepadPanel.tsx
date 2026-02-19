/**
 * NotepadPanel - 笔记面板（全屏 NotepadModal 内嵌列表）
 *
 * 显示玩家笔记行列表：每行包含座位号 + 🙋上警按钮 + 👤身份按钮 + 文本输入。
 * 接收 notepad 状态和操作回调（来自 useNotepad），接收 styles prop。
 * 不直接调用 service / AsyncStorage / game-engine。
 */

import React, { useCallback } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { ThemeColors } from '@/theme';

import type { NotepadStyles } from './AIChatBubble.styles';
import type { HandState, IdentityState, NotepadState } from './useNotepad';

// ── Emoji maps ───────────────────────────────────────────

const HAND_EMOJI: Record<HandState, string> = { 0: '🙋', 1: '🙋', 2: '💧' };
const IDENTITY_EMOJI: Record<IdentityState, string> = { 0: '👤', 1: '👍', 2: '👎', 3: '❓' };

// ── Props ────────────────────────────────────────────────

interface NotepadPanelProps {
  state: NotepadState;
  playerCount: number;
  onNoteChange: (seat: number, text: string) => void;
  onCycleHand: (seat: number) => void;
  onCycleIdentity: (seat: number) => void;
  styles: NotepadStyles;
  colors: ThemeColors;
}

// ── Seat list data ───────────────────────────────────────

interface SeatItem {
  seat: number;
}

// ── Component ────────────────────────────────────────────

export const NotepadPanel: React.FC<NotepadPanelProps> = ({
  state,
  playerCount,
  onNoteChange,
  onCycleHand,
  onCycleIdentity,
  styles,
  colors,
}) => {
  // Pre-build seat data array (stable if playerCount doesn't change)
  const seats = React.useMemo<SeatItem[]>(() => {
    const arr: SeatItem[] = [];
    for (let i = 1; i <= playerCount; i++) {
      arr.push({ seat: i });
    }
    return arr;
  }, [playerCount]);

  const keyExtractor = useCallback((item: SeatItem) => String(item.seat), []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SeatItem>) => {
      const { seat } = item;
      const hand: HandState = state.handStates[seat] ?? 0;
      const identity: IdentityState = state.identityStates[seat] ?? 0;
      const noteText = state.playerNotes[seat] ?? '';

      const handActive = hand !== 0;
      const identityActive = identity !== 0;
      const isBad = identity === 2;
      const isWithdrawn = hand === 2;

      return (
        <View style={styles.playerRow}>
          <Text style={styles.playerLabel}>{seat}</Text>
          <TouchableOpacity
            onPress={() => onCycleHand(seat)}
            style={[
              styles.tagBtn,
              handActive && styles.tagBtnActive,
              isWithdrawn && styles.tagBtnWithdrawn,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tagBtnText, !handActive && styles.tagBtnTextInactive]}>
              {HAND_EMOJI[hand]}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onCycleIdentity(seat)}
            style={[
              styles.tagBtn,
              identityActive && styles.tagBtnActive,
              isBad && styles.tagBtnBad,
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tagBtnText, !identityActive && styles.tagBtnTextInactive]}>
              {IDENTITY_EMOJI[identity]}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={styles.playerInput}
            value={noteText}
            onChangeText={(text) => onNoteChange(seat, text)}
            placeholder="笔记…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      );
    },
    [state, onCycleHand, onCycleIdentity, onNoteChange, styles, colors.textMuted],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={seats}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};
