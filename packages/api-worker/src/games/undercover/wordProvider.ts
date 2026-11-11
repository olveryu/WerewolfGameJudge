/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { UndercoverCategory } from '@game-judge/game-engine/games/undercover/public';

import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import {
  parseUndercoverReviews,
  UNDERCOVER_WORD_BATCH_LIMIT,
  undercoverCandidatesSchema,
  undercoverReviewsSchema,
  type UndercoverWordCandidate,
} from './wordEditorial';

export const UNDERCOVER_WORD_MODEL = 'gemini-3.5-flash-lite';
const CATEGORY_TOPICS: Record<UndercoverCategory, string> = {
  food: '美食饮品：食物、饮料、烹饪与用餐习惯',
  dailyLife: '日常生活：日用品、家居、购物与日常习惯',
  school: '校园青春：课程、考试、社团与校园经历',
  work: '职场打工：职业、工作情境与办公活动',
  relationships: '社交关系：常见人际身份、交往方式与社交行为',
  actions: '动作状态：动作、情绪、作息与生活状态',
  entertainment: '影视文娱：大众作品、角色、音乐与娱乐活动',
  sportsAndGames: '运动游戏：运动项目、电子游戏与线下游戏',
  travel: '出行场景：交通、旅行、公共场所与外出经历',
  nature: '自然万物：常见动植物、天气与自然现象',
  drinks: '饮品：常见饮料、茶饮及饮用方式',
  desserts: '甜点零食：常见糕点、甜品和零食',
  cooking: '烹饪厨房：烹饪方式、厨房用具和备餐活动',
  clothing: '服饰穿搭：衣物、鞋帽和日常配饰',
  beauty: '美妆护理：常见化妆品、护肤品和护理方式',
  home: '家居生活：家具、家居用品和居家活动',
  pets: '宠物：常见宠物、宠物用品和照顾活动',
  animals: '动物：普通人熟悉的动物及其生活习性',
  plants: '植物花草：常见花草、树木和种植活动',
  weather: '天气气候：常见天气现象及应对方式',
  vehicles: '交通工具：常见车辆、船只和出行工具',
  shopping: '购物消费：购物场所、消费方式和购物行为',
  technology: '数码科技：常见电子设备、应用和网络行为',
  music: '音乐：大众熟悉的乐器、音乐形式和音乐活动',
  filmAndTelevision: '影视：大众熟悉的影视类型、人物身份和观影活动',
  festivals: '节日习俗：常见节日、庆祝活动和节庆用品',
  occupations: '职业身份：大众熟悉的职业和工作身份',
  health: '健康运动：日常健身、健康习惯和常见用品',
  hobbies: '兴趣爱好：大众熟悉的休闲爱好和相关用品',
  outdoors: '户外活动：常见户外活动、场所和装备',
  dating: '约会场景：相亲、约会地点和约会活动',
  romance: '恋爱互动：恋爱关系、情感表达与交往行为',
  wedding: '婚礼现场：婚礼仪式、习俗、身份与用品',
  nightlife: '夜生活：夜间休闲、聚会场所和娱乐活动',
  partyGames: '聚会游戏：朋友聚会常玩的游戏、道具和规则',
  barCulture: '酒吧文化：酒吧场景、饮品、调饮和社交行为',
  actionComedy: '动作喜剧：虚构喜剧中的追逐、躲闪和夸张动作',
  mystery: '悬疑推理：侦探故事中的推理、线索和角色',
  awkwardMoments: '尴尬瞬间：社交中的乌龙、误会和出糗经历',
  adultLife: '成年生活：租房、生活开支和成年人日常经历',
};
const GENERATION_PROMPT = `你为中文同桌聚会游戏「谁是卧底」设计词对。每组两词分别发给平民和卧底，玩家不知道阵营，还可能有一名无词的白板。
只生成指定分类，目标是完整提供${UNDERCOVER_WORD_BATCH_LIMIT}组不同词对，而不是几个示例；上限${UNDERCOVER_WORD_BATCH_LIMIT}组。确实找不到足够合格词对时可少于目标或零产出，不凑数量。两个词都须普通中文玩家无需解释就认识，熟悉程度接近，交换阵营仍能玩。
至少两个自然共同描述角度、两个清晰区别。不要同义词、别名、地区叫法、上下位包含关系、完全无关词或只换颜色大小的词对。
允许物品、人物身份、动作、生活场景与大众短语，不只列物品。不要反复使用相同词或区别模式。排除历史样本及交换顺序后的重复。
优先选择有画面感、容易引发有趣讨论或带梗的词对（如有反差、双关或时代感的搭配），避免干巴巴的常见物品名词；趣味性不得以牺牲熟悉度或公平性为代价。
不复制商业题库或作品台词，不用冷僻知识。作品角色与网络用语只有普遍熟悉且事实确定才可选，不确定则舍弃。
commonTraits与differences分别给出自然共性和区别，每个数组必须分别含2至4个独立字符串元素，不要把两个角度合并成一个元素；找不到两个独立角度的词对直接舍弃。potentialIssues为0至4项，记录歧义、失衡或容易泄底的风险；词语最多16字，每项说明2至180字。输出只是未审核候选，不宣称试玩或审核通过。`;
const REVIEW_PROMPT = `你独立审核中文聚会游戏「谁是卧底」词对。只凭给定词语重新思考，不接受生成者的自评。不要新增、遗漏、调序或替换词对。
每对双方必须常见、熟悉程度接近、有至少两项自然共性和两项可描述区别；不能是同义词、别名、包含关系或牵强配对，交换平民和卧底词仍应可玩，且有无词白板时不靠冷门知识。
先找拒绝证据，再逐项判断，不要因为词对经典或常见就全填true。若B是A的一种（例如肥皂/香皂、毛巾/浴巾），isNotSynonymOrSubset必须false；日常说法常把上位词狭义化也不能豁免。仅颜色、尺寸、规格不同，hasDistinctDescriptions必须false。
共同描述必须有具体关联，不能仅靠“家里都有”“都能用”“都是物品”等通用套话。像打火机/指甲剪这种只因随身携带就配对的词，hasSharedDescriptions必须false。两项区别不能只是同一个区别的改写。
按字段逐项判断熟悉度、对称性、共性、区别、非同义/包含、双向可玩、分类准确、内容适宜及事实确定性。常见本身不是缺点。
恋爱互动、酒吧场景和不血腥的虚构动作本身不构成不适宜；仍须拒绝露骨或血腥内容。
自己填写commonTraits、differences与具体reason。作品角色、人物、时效热梗或关键事实无法确定时isFactuallyCertain必须false，不编造检索或试玩证据。
合格词对的commonTraits与differences数组都必须分别列出至少2个独立元素，最多4个；不要把两项依据合并在一个字符串中。只有1个元素就不能判为对应质量项通过，找不到第二个独立角度时应明确拒绝。
不确定的任一质量项必须false，不能靠其他项弥补。所有词对都必须返回审核，包括不合格者。`;

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createUndercoverWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(
      category: UndercoverCategory,
      history: readonly { wordA: string; wordB: string }[],
    ) {
      return requestStructuredOutput({
        apiKey,
        model: UNDERCOVER_WORD_MODEL,
        providerLabel: 'Undercover',
        schema: undercoverCandidatesSchema,
        systemPrompt: GENERATION_PROMPT,
        payload: { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
      });
    },
    async reviewBatch(
      category: UndercoverCategory,
      candidates: readonly UndercoverWordCandidate[],
    ) {
      const output = await requestStructuredOutput({
        apiKey,
        model: UNDERCOVER_WORD_MODEL,
        providerLabel: 'Undercover',
        schema: undercoverReviewsSchema,
        systemPrompt: REVIEW_PROMPT,
        payload: {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ wordA, wordB }) => ({ wordA, wordB })),
        },
        fetchImpl,
      });
      return parseUndercoverReviews(output, candidates);
    },
  };
}
