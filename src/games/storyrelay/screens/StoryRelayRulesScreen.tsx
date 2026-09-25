/** Story Relay gameplay guide; no duplicated editable room configuration. */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import type { RootStackParamList } from '@/navigation/types';

/** Presents ordinary text relay rules and manual bot responsibilities. */
export function StoryRelayRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <GameGuide
      title="故事接龙玩法"
      heading="把故事交给下一个人"
      intro="每人写一个开头，再接着上一段续写。等所有人写完，一起揭晓故事变成了什么。"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
    >
      <GameGuideSection title="从开头到揭晓">
        <RuleItem
          icon="create-outline"
          title="各写一个开头"
          description="支持 4 至 20 人。第一棒自由开头，每段最多 512 字符。"
        />
        <RuleItem
          icon="swap-horizontal-outline"
          title="只看紧邻的上一段"
          description="接稿对象随棒次变化。看不到前文和上一位作者；上一段为空白时可以自由发挥。"
        />
        <RuleItem
          icon="checkmark-circle-outline"
          title="准备好后等待收稿"
          description="准备状态不公开正文。全员准备或时间结束后收稿；未收到的稿件会等待，房主可确认跳过。"
        />
        <RuleItem
          icon="book-outline"
          title="每人每个故事只写一次"
          description="N 人共写 N 棒，每个故事 N 段。最后一棒也是普通续写，没有额外收尾。房主逐段揭晓，结束后可回读与复制。"
        />
      </GameGuideSection>
      <GameGuideSection title="房主与机器人">
        <RuleItem
          icon="people-outline"
          title="机器人由房主手写"
          description="房主可切换机器人分别写稿，草稿互不覆盖。没有 AI 自动生成；房主可以不入座。中止会保留已提交的片段，但不发完成奖励。"
        />
      </GameGuideSection>
      <GameNotice text="草稿保存在当前设备，不在不同设备间同步。游戏中请不要换设备或清理浏览器数据。" />
    </GameGuide>
  );
}
