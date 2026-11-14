/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { DrawGuessWordCategory } from '@game-judge/game-engine/games/drawguess/public';

import type { AiCorrelation } from '../../platform/ai/aiError';
import { AiOutputValidationError } from '../../platform/ai/aiError';
import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import {
  decodeGeneratedDrawGuessCandidates,
  DRAWGUESS_WORD_BATCH_LIMIT,
  drawGuessCandidatesSchema,
  drawGuessReviewsSchema,
  type DrawGuessWordCandidate,
  parseDrawGuessReviews,
} from './wordEditorial';

export const DRAWGUESS_WORD_MODEL = 'gemini-3.5-flash-lite';
const CATEGORY_TOPICS: Record<DrawGuessWordCategory, string> = {
  animals: '动物：常见陆生哺乳动物与鸟类，家养野生都可以，不含昆虫和海洋生物',
  food: '食物：常见食物、菜品、水果、零食，一看就知道长什么样的',
  dailyObjects: '日用品：家里办公室常见的具体物品，形状明确好画的',
  plants: '植物：常见花草树木、蔬菜水果的植物本体，特征明显的',
  vehicles: '交通工具：常见车辆船只飞机，外形有辨识度的',
  places: '建筑场所：常见建筑物、场馆、自然地标，轮廓好画的',
  sports: '运动：常见运动项目、器材，一看就知道怎么画的',
  people: '人物身份：非职业的人物身份，外形或动作特征明显的（如新娘、婴儿）',
  idioms: '成语：有典故画面感的四字成语，能画出故事场景的（如守株待兔、画蛇添足）',
  internetMemes: '网络热梗：年轻人熟知的流行语，有标志性画面的（如躺平、内卷），选经久不衰不过时的',
  instruments: '乐器：常见乐器，外形有辨识度、能画出轮廓和演奏姿势的（如钢琴、吉他、二胡）',
  occupations: '职业：靠制服或工具一眼认出的具体职业，外形特征极明显的（如消防员、快递员、理发师）',
  space: '太空天文：天体、航天器与宇航相关事物，轮廓明确好画的（如月球、火箭、卫星）',
  festivals: '节日习俗：传统节日与节庆习俗用品、活动，画面感强的（如灯笼、粽子、舞龙）',
  electronics: '电器数码：常见家电与数码产品，外形固定好画的（如电视、冰箱、无人机）',
  characters:
    '动漫游戏角色：广为人知的虚构角色，造型有标志性特征的（如孙悟空、皮卡丘），不要真人明星',
  nature: '自然现象：常见天气与自然现象，能画出形态的（如彩虹、闪电、火山）',
  landmarks: '建筑地标：著名建筑与地标，轮廓有辨识度的（如长城、灯塔、城堡）',
  stationery: '文具校园：校园与学习用品，形状明确好画的（如书包、黑板、地球仪）',
  oceanLife: '海洋生物：常见海洋动物与海洋生物，外形特征明显的（如鲸鱼、章鱼、海星）',
  clothing: '服饰穿搭：外形明显的衣服、鞋帽和配饰（如雨衣、手套、围巾）',
  furniture: '家具陈设：家庭常见、轮廓清晰的家具（如沙发、衣柜、摇椅）',
  kitchenware: '厨房用具：做饭和用餐时使用、外形明显的器具（如炒锅、漏勺、擀面杖）',
  toys: '玩具：常见且造型明显的玩具（如风筝、陀螺、积木）',
  tools: '工具：日常维修和手工常见、外形明显的工具（如锤子、扳手、锯子）',
  insects: '昆虫：常见、外形有辨识度的昆虫（如蝴蝶、蜻蜓、瓢虫）',
  musicalActivities: '音乐活动：能通过人物动作或场景表现的音乐活动（如唱歌、指挥、跳舞）',
  medicalSupplies: '医疗用品：普通人熟悉且形状清晰的医疗用品（如口罩、绷带、听诊器）',
  householdCleaning: '清洁用品：居家清洁常用、外形明显的物品（如扫把、拖把、吸尘器）',
  outdoorActivities: '户外活动：能画出典型动作或场景的户外活动（如露营、钓鱼、放风筝）',
  dating: '约会场景：约会时能通过人物动作或场景表现的活动（如相亲、送花）',
  romance: '恋爱互动：有画面感的感情互动（如牵手、表白、吃醋）',
  wedding: '婚礼现场：婚礼中的人物动作和仪式（如抛捧花、交换戒指）',
  nightlife: '夜生活：夜间聚会及休闲活动（如唱歌、跳舞、夜宵）',
  partyGames: '聚会游戏：有明显动作或道具的聚会游戏（如划拳、转瓶子）',
  barCulture: '酒吧文化：酒吧中的饮品、道具和互动（如碰杯、调酒）',
  actionComedy: '动作喜剧：夸张而不血腥的影视喜剧动作（如追逐、躲闪）',
  mystery: '悬疑推理：侦探故事中容易画出的道具和场景（如放大镜、寻找线索）',
  awkwardMoments: '尴尬瞬间：能通过人物动作表现的社交窘境（如认错人、摔跤）',
  adultLife: '成年生活：有画面感的成年日常场景（如搬家、熬夜、还房贷）',
};
const GAME_RULES = `<game>
一名玩家拿到题目词，在限定时间内（默认 90 秒）用简笔画把它画出来，画里不能写字或数字。其他玩家在聊天框打字猜，只有打出的字与题目词完全相同才算猜中，同义词和近似说法都不算。猜的人能看到题目的字数，拼音首字母每 20 秒揭示一个，最后留一个不揭示。
玩家是普通的中文朋友聚会成员，没有绘画功底，也没有专业知识。
</game>`;
const GENERATION_PROMPT = `你为中文聚会游戏「你画我猜」出题。

${GAME_RULES}

<input>
用户消息是一个 JSON：category 是本次唯一的分类，topic 是这个分类的出题方向，history 是该分类已经出过的词。history 里的词不要再出，也不要用换个说法的同一事物凑数。
</input>

<good_word>
一个好题目同时满足四点：
1. 人人认识。普通玩家不用解释就知道这个词，画的人知道该画什么。
2. 有公认的画面。说到这个词，大多数人脑子里会出现相近的样子：物品看外形，动作和活动看姿势与场景，成语看典故里的画面，网络热梗看它的标志性画面。
3. 不写字也认得出。辨认靠形状、动作或场景，而不是文字、台词、谐音或规则说明。
4. 画出来别人会打出这个词本身。它是这个画面最常用的固定叫法，而不是好几种同样自然的说法之一。
</good_word>

<avoid>
下面几类最容易成为坏题，遇到就换一个词：
- 临时拼出来的情境短句。只出词典里的词、固定短语、成语和公认的梗名。为了描述一个场景而现编的句子（谁在哪里做了什么）有无数种说法，没有人能恰好打对。动作和场景类的分类同样要选大家都这么叫的固定说法。
- 看不见的东西。心理状态、评价、抽象概念和科学原理没有形状；身份、关系、所有权也画不出来，除非有制服或工具这样一眼可认的外部特征。
- 离开文字就认不出的东西。主要特征是字、台词、谐音，或者要讲解规则才能与同类区分的游戏和活动。
- 会被猜成另一个词的东西。画出来大家会先打出一个更常用的上位词、近义词或别名，或者它有几个同样常用、字数也相同的叫法。
- 范围很宽、没有统一样子的统称，以及可以指好几样东西的说法。
- 小众或地域性的词。只有部分地区、行业或圈子的人知道的事物、习俗和术语。
- 不适合聚会的内容。露骨色情、血腥、歧视或侮辱性的内容不出；恋爱互动、喝酒场景和不血腥的虚构动作是正常题材。
专有名词只在分类本身需要时才出，例如动漫游戏角色和著名地标，而且必须家喻户晓、造型或轮廓有标志性，不需要专门知识就能与同类区分。现实中的真人姓名和商业品牌不出。
</avoid>

<output>
目标是 ${DRAWGUESS_WORD_BATCH_LIMIT} 个互不相同的词，这也是上限。宁可少给，也不要用不够好的词凑数；确实想不出合格的词时可以返回空数组。尽量覆盖出题方向里的不同事物，不要集中在一小类。
每个候选包含：
- word：2 至 8 个简体汉字，不带标点、数字、字母或空格。
- category：原样填写输入里的 category。
- difficulty：按画出来并被猜中的难度填写。easy 是几笔就能画出来、人人能猜中的；medium 是需要画出一两个关键特征的；hard 是要画一个场景或组合几个元素、但仍然猜得中的。比 hard 更难的不要出。
- potentialIssues：0 至 4 条，每条 2 至 180 字，如实写下这个词可能的问题，例如容易被猜成哪个词、哪个部位难画、有没有多音字。没有问题就留空数组。
这些候选之后会由另一个审核环节独立检查，不要声称它们已经通过审核或试玩。
</output>`;
const REVIEW_PROMPT = `你是中文聚会游戏「你画我猜」的题目审核员，逐个判断候选词能不能进入题库。

${GAME_RULES}

<input>
用户消息是一个 JSON：category 和 topic 是这批词所属的分类及其出题方向，candidates 是待审核的词。只根据词本身和游戏规则判断。这些词来自另一个出题环节，被提出来不代表合格。
</input>

<how_to_review>
对每个词，先想清楚两件事，再填写结论：
1. 站在画的人这边：一个不会画画的普通人，在限定时间内不写字，会画哪几样东西来表现它？
2. 站在猜的人这边：只看这幅画，加上字数和逐渐揭示的拼音首字母，大家最先打出的会是哪些词？题目词在不在其中，会不会被一个更常用的词抢走？
</how_to_review>

<quality_checks>
六项各自独立判断，全部为 true 的词才会入库。
- isConcreteAndDrawable：第 1 件事有答案。普通玩家认识这个词，并且能用形状、动作或场景把它画出来。以下情况填 false：画的人多半不认识这个词，或者它只在部分地区、行业、圈子里为人所知；它是心理状态、评价、抽象概念或科学原理；它的关键信息是看不见的身份、关系或所有权；它的主要辨认特征是文字、台词、谐音，或者要讲解规则才能与同类区分。
- isUnambiguous：第 2 件事的答案落在题目词上。以下情况填 false：它是临时拼出来的情境短句而不是固定叫法，同一幅画有许多同样自然的说法；画出来大家会先打出一个更常用的上位词、近义词或别名，字数和首字母提示也不足以把人引到题目词；它是范围很宽的统称，没有统一的样子；它本身指代不明，可以指好几样东西。字数不同或首字母不同的别名会被提示排除，不算歧义。
- isAppropriate：适合朋友聚会。露骨色情、血腥、歧视或侮辱性的内容，以及现实中的真人姓名和商业品牌填 false。恋爱互动、喝酒场景、不血腥的虚构动作和虚构角色是正常题材，填 true。
- isCategoryAccurate：这个词可以算在给定分类的出题方向里。只有明显不属于这个分类时才填 false；兼属其他分类或处在边界上都填 true。
- isSimplifiedChinese 和 isLengthValid：字形和字数已经由程序校验，两项都填 true，不需要自己数字数。
</quality_checks>

<calibration>
常见不是缺点：这个游戏要的正是人人认识、一画就懂的词。审核只看「画得出」和「猜得准」是否都成立；画得出但猜不准（例如随口描述某个场景的短句），或者猜得准但画不出，都不合格。
专有名词本身不是拒绝理由。在动漫游戏角色、著名地标这类分类里，家喻户晓且造型或轮廓有标志性的专名合格；需要专门知识才能与同类区分的专名不合格。
拿不准时这样判断：把这个词交给一桌普通朋友，画的人会不会愣住，猜的人会不会打出一堆别的说法？两者有一个很可能发生，对应的那一项就填 false。题库宁缺毋滥，但不要因为想象中的极端情况否掉一个明显好画好猜的常见词。
</calibration>

<output>
reviews 必须与 candidates 一一对应：数量相同、顺序相同，word 原样照抄，不增删、不改写、不替换。不合格的词也要返回。
reason 写 2 至 180 字，用具体内容说明依据：通过时写出会怎么画；不通过时写出问题所在，例如会被猜成哪个词、哪个信息画不出来。
按结构化输出顺序，先写 reason 中的画法与猜词依据，再填写 qualityChecks；不增加额外字段。
</output>`;

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createDrawGuessWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(
      category: DrawGuessWordCategory,
      history: readonly string[],
      context: AiCorrelation = {},
    ) {
      return requestStructuredOutput({
        apiKey,
        model: DRAWGUESS_WORD_MODEL,
        context: { ...context, game: 'drawguess', operation: 'generate' },
        schema: drawGuessCandidatesSchema,
        systemPrompt: GENERATION_PROMPT,
        payload: { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
        parseOutput: (value) =>
          decodeGeneratedDrawGuessCandidates(value, category, {
            ...context,
            game: 'drawguess',
            operation: 'generate',
            model: DRAWGUESS_WORD_MODEL,
          }),
      });
    },
    reviewBatch(
      category: DrawGuessWordCategory,
      candidates: readonly DrawGuessWordCandidate[],
      context: AiCorrelation = {},
    ) {
      if (candidates.length === 0) return Promise.resolve([]);
      if (candidates.length > DRAWGUESS_WORD_BATCH_LIMIT)
        throw new AiOutputValidationError(
          'reviewBatchTooLarge',
          `DrawGuess review exceeds batch limit: ${DRAWGUESS_WORD_BATCH_LIMIT}`,
        );
      return requestStructuredOutput({
        apiKey,
        model: DRAWGUESS_WORD_MODEL,
        context: { ...context, game: 'drawguess', operation: 'review' },
        schema: drawGuessReviewsSchema,
        systemPrompt: REVIEW_PROMPT,
        payload: {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ word }) => ({ word })),
        },
        fetchImpl,
        parseOutput: (output) => parseDrawGuessReviews(output, candidates),
      });
    },
  };
}
