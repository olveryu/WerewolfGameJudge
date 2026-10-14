/**
 * EncyclopediaShell — 共享图鉴分段壳（自狼人杀 EncyclopediaScreen 分解）。
 *
 * 壳只负责：GameScreen 框、ScreenHeader（标题/返回/当前段的 header 动作）、
 * 分段切换。各段内容与 header 动作由绑定层注入；「角色」段的机器
 * （useEncyclopediaRolesState + EncyclopediaRolesContent +
 * EncyclopediaRolesHeaderActions）同为共享件，由绑定层组装注入。
 */
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameScreen, gameScreenStyles } from '@/components/GameScreen';
import { ScreenHeader } from '@/components/ScreenHeader';

import { EncyclopediaSegmentedControl } from './EncyclopediaSegmentedControl';

export interface EncyclopediaSegment {
  readonly key: string;
  readonly label: string;
}

interface EncyclopediaShellProps {
  /** 页头标题（如「狼人杀玩法」）。 */
  readonly title: string;
  readonly testID?: string;
  readonly onBack: () => void;
  /** 分段（有序）。 */
  readonly segments: readonly EncyclopediaSegment[];
  readonly initialTab: string;
  /** 各段内容渲染（按 segment key 调用）。 */
  readonly renderSegment: (segmentKey: string) => React.ReactNode;
  /** 各段的 header 动作（按 segment key）；缺省无动作。 */
  readonly segmentHeaderActions?: Readonly<Record<string, React.ReactNode>>;
}

/** 图鉴分段壳。 */
export function EncyclopediaShell({
  title,
  testID,
  onBack,
  segments,
  initialTab,
  renderSegment,
  segmentHeaderActions,
}: EncyclopediaShellProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <GameScreen
      testID={testID}
      header={
        <ScreenHeader
          title={title}
          onBack={onBack}
          topInset={insets.top}
          headerRight={segmentHeaderActions?.[activeTab]}
        />
      }
    >
      <View style={gameScreenStyles.catalog}>
        <EncyclopediaSegmentedControl
          segments={segments}
          activeKey={activeTab}
          onChangeKey={setActiveTab}
        />
        <View style={styles.content}>{renderSegment(activeTab)}</View>
      </View>
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
