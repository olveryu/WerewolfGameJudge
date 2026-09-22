/** FibKing guide content; shared components own layout, not game rules. */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import type { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';

/** Explains identities and the existing round lifecycle. */
export function FibRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  return (
    <GameGuide
      title="瞎掰王玩法"
      heading="真假释义，只能相信描述"
      intro="每轮所有玩家看到同一个词。老实人知道真实释义，瞎掰王编造释义，大聪明根据描述判断真相。"
      testID={TESTIDS.fibRulesScreenRoot}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
    >
      <GameGuideSection title="三个身份">
        <RuleItem
          icon="search-outline"
          title="大聪明"
          description="能看到本轮词语，但看不到真实释义。听完描述后判断谁说的是真话。"
        />
        <RuleItem
          icon="checkmark-circle-outline"
          title="老实人"
          description="能看到词语和真实释义。用自己的话准确描述，但不能直接念出答案。"
        />
        <RuleItem
          icon="sparkles-outline"
          title="瞎掰王"
          description="能看到词语，但看不到真实释义。编出听起来可信的解释。"
        />
      </GameGuideSection>
      <GameGuideSection title="一轮流程">
        <RuleItem
          icon="eye-outline"
          title="查看身份"
          description="每位玩家确认自己的身份和可见信息。"
        />
        <RuleItem
          icon="chatbubbles-outline"
          title="依次描述"
          description="玩家围绕词语给出解释，大聪明公开身份并听取所有描述。"
        />
        <RuleItem
          icon="refresh-outline"
          title="重新抽词（可选）"
          description="当前词语不合适时，房主可作废本轮并重新抽词、分配身份；已出现的词语不会重复。"
        />
        <RuleItem
          icon="flag-outline"
          title="公布答案"
          description="房主结束本轮，公开真实释义、老实人与所有身份。"
        />
        <RuleItem
          icon="refresh-outline"
          title="下一轮"
          description="座位保持不变，系统抽取新词并重新分配身份。"
        />
        <RuleItem
          icon="stop-circle-outline"
          title="结束游戏"
          description="答案公布后返回大厅并保留当前座位，可以调整玩家或房间设置。"
        />
        <RuleItem
          icon="stop-circle-outline"
          title="放弃游戏（可选）"
          description="答案公布前也可返回大厅；当前座位和已出现的词语记录都会保留。"
        />
      </GameGuideSection>
      <GameNotice text="大聪明在本轮开始后公开；老实人身份直到公布答案才公开。" />
    </GameGuide>
  );
}
