/**
 * EncyclopediaScreen - 图鉴（角色 + 板子）
 *
 * Thin shell: ScreenHeader + SegmentedControl("角色" | "板子") + tab content。
 * 具体内容由 RolesGuideContent / BoardsGuideContent 渲染。
 * 纯展示屏，不依赖 service，不含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { getAllRoleIds } from '@werewolf/game-engine/models/roles';
import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, withAlpha } from '@/theme';

import { BoardsGuideContent } from './BoardsGuideContent';
import { SegmentedControl } from './components/SegmentedControl';
import { RolesGuideContent } from './RolesGuideContent';
import { useEncyclopediaScreenState } from './useEncyclopediaScreenState';

// ── Types ─────────────────────────────────────────────────────────────────────

type GuideTab = 'roles' | 'boards';

const GUIDE_SEGMENTS: readonly { key: GuideTab; label: string }[] = [
  { key: 'roles', label: `角色 · ${getAllRoleIds().length}` },
  { key: 'boards', label: `板子 · ${PRESET_TEMPLATES.length}` },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const EncyclopediaScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Encyclopedia'>>();
  const initialTab = route.params?.initialTab ?? 'roles';
  const [activeTab, setActiveTab] = useState<GuideTab>(initialTab);

  const rolesState = useEncyclopediaScreenState();

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
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
    ) : (
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

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.encyclopediaScreenRoot}
    >
      <ScreenHeader
        title="图鉴"
        onBack={handleGoBack}
        topInset={insets.top}
        headerRight={headerRight}
      />
      <SegmentedControl
        segments={GUIDE_SEGMENTS}
        activeKey={activeTab}
        onChangeKey={setActiveTab}
      />
      <View style={styles.content}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.transparent,
    overflow: 'hidden',
  },
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
