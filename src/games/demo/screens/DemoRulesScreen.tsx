/**
 * Demo玩法说明。
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import type { RootStackParamList } from '@/navigation/types';

/** 展示玩法说明；章节内容随设计定稿填写（TODO(gameplay)）。 */
export function DemoRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <GameGuide
      title="Demo玩法"
      heading="模板参照游戏"
      intro="TODO(gameplay):一句话讲清这局游戏怎么玩、怎么赢，按 docs/demo-game-design.md 定稿填写。"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
    >
      <GameGuideSection title="一局怎么玩">
        <RuleItem
          icon="people-outline"
          title="坐满开局"
          description="房主创建房间后，玩家入座坐满全部座位（空座可填充机器人），房主开始游戏。"
        />
        <RuleItem
          icon="play-outline"
          title="TODO(gameplay):核心流程"
          description="TODO(gameplay):把核心玩法循环写成玩家能照着做的步骤，与设计文档保持一致。"
        />
      </GameGuideSection>
      <GameNotice text="TODO(gameplay):终局与结算说明（胜负条件、奖励口径）随玩法定稿填写。" />
    </GameGuide>
  );
}
