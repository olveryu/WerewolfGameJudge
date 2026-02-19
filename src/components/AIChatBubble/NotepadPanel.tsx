/**
 * NotepadPanel - 笔记面板（全屏 NotepadModal 内嵌 2×6 网格）
 *
 * 显示玩家卡片网格：每张卡片包含座位号 + 身份按钮 + 上警标签 + 角色猜测标签行 + 笔记输入。
 * 卡片背景色随身份标记变化（好人/坏人/存疑）。
 * 接收 notepad 状态和操作回调（来自 useNotepad），接收 styles prop。
 * 不直接调用 service / AsyncStorage / game-engine。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NotepadStyles } from './AIChatBubble.styles';
import type { IdentityState, NotepadState, RoleTagInfo } from './useNotepad';

// ── Constants ────────────────────────────────────────────

const IDENTITY_EMOJI: Record<IdentityState, string> = { 0: '👤', 1: '👍', 2: '👎', 3: '❓' };
const MIN_INPUT_HEIGHT = 22;

// ── NotepadCard (独立组件，管理自身 TextInput 高度) ─────

interface NotepadCardProps {
  seat: number;
  identity: IdentityState;
  hand: boolean;
  selectedRoleId: RoleId | null;
  noteText: string;
  roleTags: readonly RoleTagInfo[];
  onNoteChange: (seat: number, text: string) => void;
  onToggleHand: (seat: number) => void;
  onCycleIdentity: (seat: number) => void;
  onSetRole: (seat: number, roleId: RoleId | null) => void;
  styles: NotepadStyles;
}

const NotepadCard: React.FC<NotepadCardProps> = React.memo(
  ({
    seat,
    identity,
    hand,
    selectedRoleId,
    noteText,
    roleTags,
    onNoteChange,
    onToggleHand,
    onCycleIdentity,
    onSetRole,
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
            hitSlop={6}
            activeOpacity={0.7}
          >
            <Text style={styles.identityBtnText}>{IDENTITY_EMOJI[identity]}</Text>
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

        {/* Role guess tags */}
        <View style={styles.roleTagRow}>
          {roleTags.map((tag) => {
            const isSelected = selectedRoleId === tag.roleId;
            const isGood = tag.team !== 'wolf';
            return (
              <TouchableOpacity
                key={tag.roleId}
                onPress={() => onSetRole(seat, tag.roleId)}
                style={[
                  styles.roleTag,
                  isSelected && (isGood ? styles.roleTagSelectedGood : styles.roleTagSelectedBad),
                ]}
                hitSlop={2}
                activeOpacity={0.7}
              >
                <Text style={[styles.roleTagText, isSelected && styles.roleTagTextSelected]}>
                  {tag.shortName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Note input — auto-grow via onContentSizeChange */}
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

// ── Props ────────────────────────────────────────────────

interface NotepadPanelProps {
  state: NotepadState;
  playerCount: number;
  roleTags: readonly RoleTagInfo[];
  onNoteChange: (seat: number, text: string) => void;
  onToggleHand: (seat: number) => void;
  onCycleIdentity: (seat: number) => void;
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
  onCycleIdentity,
  onSetRole,
  styles,
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
      return (
        <NotepadCard
          seat={seat}
          identity={state.identityStates[seat] ?? 0}
          hand={state.handStates[seat] ?? false}
          selectedRoleId={state.roleGuesses[seat] ?? null}
          noteText={state.playerNotes[seat] ?? ''}
          roleTags={roleTags}
          onNoteChange={onNoteChange}
          onToggleHand={onToggleHand}
          onCycleIdentity={onCycleIdentity}
          onSetRole={onSetRole}
          styles={styles}
        />
      );
    },
    [state, onCycleIdentity, onToggleHand, onSetRole, onNoteChange, styles, roleTags],
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
