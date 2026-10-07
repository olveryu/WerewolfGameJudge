/**
 * 阿瓦隆玩法说明（设计稿 §7 玩法说明屏）。
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import type { RootStackParamList } from '@/navigation/types';

/** 展示目标、流程、角色、板子、湖仙与刺杀规则。 */
export function AvalonRulesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <GameGuide
      title="阿瓦隆玩法"
      heading="好人做任务，坏人搞破坏"
      intro="5–10 人身份推理：好人阵营轮流组队执行 5 轮任务，先拿下 3 个任务获胜；坏人混在队伍里出失败牌破坏任务，连续否决组队或终局刺杀梅林也能获胜。"
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
      testID="avalon-rules"
    >
      <GameGuideSection title="一轮怎么玩">
        <RuleItem
          icon="moon-outline"
          title="晚上：睁眼认人"
          description="天黑后坏人先睁眼互认（奥伯伦不参与互认，谁也看不见），梅林睁眼看到坏人（看不见莫德雷德），派西维尔睁眼看到梅林和莫甘娜（分不清谁是谁）。每人点确认推进。"
        />
        <RuleItem
          icon="people-outline"
          title="队长组队"
          description="每轮由队长选出规定人数的队员（可含自己），全员线下口头讨论，不限时。"
        />
        <RuleItem
          icon="checkbox-outline"
          title="投票：赞成 / 反对"
          description="全员对队伍投票，可改票。房主点「结束投票」后结算：赞成多于反对则通过，否则否决（含平票）；单轮连续否决达到上限（建房时设置，3–5，默认 5），坏人直接获胜。公投模式同时亮票，暗投模式只公布赞成 / 反对数量。"
        />
        <RuleItem
          icon="trophy-outline"
          title="任务：秘密出牌"
          description="队员秘密出牌：好人只能出成功，坏人可出成功或失败。出完可改牌；收齐后洗混亮牌，只公布成功 / 失败数量，不揭晓出牌人。7 人及以上第 4 轮需要 2 张失败票才算失败。房主可点「结束任务」提前结算，未出牌视为成功。"
        />
      </GameGuideSection>
      <GameGuideSection title="角色">
        <RuleItem
          icon="eye-outline"
          title="梅林（好人）"
          description="晚上能看到所有坏人，但看不见莫德雷德。被刺客指认出来，好人就输了，所以要藏好身份。"
        />
        <RuleItem
          icon="help-circle-outline"
          title="派西维尔（好人）"
          description="晚上看到梅林和莫甘娜，但分不清谁是谁。"
        />
        <RuleItem
          icon="shield-outline"
          title="忠臣（好人）"
          description="亚瑟的忠臣，没有特殊能力，靠发言和投票找坏人。"
        />
        <RuleItem
          icon="skull-outline"
          title="莫甘娜（坏人）"
          description="坏人，晚上参与互认。派西维尔会把你当成梅林候选。"
        />
        <RuleItem
          icon="flash-outline"
          title="刺客（坏人）"
          description="坏人。每局必备。好人拿下 3 个任务后由你指认梅林；晚上结束后你也可以随时提前刺杀。"
        />
        <RuleItem
          icon="shield-half-outline"
          title="莫德雷德（坏人）"
          description="坏人，晚上参与互认，但梅林看不见你。"
        />
        <RuleItem
          icon="eye-off-outline"
          title="奥伯伦（坏人）"
          description="坏人，但晚上不睁眼：你看不见其他坏人，其他坏人也看不见你。"
        />
        <RuleItem
          icon="person-outline"
          title="爪牙（坏人）"
          description="莫德雷德的爪牙，普通坏人，晚上参与互认。"
        />
      </GameGuideSection>
      <GameGuideSection title="板子：人数即板子">
        <RuleItem
          icon="layers-outline"
          title="6 张固定板子"
          description="5 人：梅林、派西维尔、忠臣 ×1 vs 莫甘娜、刺客；6 人：忠臣 ×2；7 人：忠臣 ×2，加奥伯伦；8 人：忠臣 ×3，加爪牙；9 人：忠臣 ×4，加莫德雷德；10 人：忠臣 ×4，莫德雷德与奥伯伦全上。"
        />
      </GameGuideSection>
      <GameGuideSection title="湖中仙女与刺杀">
        <RuleItem
          icon="water-outline"
          title="湖中仙女（9 / 10 人局）"
          description="开局 token 给首任队长右手边的玩家。第 2、3、4 轮任务结算后，持有人私下查验一名没当过湖仙的玩家，只能看到阵营（好 / 坏），然后 token 传给被查验者，共 3 次。"
        />
        <RuleItem
          icon="locate-outline"
          title="终局刺杀"
          description="好人拿下 3 个任务后进入刺杀：坏人线下口头商量，刺客在 App 内点选一名玩家指认（除自己外任意座位），二次确认后结算。指认出梅林坏人翻盘，否则好人获胜。"
        />
        <RuleItem
          icon="warning-outline"
          title="提前刺杀"
          description="晚上结束后、游戏结束前任意时刻，刺客可通过常驻「刺杀」按钮提前刺杀：刺中梅林坏人直接获胜，刺错好人直接获胜。"
        />
      </GameGuideSection>
      <GameNotice text="机器人仅用于测试凑人数：房主在大厅点「填充机器人」，机器人不会自己行动，由房主接管代打。" />
    </GameGuide>
  );
}
