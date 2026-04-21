/**
 * NotepadScreen - 全屏笔记本页面
 *
 * 独立 Screen，从 RoomScreen 的 BoardInfoCard "笔记"按钮导航进入（modal presentation）。
 * 展示单列笔记面板 + 公共笔记区 + 阵营图例。
 * 通过 useGameFacade() 获取 facade → useNotepad 管理纯客户端笔记状态。
 * 不直接调用 service（笔记持久化由 useNotepad 内部 AsyncStorage 完成）。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ROLE_SPECS } from '@werewolf/game-engine/models/roles';
import React, { useCallback, useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildNotepadSummary } from '@/components/AIChatBubble/notepadSummary';
import { Button } from '@/components/Button';
import { NotepadPanel } from '@/components/NotepadPanel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UI_ICONS } from '@/config/iconTokens';
import { useGameFacade } from '@/contexts';
import { useNotepad } from '@/hooks/useNotepad';
import { RootStackParamList } from '@/navigation/types';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { colors, componentSizes, fixed, typography } from '@/theme';
import { requestAIChatMessage } from '@/utils/aiChatBridge';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';

import { createNotepadScreenStyles } from './NotepadScreen.styles';

// ── Component ────────────────────────────────────────────

export const NotepadScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createNotepadScreenStyles(colors), []);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Notepad'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Notepad'>>();

  const facade = useGameFacade();
  const notepad = useNotepad(facade);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Stale Tab reload: stack lost, navigate back to Room with roomCode from URL
      navigation.navigate('Room', { roomCode: route.params.roomCode, isHost: false });
    }
  }, [navigation, route.params.roomCode]);

  const handleAIAnalysis = useCallback(() => {
    if (!isAIChatReady()) {
      showErrorAlert('AI 助手', 'AI 助手暂不可用');
      return;
    }

    // Build recorder's own role info
    const mySeat = facade.getMySeatNumber();
    const gameState = facade.getState();
    const myRole = mySeat != null ? gameState?.players[mySeat]?.role : undefined;
    const myRoleInfo =
      mySeat != null && myRole
        ? { seat: mySeat + 1, roleName: ROLE_SPECS[myRole]?.displayName ?? myRole }
        : undefined;

    const summary = buildNotepadSummary(notepad.state, notepad.playerCount, myRoleInfo);
    if (!summary) {
      showErrorAlert('笔记为空', '请先记录一些笔记再进行分析');
      return;
    }

    showConfirmAlert('AI 分析', '将笔记发送给 AI 进行局势分析？', () => {
      requestAIChatMessage({
        fullText: summary,
        displayText: '分析我的笔记',
        maxTokens: 10000,
      });
    });
  }, [facade, notepad.state, notepad.playerCount]);

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
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {/* Header */}
      <ScreenHeader
        title="笔记"
        onBack={handleGoBack}
        topInset={insets.top}
        headerRight={
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={handleAIAnalysis}
              style={styles.aiAnalysisBtn}
              activeOpacity={fixed.activeOpacity}
            >
              <Ionicons
                name={UI_ICONS.AI_ASSISTANT}
                size={typography.secondary}
                color={colors.primary}
              />
              <Text style={styles.aiAnalysisBtnText}>AI分析</Text>
            </TouchableOpacity>
            <Button variant="icon" onPress={notepad.clearAll} accessibilityLabel="清除笔记">
              <Ionicons name={UI_ICONS.DELETE} size={componentSizes.icon.md} color={colors.text} />
            </Button>
          </View>
        }
      />

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
            placeholder="自由记录"
            placeholderTextColor={styles.placeholderColor}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={styles.publicInput}
            value={notepad.state.publicNoteRight}
            onChangeText={notepad.setPublicNoteRight}
            placeholder="投票记录"
            placeholderTextColor={styles.placeholderColor}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Legend */}
      <View style={[panelStyles.legend, insets.bottom > 0 && { paddingBottom: insets.bottom }]}>
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
