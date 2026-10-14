/**
 * EncyclopediaScreen — 狼人杀图鉴绑定层。
 *
 * 分段壳、角色段机器与详情 sheet 都是共享件（@/features/encyclopedia），
 * 本文件只注入狼人杀专属部分：引擎 spec 数据源、玩法段（读本局公开配置）、
 * 板子段（含其 header 搜索/筛选动作）与 AI 攻略 pill。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAllRoleIds, PRESET_TEMPLATES } from '@game-judge/game-engine/games/werewolf/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EncyclopediaRolesHeaderActions } from '@/features/encyclopedia/EncyclopediaRolesHeaderActions';
import {
  type EncyclopediaSegment,
  EncyclopediaShell,
} from '@/features/encyclopedia/EncyclopediaShell';
import { useEncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { parseWerewolfGuideRouteParams } from '@/games/werewolf/navigation/werewolfGameNavigation';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, spacing, withAlpha } from '@/theme';

import { BoardsGuideContent } from './BoardsGuideContent';
import { RolesGuideContent } from './RolesGuideContent';
import { WEREWOLF_ENCYCLOPEDIA_SOURCE } from './werewolfEncyclopediaSource';
import { WerewolfGameplayContent } from './WerewolfGameplayContent';

// ── Types ─────────────────────────────────────────────────────────────────────

const GUIDE_SEGMENTS: readonly EncyclopediaSegment[] = [
  { key: 'gameplay', label: '玩法' },
  { key: 'roles', label: `角色 · ${getAllRoleIds().length}` },
  { key: 'boards', label: `板子 · ${PRESET_TEMPLATES.length}` },
];

// ── Component ─────────────────────────────────────────────────────────────────

/** Role encyclopedia / board guide screen. */
export const EncyclopediaScreen: React.FC<{ readonly client: WerewolfGameClient }> = ({
  client,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameGuide'>>();
  const routeParams = parseWerewolfGuideRouteParams(route.params);
  const room = useRoomSessionSnapshot(client.roomSession);
  const gameState =
    room.phase === 'ready' && room.identity.room.roomCode === routeParams.roomCode
      ? room.snapshot.state
      : null;
  const isHost =
    room.phase === 'ready' && gameState !== null && gameState.hostUserId === room.identity.userId;
  const initialTab = routeParams.initialTab ?? (routeParams.roleId ? 'roles' : 'gameplay');

  const rolesState = useEncyclopediaRolesState(WEREWOLF_ENCYCLOPEDIA_SOURCE, routeParams.roleId);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  // Boards search state (lifted here so the segment header actions can render the buttons)
  const [boardsSearchVisible, setBoardsSearchVisible] = useState(false);
  const [boardsSearchQuery, setBoardsSearchQuery] = useState('');
  const [boardsTagFilterVisible, setBoardsTagFilterVisible] = useState(false);
  const [boardsTagFilter, setBoardsTagFilter] = useState<string | null>(null);

  const toggleBoardsSearch = useCallback(() => {
    setBoardsSearchVisible((prev) => {
      if (prev) setBoardsSearchQuery('');
      return !prev;
    });
  }, []);

  const boardsHeaderActions = (
    <View style={styles.headerRight}>
      <Button
        variant="icon"
        onPress={() => setBoardsTagFilterVisible(true)}
        style={boardsTagFilter ? styles.headerIconButtonActive : undefined}
        accessibilityLabel="标签筛选"
      >
        <Ionicons
          name="filter"
          size={componentSizes.icon.md}
          color={boardsTagFilter ? colors.primary : colors.text}
        />
      </Button>
      <Button variant="icon" onPress={toggleBoardsSearch} accessibilityLabel="搜索板子">
        <Ionicons
          name={boardsSearchVisible ? 'close' : 'search'}
          size={componentSizes.icon.md}
          color={colors.text}
        />
      </Button>
    </View>
  );

  const renderSegment = useCallback(
    (segmentKey: string) => {
      if (segmentKey === 'roles') {
        return <RolesGuideContent state={rolesState} />;
      }
      if (segmentKey === 'boards') {
        return (
          <BoardsGuideContent
            searchVisible={boardsSearchVisible}
            searchQuery={boardsSearchQuery}
            setSearchQuery={setBoardsSearchQuery}
            tagFilter={boardsTagFilter}
            setTagFilter={setBoardsTagFilter}
            tagFilterDropdownVisible={boardsTagFilterVisible}
            setTagFilterDropdownVisible={setBoardsTagFilterVisible}
          />
        );
      }
      return (
        <WerewolfGameplayContent
          gameState={gameState}
          isHost={isHost}
          hasRoomContext={routeParams.roomCode !== undefined}
        />
      );
    },
    [
      boardsSearchVisible,
      boardsSearchQuery,
      boardsTagFilter,
      boardsTagFilterVisible,
      gameState,
      isHost,
      rolesState,
      routeParams.roomCode,
    ],
  );

  return (
    <EncyclopediaShell
      title="狼人杀玩法"
      testID={TESTIDS.encyclopediaScreenRoot}
      onBack={handleGoBack}
      segments={GUIDE_SEGMENTS}
      initialTab={initialTab}
      renderSegment={renderSegment}
      segmentHeaderActions={{
        roles: (
          <EncyclopediaRolesHeaderActions
            source={WEREWOLF_ENCYCLOPEDIA_SOURCE}
            state={rolesState}
          />
        ),
        boards: boardsHeaderActions,
      }}
    />
  );
};

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  headerIconButtonActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
});
