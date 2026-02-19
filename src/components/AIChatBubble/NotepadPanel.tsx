/**
 * NotepadPanel - 笔记面板（全屏 NotepadModal 内嵌 2×6 网格）
 *
 * 显示玩家卡片网格：每张卡片包含座位号 + 身份按钮 + 上警标签 + 角色猜测标签行 + 笔记输入。
 * 卡片背景色随身份标记变化（好人/坏人/存疑）。
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
import {
  GOOD_ROLES,
  type IdentityState,
  type NotepadState,
  ROLE_TAGS,
  type RoleTag,
} from './useNotepad';

// ── Emoji map ────────────────────────────────────────────

const IDENTITY_EMOJI: Record<IdentityState, string> = { 0: '👤', 1: '👍', 2: '👎', 3: '❓' };

// ── Props ────────────────────────────────────────────────

interface NotepadPanelProps {
  state: NotepadState;
  playerCount: number;
  onNoteChange: (seat: number, text: string) => void;
  onToggleHand: (seat: number) => void;
  onCycleIdentity: (seat: number) => void;
  onSetRole: (seat: number, role: RoleTag | null) => void;
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
  onToggleHand,
  onCycleIdentity,
  onSetRole,
  styles,
  colors,
}) => {
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
      const identity: IdentityState = state.identityStates[seat] ?? 0;
      const hand = state.handStates[seat] ?? false;
      const role: RoleTag | null = state.roleGuesses[seat] ?? null;
      const noteText = state.playerNotes[seat] ?? '';

      const cardBgStyle =
        identity === 1
          ? styles.cardGood
          : identity === 2
            ? styles.cardBad
            : identity === 3
              ? styles.cardSuspect
              : undefined;

      return (
        <View style={[styles.card, cardBgStyle]}>
          {/* Header: seat + identity + hand */}
          <View style={styles.cardHeader}>
            <Text style={styles.seatNumber}>{seat}</Text>
            <TouchableOpacity
              onPress={() => onCycleIdentity(seat)}
              style={styles.identityBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.identityBtnText}>{IDENTITY_EMOJI[identity]}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onToggleHand(seat)}
              style={[styles.handTag, hand && styles.handTagActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.handTagText, hand && styles.handTagTextActive]}>上警</Text>
            </TouchableOpacity>
          </View>

          {/* Role guess tags */}
          <View style={styles.roleTagRow}>
            {ROLE_TAGS.map((tag) => {
              const isSelected = role === tag;
              const isGood = GOOD_ROLES.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => onSetRole(seat, tag)}
                  style={[
                    styles.roleTag,
                    isSelected && (isGood ? styles.roleTagSelectedGood : styles.roleTagSelectedBad),
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleTagText, isSelected && styles.roleTagTextSelected]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note input */}
          <TextInput
            style={styles.noteInput}
            value={noteText}
            onChangeText={(text) => onNoteChange(seat, text)}
            placeholder="笔记…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      );
    },
    [state, onCycleIdentity, onToggleHand, onSetRole, onNoteChange, styles, colors.textMuted],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={seats}
        numColumns={2}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
};
