/**
 * quickQuestions - 快捷问题池与生成逻辑
 *
 * 纯函数 + 静态数据，无副作用。
 * 根据游戏上下文和聊天记录动态生成 4 道快捷问题。
 *
 * ✅ 允许：读取 gameState、问题匹配
 * ❌ 禁止：调用 service、修改 state
 */

import type { BroadcastGameState } from '@werewolf/game-engine/protocol/types';

import { randomPick } from '@/utils/random';
import { shuffleArray } from '@/utils/shuffle';

import type { DisplayMessage } from './AIChatBubble.styles';

// ── 问题池 ───────────────────────────────────────────────

/** 通用问题池 - 不在游戏中时使用（≤10字） */
const GENERAL_QUESTIONS = [
  '狼人杀基本规则？',
  '好人怎么配合？',
  '狼人怎么隐藏？',
  '什么是金水银水？',
  '怎么分析发言？',
  '狼队怎么配合？',
  '怎么判断狼人？',
  '怎么保护神职？',
];

/** 根据角色生成相关问题（≤10字） */
const ROLE_QUESTIONS: Record<string, string[]> = {
  seer: ['预言家先查谁？', '预言家怎么自保？', '预言家何时跳？'],
  witch: ['女巫首晚要救吗？', '毒药什么时候用？', '女巫能自救吗？'],
  guard: ['守卫首晚守谁？', '守卫配合预言家？', '守卫能守自己吗？'],
  hunter: ['猎人何时开枪？', '被毒能开枪吗？', '猎人怎么发挥？'],
  wolf: ['狼人刀人技巧？', '狼人怎么伪装？', '刀完怎么发言？'],
  wolfQueen: ['狼王特殊技能？', '狼王能带人吗？'],
  wolfKing: ['狼王技能是啥？', '狼王何时自爆？'],
  nightmare: ['梦魇技能是啥？', '梦魇怎么配合？'],
  gargoyle: ['石像鬼技能？', '石像鬼看到啥？'],
  wolfRobot: ['机械狼技能？', '机械狼能互认？'],
  psychic: ['通灵师和预言家？', '通灵师怎么验？'],
  magician: ['魔术师技能？', '交换座位有啥用？'],
  idiot: ['白痴被投会怎样？', '翻牌后能投票吗？'],
  knight: ['骑士决斗怎么用？', '骑士何时翻牌？'],
  villager: ['村民怎么发挥？', '村民怎么发言？'],
  slacker: ['混子什么阵营？', '混子胜利条件？'],
};

/** 根据聊天记录中提到的关键词生成跟进问题（≤10字） */
const FOLLOW_UP_QUESTIONS: Record<string, string[]> = {
  预言家: ['预言家被刀咋办？', '验到狼怎么处理？', '第二晚查谁？'],
  女巫: ['解药什么时候用？', '女巫要不要自救？', '毒错人怎么办？'],
  守卫: ['守错人怎么办？', '能连续守一人吗？', '守卫女巫同救？'],
  猎人: ['猎人枪打谁好？', '猎人要暴露吗？', '被毒能开枪吗？'],
  狼人: ['狼人怎么悍跳？', '狼人怎么互保？', '狼人怎么发言？'],
  刀: ['狼刀什么策略？', '刀边和刀中？', '连刀还是跳刀？'],
  毒: ['毒药什么时候用？', '毒死好人咋办？', '该不该毒？'],
  救: ['第一晚要不要救？', '救人有啥风险？', '自救还是救队友？'],
  查: ['查谁效率高？', '查到好人咋办？', '查到狼要跳吗？'],
  跳: ['何时该跳身份？', '悍跳什么意思？', '被反驳怎么办？'],
  投票: ['首轮投票策略？', '怎么判断站边？', '弃票好不好？'],
  发言: ['好人怎么发言？', '狼人怎么发言？', '发言顺序重要吗？'],
  金水: ['金水怎么发言？', '金水被怀疑？', '假金水怎么辨别？'],
  银水: ['银水什么意思？', '银水可信吗？', '怎么用银水信息？'],
};

/** 通用跟进模板 */
const GENERIC_FOLLOW_UPS = ['继续说说？', '还有别的吗？', '具体怎么做？', '为什么呢？'];

// ── 纯函数 ───────────────────────────────────────────────

/**
 * 从聊天记录提取关键词并生成跟进问题
 * 优先从 AI 最后回答中提取，其次用户最后问题
 */
export function getContextQuestion(messages: DisplayMessage[]): string | null {
  if (messages.length === 0) return null;

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const allContent = (lastAssistantMsg?.content ?? '') + ' ' + (lastUserMsg?.content ?? '');

  // 匹配预设关键词（越具体越优先）
  const matched = Object.keys(FOLLOW_UP_QUESTIONS).filter((kw) => allContent.includes(kw));

  if (matched.length > 0) {
    const best = [...matched].sort((a, b) => b.length - a.length)[0];
    return randomPick(FOLLOW_UP_QUESTIONS[best]);
  }

  return randomPick(GENERIC_FOLLOW_UPS);
}

/**
 * 根据游戏上下文和聊天记录生成快捷问题（共4道）
 */
export function generateQuickQuestions(
  state: BroadcastGameState | null,
  mySeat: number | null,
  messages: DisplayMessage[],
): string[] {
  const questions: string[] = [];
  const used = new Set<string>();

  const add = (q: string) => {
    if (!used.has(q)) {
      questions.push(q);
      used.add(q);
    }
  };

  // 1. 跟进问题（优先级最高）
  const contextQ = getContextQuestion(messages);
  if (contextQ) add(contextQ);

  // 2. 板子角色技能介绍
  if (state?.templateRoles && state.templateRoles.length > 0) {
    add('本局角色技能介绍？');
  }

  // 3. 我的角色相关
  if (mySeat !== null && state?.players[mySeat]?.role) {
    const myRole = state.players[mySeat]?.role;
    if (myRole && ROLE_QUESTIONS[myRole]) {
      const available = ROLE_QUESTIONS[myRole].filter((q) => !used.has(q));
      if (available.length > 0) add(randomPick(available));
    }
  }

  // 4. 板子里其他角色
  if (state?.templateRoles && state.templateRoles.length > 0 && questions.length < 4) {
    const otherRoles = [
      ...new Set(
        state.templateRoles.filter((r) => {
          if (mySeat !== null && state.players[mySeat]?.role === r) return false;
          return ROLE_QUESTIONS[r] !== undefined;
        }),
      ),
    ];
    if (otherRoles.length > 0) {
      const role = randomPick(otherRoles);
      const available = ROLE_QUESTIONS[role]?.filter((q) => !used.has(q)) ?? [];
      if (available.length > 0) add(randomPick(available));
    }
  }

  // 5. 通用问题补满 4 个
  if (questions.length < 4) {
    const remaining = 4 - questions.length;
    const available = GENERAL_QUESTIONS.filter((q) => !used.has(q));
    const shuffled = shuffleArray(available);
    for (let i = 0; i < remaining && i < shuffled.length; i++) {
      questions.push(shuffled[i]);
    }
  }

  return questions.slice(0, 4);
}
