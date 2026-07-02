/**
 * NotepadPanel - Notepad panel (single-column 12-row embed in NotepadScreen)
 *
 * Renders a player card list: each row has seat number (tap to select role) + role badge + hand-up tag + note input.
 * Tapping the seat number opens a role-picker popover; selection shows a role badge next to the seat number.
 * Card background color follows the role guess (4-color distinction: wolf / god / villager / third party).
 * Receives notepad state and action callbacks (from useWerewolfNotepad), plus a styles prop.
 * Does not directly call service / AsyncStorage / game-engine.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { Faction } from '@werewolf/game-engine/werewolf/models/roles/spec/types';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Text,
  TextInput,
  type TextInputContentSizeChangeEventData,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { Modal } from '@/components/AppModal';
import type { NotepadState, RoleTagInfo } from '@/hooks/werewolf/useWerewolfNotepad';
import { fixed } from '@/theme';

// ── NotepadStyles (NotepadPanel depends on this type) ─────────────

interface NotepadStyles {
  container: ViewStyle;
  list: ViewStyle;
  listContent: ViewStyle;
  card: ViewStyle;
  cardWolf: ViewStyle;
  cardGod: ViewStyle;
  cardVillager: ViewStyle;
  cardThird: ViewStyle;
  cardHeader: ViewStyle;
  seatBtn: ViewStyle;
  seat: TextStyle;
  seatPlaceholder: TextStyle;
  roleBadge: ViewStyle;
  roleBadgeEmpty: ViewStyle;
  roleBadgeWolf: ViewStyle;
  roleBadgeGod: ViewStyle;
  roleBadgeVillager: ViewStyle;
  roleBadgeThird: ViewStyle;
  roleBadgeText: TextStyle;
  roleBadgeTextWolf: TextStyle;
  roleBadgeTextGod: TextStyle;
  roleBadgeTextVillager: TextStyle;
  roleBadgeTextThird: TextStyle;
  handTag: ViewStyle;
  handTagActive: ViewStyle;
  handTagText: TextStyle;
  handTagTextActive: TextStyle;
  noteInput: TextStyle;
  placeholderColor: string;
  popoverOverlay: ViewStyle;
  popover: ViewStyle;
  popoverTitle: TextStyle;
  popoverGrid: ViewStyle;
  popoverTag: ViewStyle;
  popoverTagSelectedWolf: ViewStyle;
  popoverTagSelectedGod: ViewStyle;
  popoverTagSelectedVillager: ViewStyle;
  popoverTagSelectedThird: ViewStyle;
  popoverTagText: TextStyle;
  popoverTagTextWolf: TextStyle;
  popoverTagTextGod: TextStyle;
  popoverTagTextVillager: TextStyle;
  popoverTagTextThird: TextStyle;
  popoverTagTextSelected: TextStyle;
  popoverClearBtn: ViewStyle;
  popoverClearText: TextStyle;
  legend: ViewStyle;
  legendItem: ViewStyle;
  legendDot: ViewStyle;
  legendDotWolf: ViewStyle;
  legendDotGod: ViewStyle;
  legendDotVillager: ViewStyle;
  legendDotThird: ViewStyle;
  legendText: TextStyle;
}

// ── Constants ────────────────────────────────────────────

const MIN_INPUT_HEIGHT = 22;

/** Map Faction to the corresponding style key suffix for 4-faction coloring */
function getFactionStyleKey(faction: Faction): 'Wolf' | 'God' | 'Villager' | 'Third' {
  switch (faction) {
    case Faction.Wolf:
      return 'Wolf';
    case Faction.God:
      return 'God';
    case Faction.Villager:
      return 'Villager';
    default:
      return 'Third';
  }
}

// ── NotepadCard (standalone component, manages its own TextInput height) ─────

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

    const factionKey = selectedTag ? getFactionStyleKey(selectedTag.faction) : null;
    const cardBgStyle = factionKey
      ? (styles[`card${factionKey}` as keyof NotepadStyles] as ViewStyle)
      : undefined;

    return (
      <View style={[styles.card, cardBgStyle]}>
        {/* Seat + role badge + hand */}
        <View style={styles.cardHeader}>
          <TouchableOpacity
            onPress={() => onSeatPress(seat)}
            style={styles.seatBtn}
            hitSlop={6}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.seat}>{seat}</Text>
            <View
              style={[
                styles.roleBadge,
                factionKey
                  ? (styles[`roleBadge${factionKey}` as keyof NotepadStyles] as ViewStyle) // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
                  : styles.roleBadgeEmpty,
              ]}
            >
              <Text
                style={[
                  selectedTag ? styles.roleBadgeText : styles.seatPlaceholder,
                  factionKey &&
                    (styles[`roleBadgeText${factionKey}` as keyof NotepadStyles] as TextStyle), // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
                ]}
              >
                {selectedTag ? selectedTag.shortName : '+'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onToggleHand(seat)}
            style={[styles.handTag, hand && styles.handTagActive]}
            hitSlop={6}
            activeOpacity={fixed.activeOpacity}
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
          placeholder="发言"
          placeholderTextColor={styles.placeholderColor}
          multiline
        />
      </View>
    );
  },
);
NotepadCard.displayName = 'NotepadCard';

// ── RolePickerModal (role-picker popover) ───────────────────────

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
                const fKey = getFactionStyleKey(tag.faction);
                return (
                  <TouchableOpacity
                    key={tag.roleId}
                    onPress={() => onSelect(seat, tag.roleId)}
                    style={[
                      styles.popoverTag,
                      isSelected &&
                        (styles[`popoverTagSelected${fKey}` as keyof NotepadStyles] as ViewStyle), // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
                    ]}
                    activeOpacity={fixed.activeOpacity}
                  >
                    <Text
                      style={[
                        styles.popoverTagText,
                        !isSelected &&
                          (styles[`popoverTagText${fKey}` as keyof NotepadStyles] as TextStyle), // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
                        isSelected && styles.popoverTagTextSelected,
                      ]}
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
                activeOpacity={fixed.activeOpacity}
              >
                <Ionicons name="close-circle-outline" style={styles.popoverClearText} />
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
