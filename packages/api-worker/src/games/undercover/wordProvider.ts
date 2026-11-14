/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { UndercoverCategory } from '@game-judge/game-engine/games/undercover/public';

import type { AiCorrelation } from '../../platform/ai/aiError';
import { AiOutputValidationError } from '../../platform/ai/aiError';
import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import {
  decodeGeneratedUndercoverCandidates,
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
const GAME_RULES = `<game>
每局用一组词对：多数玩家（平民）拿到其中一个词，少数玩家（卧底）拿到另一个词，谁也不知道自己属于哪一方；有时还有一名没有词的白板玩家，只能听别人的描述来蒙混。大家轮流用一句话描述自己的词，不能直接说出词本身，然后投票找出卧底。
所以一组好词对要让两边的人说出的很多话都对得上，卧底才藏得住；同时两个词又确实是两样东西，多描述几轮总会露出差别。
玩家是普通的中文朋友聚会成员。
</game>`;
const PAIR_EXAMPLES = `这些例子只用来说明判断方式，不代表只有这几种情况，也不要照搬：
- 好：牛奶 / 豆浆。都是早餐常喝的白色饮品，都可以加糖、配面包或包子；一个来自动物、一个来自豆子，味道和常搭配的食物也不同。
- 好：跑步 / 跳绳。都是不用去健身房的有氧运动，都会让人气喘出汗；一个要移动一段距离，一个原地进行并且需要一根绳子。
- 不好：老师 / 班主任。班主任也是老师，两个词重叠。
- 不好：毛巾 / 浴巾。浴巾是毛巾的一种。
- 不好：球员 / 球队。一个是个人，一个是集体，不在同一层面。
- 不好：打火机 / 指甲剪。共同点只有「可以随身带的小东西」，太牵强。`;
const GENERATION_PROMPT = `你为中文同桌聚会游戏「谁是卧底」出词对。

${GAME_RULES}

<input>
用户消息是一个 JSON：category 是本次唯一的分类，topic 是这个分类的出题方向，history 是该分类已有的词对。history 里的词对（包括两词对调）不要再出，也不要反复围绕同一个词或同一种区别方式出题。
</input>

<good_pair>
一组好词对同时满足：
1. 两个词普通玩家都不用解释就认识，而且熟悉程度差不多。一边人人皆知、另一边只有部分人懂的不出；生造的、不通顺的说法不出。
2. 两个词是同一层面上并列的两样东西：都是物品、都是动作、都是身份，或者都是场合。一个是个体另一个是整体、一个是东西另一个是活动，这样的不出。
3. 两个词互不包含，也不重叠。检验方法：有没有常见的情况，同一个东西、同一件事或同一个人既能叫甲也能叫乙？有，就不出。同义词和近义词、别名和地区叫法、一方是另一方的一种、一方是另一方的一部分或一个环节，都属于这种情况。
4. 至少有两个具体的共同点：两边的人都能照实说出口、又能把范围缩小到这一小类的话。「都是物品」「家里都有」「都能用」这种对什么都成立的话不算。
5. 至少有两个互相独立的区别：来自不同方面，例如用途、外形、场合、时间、人群，而不是同一个区别换种说法。只差颜色、大小、规格的不出。
6. 对调之后仍然公平：不管哪个词发给平民，游戏都玩得下去，没有哪一方一开口就暴露。
满足以上条件的前提下，优先选有画面感、有反差、能引出有趣讨论的搭配。常见的词也可以很好玩，不需要靠冷僻来出新意；趣味不能以牺牲熟悉度或公平为代价。
</good_pair>

<examples>
${PAIR_EXAMPLES}
</examples>

<scope>
可以出物品、人物身份、动作、生活场景和大众熟悉的短语，不要只出物品。
作品角色和网络用语只在确实普遍熟悉、并且你对相关事实有把握时才出；拿不准就不出。不出需要冷门知识的词，不照搬商业题库或作品台词。
恋爱、喝酒场景和不血腥的虚构动作是正常题材；露骨色情、血腥、歧视或侮辱性的内容不出。
</scope>

<output>
目标是 ${UNDERCOVER_WORD_BATCH_LIMIT} 组互不相同的词对，这也是上限。宁可少给，也不要用勉强的词对凑数；确实想不出合格的词对时可以返回空数组。
每个候选包含：
- wordA、wordB：两个词，各不超过 16 个字。
- category：原样填写输入里的 category。
- commonTraits：2 至 4 条共同点，每条单独写成一个字符串，写成玩家可以照实说出口的描述。
- differences：2 至 4 条区别，每条单独写成一个字符串，并且来自不同方面。
- potentialIssues：0 至 4 条，如实写下歧义、熟悉度失衡或容易暴露的风险；没有就留空数组。
每条说明 2 至 180 字。commonTraits 或 differences 不足 2 条的候选会被程序直接丢弃，所以写不出两条独立内容的词对不要出，也不要把两条内容并进一个字符串。
这些候选之后会由另一个审核环节独立检查，不要声称它们已经通过审核或试玩。
</output>`;
const REVIEW_PROMPT = `你是中文同桌聚会游戏「谁是卧底」的词对审核员，逐组判断候选词对能不能进入题库。

${GAME_RULES}

<input>
用户消息是一个 JSON：category 和 topic 是这批词对所属的分类及其出题方向，candidates 是待审核的词对。只根据两个词本身和游戏规则判断。这些词对来自另一个出题环节，被提出来不代表合格；你看不到也不需要出题者的说明。
</input>

<how_to_review>
对每组词对，先模拟一局，再填写结论：
1. 假设你拿到甲，轮到你描述又不想暴露，你会说哪几句话？这些话对乙也成立吗？成立的就是共同点。
2. 再多描述几轮，哪些话只对甲成立、哪些只对乙成立？这些就是区别。看它们是不是来自不同方面。
3. 把两个词对调再想一遍，是否同样玩得下去。
把想到的共同点写进 commonTraits，区别写进 differences，各项判断要与写下的内容一致。
</how_to_review>

<quality_checks>
九项各自独立判断，全部为 true 的词对才可能入库。
- isFamiliar：两个词普通玩家都不用解释就认识。含有生造的、不通顺的或多数人没听过的词，填 false。
- hasSimilarFamiliarity：两个词的熟悉程度差不多。一边人人皆知、另一边只有部分人群熟悉，填 false。
- hasSharedDescriptions：能写出至少两条具体的共同点，即两边的人都能照实说出口、又能把范围缩小到这一小类的话。只有「都是物品」「家里都有」「都能用」「聚会时会出现」这类泛泛的话，填 false。
- hasDistinctDescriptions：能写出至少两条互相独立的区别，来自不同方面。只差颜色、大小、规格，或者两条其实是同一个区别换种说法，填 false。
- isNotSynonymOrSubset：两个词互不包含，也不重叠。检验方法：有没有常见的情况，同一个东西、同一件事或同一个人既能叫甲也能叫乙？有，就填 false。这包括同义词和近义词、别名和地区叫法、一方是另一方的一种、一方是另一方的一部分或一个环节、一方常常同时也是另一方。日常口语里两个词经常混着用、所指大量重合时，同样填 false。
- isPlayableBothWays：对调平民词和卧底词后仍然公平，没有哪一方一开口就暴露，白板玩家也能靠听别人的描述参与。两个词不在同一层面时（个体与整体、物品与活动），描述方式天然不同，填 false。
- isCategoryAccurate：词对可以算在给定分类的出题方向里。只有明显不属于这个分类时才填 false；兼属其他分类或处在边界上都填 true。
- isAppropriate：适合朋友聚会。露骨色情、血腥、歧视或侮辱性的内容填 false；恋爱、喝酒场景和不血腥的虚构动作是正常题材，填 true。
- isFactuallyCertain：判断这组词对不依赖你拿不准的事实。日常事物直接填 true；涉及作品角色、真实人物或时效性热梗时，只有对相关事实有把握才填 true，不要编造查证或试玩的结论。
</quality_checks>

<calibration>
常见和经典不是缺点：这个游戏要的正是人人熟悉、好描述的词。不要因为词对普通就挑毛病，也不要因为它眼熟就放行，只看模拟的结果。
拿不准某一项是否成立时填 false，题库宁缺毋滥；但依据应当是模拟中确实出现的问题，而不是想象中的极端情况。
${PAIR_EXAMPLES}
</calibration>

<output>
reviews 必须与 candidates 一一对应：数量相同、顺序相同，wordA 和 wordB 原样照抄，不增删、不对调、不替换。不合格的词对也要返回。
commonTraits 和 differences 每条单独写成一个字符串，每条 2 至 180 字，每个数组最多 4 条，不要把两条内容并进一个字符串：
- 你判为合格的词对，两个数组都必须各有至少 2 条互不相同的内容。程序会检查条数：九项全为 true 但任一数组不足 2 条，这组词对仍然会被拒绝。所以要么写够两条，要么把 hasSharedDescriptions 或 hasDistinctDescriptions 填 false，二者必须一致。
- 不合格的词对，想到几条就写几条，可以是空数组。
reason 写 2 至 180 字，说明通过或不通过的关键依据；不通过时点明是哪一项的什么问题。
按结构化输出顺序，先写 commonTraits、differences 和 reason，再填写 qualityChecks；不增加额外字段。
</output>`;

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createUndercoverWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(
      category: UndercoverCategory,
      history: readonly { wordA: string; wordB: string }[],
      context: AiCorrelation = {},
    ) {
      return requestStructuredOutput({
        apiKey,
        model: UNDERCOVER_WORD_MODEL,
        context: { ...context, game: 'undercover', operation: 'generate' },
        schema: undercoverCandidatesSchema,
        systemPrompt: GENERATION_PROMPT,
        payload: { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
        parseOutput: (value) =>
          decodeGeneratedUndercoverCandidates(value, category, {
            ...context,
            game: 'undercover',
            operation: 'generate',
            model: UNDERCOVER_WORD_MODEL,
          }),
      });
    },
    reviewBatch(
      category: UndercoverCategory,
      candidates: readonly UndercoverWordCandidate[],
      context: AiCorrelation = {},
    ) {
      if (candidates.length === 0) return Promise.resolve([]);
      if (candidates.length > UNDERCOVER_WORD_BATCH_LIMIT)
        throw new AiOutputValidationError(
          'reviewBatchTooLarge',
          `Undercover review exceeds batch limit: ${UNDERCOVER_WORD_BATCH_LIMIT}`,
        );
      return requestStructuredOutput({
        apiKey,
        model: UNDERCOVER_WORD_MODEL,
        context: { ...context, game: 'undercover', operation: 'review' },
        schema: undercoverReviewsSchema,
        systemPrompt: REVIEW_PROMPT,
        payload: {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ wordA, wordB }) => ({ wordA, wordB })),
        },
        fetchImpl,
        parseOutput: (output) => parseUndercoverReviews(output, candidates),
      });
    },
  };
}
