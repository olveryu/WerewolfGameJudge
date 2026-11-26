/** 聚会工具用法说明。 */
import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { TESTIDS } from '@/testids';

/** 独立用法页。 */
export function ToolboxGuideScreen() {
  return <ToolboxGuide />;
}

/** 与房间内「玩法」弹窗共用的说明。 */
export function ToolboxGuide({ embedded = false }: { readonly embedded?: boolean }) {
  return (
    <GameGuide
      title="聚会工具用法"
      heading="摇骰子、抽身份，聚会道具随手用"
      intro="线下聚会时代替实体骰子和身份牌。房主选好工具，想参与的人入座，房主开始后每人在自己的手机上使用。"
      testId={TESTIDS.gameGuideScreenRoot('toolbox')}
      embedded={embedded}
    >
      <GameGuideSection title="怎么用">
        <RuleItem
          icon="people-outline"
          title="入座再开始"
          description="进入房间后点「入座」。房间不限人数；房主开始时已入座的人成为本次参与者，之后进入的人只能观看。"
        />
        <RuleItem
          icon="game-controller-outline"
          title="骰子"
          description="每人一个骰盅，普通六面骰 1–20 颗。摇好后自己掀开，只有你能看到点数；可以固定部分骰子，再摇时保留它们的点数。"
        />
        <RuleItem
          icon="albums-outline"
          title="身份牌"
          description="房主配置身份和每人抽牌数。所有人从同一个牌堆随机抽，抽走不放回；只公开牌堆总剩余张数。"
        />
      </GameGuideSection>
      <GameNotice text="本工具不判断胜负，不计战绩和奖励。房主可以重开身份（只清空身份牌，骰子不受影响），或结束本次使用回到准备。" />
    </GameGuide>
  );
}
