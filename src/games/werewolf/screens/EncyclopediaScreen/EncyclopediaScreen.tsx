/**
 * EncyclopediaScreen - gameplay guide and encyclopedia (roles + boards)
 *
 * Composes gameplay, role and board tabs; reads the matching active room for public configuration.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAllRoleIds, PRESET_TEMPLATES } from '@game-judge/game-engine/games/werewolf/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameScreen, gameScreenStyles } from '@/components/GameScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { WerewolfGuideTab } from '@/games/werewolf/navigation/types';
import { parseWerewolfGuideRouteParams } from '@/games/werewolf/navigation/werewolfGameNavigation';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, withAlpha } from '@/theme';

import { BoardsGuideContent } from './BoardsGuideContent';
import { SegmentedControl } from './components/SegmentedControl';
import { RolesGuideContent } from './RolesGuideContent';
import { useEncyclopediaScreenState } from './useEncyclopediaScreenState';
import { WerewolfGameplayContent } from './WerewolfGameplayContent';

// ── Types ─────────────────────────────────────────────────────────────────────

const GUIDE_SEGMENTS: readonly { key: WerewolfGuideTab; label: string }[] = [
  { key: 'gameplay', label: '玩法' },
  { key: 'roles', label: `角色 · ${getAllRoleIds().length}` },
  { key: 'boards', label: `板子 · ${PRESET_TEMPLATES.length}` },
];

// ── Component ─────────────────────────────────────────────────────────────────

/** Role encyclopedia / board guide screen. */
export const EncyclopediaScreen: React.FC<{ readonly client: WerewolfGameClient }> = ({
  client,
}) => {
  const insets = useSafeAreaInsets();
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
  const [activeTab, setActiveTab] = useState<WerewolfGuideTab>(initialTab);

  const rolesState = useEncyclopediaScreenState(routeParams.roleId);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  // Boards search state (lifted here so headerRight can render the button)
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

  const headerRight =
    activeTab === 'roles' ? (
      <View style={styles.headerRight}>
        <Button
          variant="icon"
          onPress={() => rolesState.setTagDropdownVisible(true)}
          style={rolesState.activeTag ? styles.headerIconButtonActive : undefined}
          accessibilityLabel="能力筛选"
        >
          <Ionicons
            name="filter"
            size={componentSizes.icon.md}
            color={rolesState.activeTag ? colors.primary : colors.text}
          />
        </Button>
        <Button variant="icon" onPress={rolesState.toggleSearch} accessibilityLabel="搜索">
          <Ionicons
            name={rolesState.searchVisible ? 'close' : 'search'}
            size={componentSizes.icon.md}
            color={colors.text}
          />
        </Button>
      </View>
    ) : activeTab === 'boards' ? (
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
    ) : undefined;

  return (
    <GameScreen
      testID={TESTIDS.encyclopediaScreenRoot}
      header={
        <ScreenHeader
          title="狼人杀玩法"
          onBack={handleGoBack}
          topInset={insets.top}
          headerRight={headerRight}
        />
      }
    >
      <View style={gameScreenStyles.catalog}>
        <SegmentedControl
          segments={GUIDE_SEGMENTS}
          activeKey={activeTab}
          onChangeKey={setActiveTab}
        />
        <View style={styles.content}>
          {activeTab === 'gameplay' && (
            <WerewolfGameplayContent
              gameState={gameState}
              isHost={isHost}
              hasRoomContext={routeParams.roomCode !== undefined}
            />
          )}
          {activeTab === 'roles' && <RolesGuideContent state={rolesState} />}
          {activeTab === 'boards' && (
            <BoardsGuideContent
              searchVisible={boardsSearchVisible}
              searchQuery={boardsSearchQuery}
              setSearchQuery={setBoardsSearchQuery}
              tagFilter={boardsTagFilter}
              setTagFilter={setBoardsTagFilter}
              tagFilterDropdownVisible={boardsTagFilterVisible}
              setTagFilterDropdownVisible={setBoardsTagFilterVisible}
            />
          )}
        </View>
      </View>
    </GameScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButtonActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
});
