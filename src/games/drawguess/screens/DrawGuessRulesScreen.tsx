/**
 * 你画我猜玩法说明。
 */

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '@/components/GameGuide';

/** 展示轮流作画、猜词计分、提示与机器人规则。 */
export function DrawGuessRulesScreen() {
  return (
    <GameGuide
      title="你画我猜玩法"
      heading="一人作画，其余人猜"
      intro="每轮一人当画手作画，其他人在聊天框里打字猜词。猜得越快分越高，画手按每位猜中者得分的一半累计得分。"
    >
      <GameGuideSection title="一轮怎么玩">
        <RuleItem
          icon="hand-left-outline"
          title="画手 3 选 1"
          description="支持 4 至 12 人。轮到你当画手时，从 3 个候选词里选 1 个作画，15 秒内没选则由系统随机指派。每人按座位顺序轮流画 2 轮。"
        />
        <RuleItem
          icon="timer-outline"
          title="90 秒作画"
          description="画手有 90 秒作画。第一人猜中后剩余时间最多留 30 秒；除画手外全部猜中后 3 秒结束本轮。画布提供画笔、橡皮、直线、矩形、椭圆和填充工具；作画不许写字、写数字，这是房间规则。"
        />
        <RuleItem
          icon="chatbubbles-outline"
          title="聊天框猜词"
          description="猜题者在聊天框输入猜测提交。请用简体输入。猜中后本轮锁定，不能再猜；猜中的答案只显示「xxx 猜中了」，不公开原文。"
        />
      </GameGuideSection>
      <GameGuideSection title="怎么计分">
        <RuleItem
          icon="flash-outline"
          title="猜中按速度计分"
          description="猜中得 50 分保底 + 最高 100 分速度加成：开局即猜中得 150 分，压哨猜中得 50 分。速度按作画开始时间计算，倒计时被压缩不影响得分。"
        />
        <RuleItem
          icon="brush-outline"
          title="画手分成猜中者得分"
          description="每被一人猜中，画手即时获得该猜中者得分的一半。画得越清楚，猜中的人越多越快，画手得分越高；无人猜中则画手 0 分。"
        />
        <RuleItem
          icon="trophy-outline"
          title="终局排名"
          description="全部轮次结束后按总分排名；同分并列，按竞赛排名 1、2、2、4 顺延。"
        />
      </GameGuideSection>
      <GameGuideSection title="提示与机器人">
        <RuleItem
          icon="text-outline"
          title="拼音首字母提示"
          description="猜题者看到题目字数和拼音首字母占位（如「3个字 · d _ _」），每 20 秒揭示一个首字母，最多全部揭示。"
        />
        <RuleItem
          icon="people-outline"
          title="机器人由房主接管"
          description="房主在大厅点“填充机器人”后，空座变成机器人。机器人不会自己画也不会自己猜，由房主接管代打。轮到机器人画手时等待房主接管，超时无人接管则本轮无人得分。"
        />
      </GameGuideSection>
      <GameNotice text="作画倒计时结束后公布答案，结算展示 8 秒后自动进入下一轮。房主可在主持管理中中止本局，清除本局画作、猜词记录和比分，保留座位和设置并返回大厅，不发完成奖励。" />
    </GameGuide>
  );
}
