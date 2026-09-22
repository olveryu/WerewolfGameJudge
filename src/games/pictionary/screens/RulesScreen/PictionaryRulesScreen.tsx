/** Pictionary guide content; shared components own layout, not relay behavior. */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import type { RootStackParamList } from '@/navigation/types';

/** Explains the existing text-and-drawing relay. */
export function PictionaryRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  return (
    <GameGuide
      title="你画我猜接龙玩法"
      heading="画得像不像不重要，传得离谱才有趣"
      intro="一人一道开场题，最后一起看答案。支持 4–20 人，游戏棒数等于玩家人数。到时收取已写文字和未完成画稿，全部收齐后继续。"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
    >
      <GameGuideSection title="接龙流程">
        <RuleItem
          icon="create-outline"
          title="各自出题"
          description="第一轮每个人写下一个题目，交给下一位玩家作画。"
        />
        <RuleItem
          icon="brush-outline"
          title="只看上一棒"
          description="看到文字就画画，看到画就猜词，不能回看更早的内容。"
        />
        <RuleItem
          icon="swap-horizontal-outline"
          title="随机接龙不重复"
          description="N 人共 N 棒，文字和绘画交替，同一本画册每人只参与一次。"
        />
        <RuleItem
          icon="images-outline"
          title="一起揭晓"
          description="最后按顺序播放每条接龙，看题目如何一路变形。"
        />
      </GameGuideSection>
      <GameNotice text="作答时只展示当前需要接续的一项，作者会在结果播放时揭晓。" />
    </GameGuide>
  );
}
