/** Undercover guide content; describes offline voting without owning game logic. */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { gameScreenStyles } from '@/components/GameScreen';
import type { RootStackParamList } from '@/navigation/types';

/** Presents identities, offline voting and authoritative victory conditions. */
export function UndercoverRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameGuide'>>();
  return (
    <GameGuide
      title="谁是卧底玩法"
      heading="描述词语，找出不同的人"
      intro="平民和卧底拿到相关但不同的词，通过描述寻找线索，再在线下投票选出出局玩家。"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
    >
      <GameGuideSection title="三个身份">
        <RuleItem
          icon="people-outline"
          title="平民"
          description="与其他平民拿到相同的词，词卡不显示所属阵营。找出拿到不同词语的玩家。"
        />
        <RuleItem
          icon="search-outline"
          title="卧底"
          description="拿到与平民相关但不同的词，词卡同样不显示所属阵营。通过描述判断局势，避免被投出。"
        />
        <RuleItem
          icon="document-outline"
          title="白板（可选）"
          description="没有词语，但知道自己是白板。根据其他人的描述寻找线索，争取留到最后。"
        />
      </GameGuideSection>
      <GameGuideSection title="对局流程">
        <RuleItem
          icon="eye-outline"
          title="确认词卡"
          description="每位玩家查看自己的词卡，所有人确认后显示随机首位发言座位，首轮从该玩家开始描述。之后的顺序在线下约定。"
        />
        <RuleItem
          icon="chatbubbles-outline"
          title="描述与投票"
          description="轮流描述自己的词语，不能直接说出词语本身。大家在线下指人投票。"
        />
        <RuleItem
          icon="person-remove-outline"
          title="揭晓出局"
          description="房主选择被投出的玩家并确认揭晓，该玩家立即出局。继续描述和投票，直到满足获胜条件。"
        />
        <RuleItem
          icon="refresh-outline"
          title="重新开始"
          description="房主可保留座位和设置，重新分配词语与身份，所有人重新确认词卡。进行中重开需确认，未结束的对局不计胜负。"
        />
      </GameGuideSection>
      <GameGuideSection title="获胜条件">
        <RuleItem
          icon="document-outline"
          title="白板独赢"
          description="白板存活且场上只剩两人时，白板独赢。白板仍在且超过两人时，继续游戏。"
        />
        <RuleItem
          icon="people-outline"
          title="平民获胜"
          description="没有存活白板，且卧底全部出局。"
        />
        <RuleItem
          icon="search-outline"
          title="卧底获胜"
          description="没有存活白板，且存活卧底人数不少于存活平民人数。"
        />
      </GameGuideSection>
      <GameGuideSection title="人数配置">
        <Text style={gameScreenStyles.description}>
          4 至 6 人配置 1 名卧底，7 至 9 人配置 2 名，10 至 12 人配置 3 名。启用白板至少需要 6
          人，白板替换一名平民。
        </Text>
      </GameGuideSection>
      <GameNotice text="出局后仍可查看自己的词，但不能继续参与描述和投票。" />
    </GameGuide>
  );
}
