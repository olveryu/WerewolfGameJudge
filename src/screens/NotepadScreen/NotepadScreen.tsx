/**
 * NotepadScreen - 全屏笔记本页面
 *
 * 独立 Screen，从 RoomScreen 的 BoardInfoCard "笔记"按钮导航进入（modal presentation）。
 * 展示单列笔记面板 + 公共笔记区 + 阵营图例。
 * 通过 useGameFacade() 获取 facade → useNotepad 管理纯客户端笔记状态。
 * 不直接调用 service（笔记持久化由 useNotepad 内部 AsyncStorage 完成）。
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotepadPanel } from '@/components/NotepadPanel';
import { UI_ICONS } from '@/config/iconTokens';
import { useGameFacade } from '@/contexts';
import { useNotepad } from '@/hooks/useNotepad';
import { fixed, typography, useColors } from '@/theme';

import { createNotepadScreenStyles } from './NotepadScreen.styles';

// ── Component ────────────────────────────────────────────

export const NotepadScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createNotepadScreenStyles(colors), [colors]);
  const navigation = useNavigation();

  const facade = useGameFacade();
  const notepad = useNotepad(facade);

  const panelStyles = useMemo(
    () => ({
      container: styles.container,
      list: styles.list,
      listContent: styles.listContent,
      card: styles.card,
      cardWolf: styles.cardWolf,
      cardGod: styles.cardGod,
      cardVillager: styles.cardVillager,
      cardThird: styles.cardThird,
      cardHeader: styles.cardHeader,
      seatBtn: styles.seatBtn,
      seatNumber: styles.seatNumber,
      seatPlaceholder: styles.seatPlaceholder,
      roleBadge: styles.roleBadge,
      roleBadgeEmpty: styles.roleBadgeEmpty,
      roleBadgeWolf: styles.roleBadgeWolf,
      roleBadgeGod: styles.roleBadgeGod,
      roleBadgeVillager: styles.roleBadgeVillager,
      roleBadgeThird: styles.roleBadgeThird,
      roleBadgeText: styles.roleBadgeText,
      roleBadgeTextWolf: styles.roleBadgeTextWolf,
      roleBadgeTextGod: styles.roleBadgeTextGod,
      roleBadgeTextVillager: styles.roleBadgeTextVillager,
      roleBadgeTextThird: styles.roleBadgeTextThird,
      handTag: styles.handTag,
      handTagActive: styles.handTagActive,
      handTagText: styles.handTagText,
      handTagTextActive: styles.handTagTextActive,
      noteInput: styles.noteInput,
      placeholderColor: styles.placeholderColor,
      popoverOverlay: styles.popoverOverlay,
      popover: styles.popover,
      popoverTitle: styles.popoverTitle,
      popoverGrid: styles.popoverGrid,
      popoverTag: styles.popoverTag,
      popoverTagSelectedWolf: styles.popoverTagSelectedWolf,
      popoverTagSelectedGod: styles.popoverTagSelectedGod,
      popoverTagSelectedVillager: styles.popoverTagSelectedVillager,
      popoverTagSelectedThird: styles.popoverTagSelectedThird,
      popoverTagText: styles.popoverTagText,
      popoverTagTextWolf: styles.popoverTagTextWolf,
      popoverTagTextGod: styles.popoverTagTextGod,
      popoverTagTextVillager: styles.popoverTagTextVillager,
      popoverTagTextThird: styles.popoverTagTextThird,
      popoverTagTextSelected: styles.popoverTagTextSelected,
      popoverClearBtn: styles.popoverClearBtn,
      popoverClearText: styles.popoverClearText,
      legend: styles.legend,
      legendItem: styles.legendItem,
      legendDot: styles.legendDot,
      legendDotWolf: styles.legendDotWolf,
      legendDotGod: styles.legendDotGod,
      legendDotVillager: styles.legendDotVillager,
      legendDotThird: styles.legendDotThird,
      legendText: styles.legendText,
    }),
    [styles],
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <Ionicons name={UI_ICONS.NOTE} size={typography.subtitle} />
          {' 笔记'}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={notepad.clearAll}
            style={styles.headerBtn}
            activeOpacity={fixed.activeOpacity}
          >
            <Ionicons name={UI_ICONS.DELETE} size={typography.body} style={styles.headerBtnText} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.headerBtnText}>✕</Text>
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
        styles={panelStyles}
      />

      {/* Public note area — side-by-side */}
      <View style={styles.publicSection}>
        <Text style={styles.publicLabel}>
          <Ionicons name={UI_ICONS.RECORD} size={typography.secondary} />
          {' 记录'}
        </Text>
        <View style={styles.publicRow}>
          <TextInput
            style={styles.publicInput}
            value={notepad.state.publicNoteLeft}
            onChangeText={notepad.setPublicNoteLeft}
            placeholder="自由记录…"
            placeholderTextColor={styles.placeholderColor}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={styles.publicInput}
            value={notepad.state.publicNoteRight}
            onChangeText={notepad.setPublicNoteRight}
            placeholder="投票记录…"
            placeholderTextColor={styles.placeholderColor}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Legend */}
      <View style={panelStyles.legend}>
        <View style={panelStyles.legendItem}>
          <View style={[panelStyles.legendDot, panelStyles.legendDotGod]} />
          <Text style={panelStyles.legendText}>神职</Text>
        </View>
        <View style={panelStyles.legendItem}>
          <View style={[panelStyles.legendDot, panelStyles.legendDotVillager]} />
          <Text style={panelStyles.legendText}>平民</Text>
        </View>
        <View style={panelStyles.legendItem}>
          <View style={[panelStyles.legendDot, panelStyles.legendDotWolf]} />
          <Text style={panelStyles.legendText}>狼人</Text>
        </View>
        <View style={panelStyles.legendItem}>
          <View style={[panelStyles.legendDot, panelStyles.legendDotThird]} />
          <Text style={panelStyles.legendText}>第三方</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};
