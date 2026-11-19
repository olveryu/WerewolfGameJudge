/** 一眼成对玩法说明。 */
import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';
import { TESTIDS } from '@/testids';

/** 与引擎规则一致的入门说明。 */
export function SpotmatchRulesScreen() {
  return <SpotmatchRules />;
}

/** Reuses the same rules in the stage menu. */
export function SpotmatchRules({ embedded = false }: { readonly embedded?: boolean }) {
  return (
    <GameGuide
      title="一眼成对玩法"
      heading="同时找相同，抢先出完手牌"
      intro="同时观察桌面公共牌和你的手牌，点击任一张牌上的唯一共同图案。先出完手牌者获胜。"
      testId={TESTIDS.gameGuideScreenRoot('spotmatch')}
      embedded={embedded}
    >
      <GameGuideSection title="一局怎么玩">
        <RuleItem
          icon="people-outline"
          title="坐满开局"
          description="房主创建房间后，玩家入座坐满全部座位（空座可填充机器人），房主开始游戏。"
        />
        <RuleItem
          icon="play-outline"
          title="两张牌都能点"
          description="每张牌恰有八个图案。出对后全桌显示绿色匹配与出牌者，暂停一秒后换牌：你的顶牌成为公共牌，剩余减一；其他人的手牌不变。"
        />
        <RuleItem
          icon="hand-left-outline"
          title="误点稍等一秒"
          description="误点只锁定自己一秒。别人抢先出牌造成旧中央牌失效时，不算误点也不锁定。比赛不限时。"
        />
      </GameGuideSection>
      <GameNotice text="支持 2–20 人，每人可选 5、8、10 或 15 张。首位出完者获胜，展示一秒成功反馈后显示结果，其余按剩余张数排名，同数并列。含机器人的对局不计战绩与奖励；房主可中止。纯真人对局自然结束且至少正确出一张牌的注册真人，按平台日限获得 5 XP 和 1 次普通抽奖。" />
    </GameGuide>
  );
}
