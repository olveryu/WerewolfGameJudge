/** 秘密希特勒玩法说明。 */
import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { TESTIDS } from '@/testids';

import { SECRETHITLER_ROLE_DETAILS } from '../components/SecrethitlerRoleCardAdapter';

export function SecrethitlerRulesScreen() {
  return (
    <GameGuide
      title="秘密希特勒玩法"
      heading="隐藏阵营玩家选举政府并秘密施行政策"
      intro="5–10 名玩家分属自由派或法西斯阵营。自由派要推动五项自由派政策或处决希特勒；法西斯要推动六项法西斯政策，或在法西斯政策达到三项后让希特勒当选总理。"
      testId={TESTIDS.gameGuideScreenRoot('secrethitler')}
    >
      <GameGuideSection title="一局怎么玩">
        <RuleItem
          icon="people-outline"
          title="坐满开局"
          description="房间人数为 5–10 人。每位玩家查看自己的身份；首夜按阵营私下查看获准知道的队友座位，之后开始选举。"
        />
        <RuleItem
          icon="play-outline"
          title="选举与立法"
          description="总统提名总理，全体存活玩家提交赞成 / 反对票。公投结算后同时公开每人选票；暗投只公布赞成 / 反对票数。政府通过后，总统秘密弃置一张政策，再由总理秘密施行一张。被否决的政府会增加选举失败次数；连续三次否决时，自动施行牌堆顶政策。"
        />
        <RuleItem
          icon="eye-outline"
          title="政策权力"
          description="法西斯政策轨道可能授予调查、特别选举、处决或政策预览权力。每项行动由当前总统执行；调查结果和政策手牌只对获准玩家可见。"
        />
        <RuleItem
          icon="shield-checkmark-outline"
          title="阵营目标"
          description="自由派施行五项自由派政策，或处决希特勒即可获胜。法西斯施行六项法西斯政策，或让希特勒在法西斯政策达到三项后当选总理即可获胜。"
        />
      </GameGuideSection>
      <GameGuideSection title="身份与首夜信息">
        {SECRETHITLER_ROLE_DETAILS.map((role) => (
          <RuleItem
            key={role.id}
            icon="people-outline"
            title={role.name}
            description={role.guideDescription}
          />
        ))}
      </GameGuideSection>
      <GameNotice text="正常终局后，所有角色与对局记录会公开。符合结算条件的真人参与者获得 33 经验和 3 次普通抽奖；个人战绩按开局阵营累计胜场。" />
    </GameGuide>
  );
}
