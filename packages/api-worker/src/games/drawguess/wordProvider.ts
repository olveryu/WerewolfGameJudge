/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { DrawGuessWordCategory } from '@game-judge/game-engine/games/drawguess/public';

import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import {
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
const GENERATION_PROMPT = `你为中文聚会游戏「你画我猜」设计题目词。玩家一人作画、众人猜词，词必须好画、好猜。
只生成指定分类，目标是完整提供${DRAWGUESS_WORD_BATCH_LIMIT}个不同的词，而不是几个示例；上限${DRAWGUESS_WORD_BATCH_LIMIT}个。确实找不到足够合格的词时可少于目标或零产出，不凑数量。
每个词都必须是普通中文玩家无需解释就认识、有明确画法的内容：名词看外形、动作活动看姿势和场景、成语看典故场景、热梗看标志性画面；2至8个简体汉字。不要纯抽象词（如幸福、时间）、专有名词（人名地名品牌名）。
difficulty 按绘画难度打分：easy 是人人会画的常见物，medium 是需要一点技巧的，hard 是形状复杂但仍可画的；再难就直接舍弃。
potentialIssues 为0至4项，记录多音字、易混淆、难画部位等风险；词语2至8字，每项说明2至180字。排除历史样本中的重复词。输出只是未审核候选，不宣称试玩或审核通过。`;
const REVIEW_PROMPT = `你独立审核中文聚会游戏「你画我猜」的题目词。只凭给定词语重新思考，不接受生成者的自评。不要新增、遗漏、调序或替换词语。
每个词必须同时满足：有明确画法（isConcreteAndDrawable：名词看外形、动作活动看姿势和场景、成语看典故场景、热梗看标志性画面）、简体中文（isSimplifiedChinese）、2至8个汉字（isLengthValid）、分类准确（isCategoryAccurate）、内容适宜无冒犯（isAppropriate）、无严重歧义不会导致猜词死局（isUnambiguous）。
恋爱互动、酒吧场景和不血腥的虚构动作本身不构成不适宜；仍须拒绝露骨或血腥内容。
先找拒绝证据，再逐项判断，不要因为词常见就全填true。纯抽象词、专有名词，isConcreteAndDrawable 必须 false。字数含标点或非汉字时 isLengthValid 必须 false。
不确定的任一质量项必须 false，不能靠其他项弥补。所有词都必须返回审核，包括不合格者。自己填写具体 reason（2至180字），说明通过或拒绝的依据。`;

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createDrawGuessWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(category: DrawGuessWordCategory, history: readonly string[]) {
      return requestStructuredOutput({
        apiKey,
        model: DRAWGUESS_WORD_MODEL,
        providerLabel: 'DrawGuess',
        schema: drawGuessCandidatesSchema,
        systemPrompt: GENERATION_PROMPT,
        payload: { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
      });
    },
    async reviewBatch(
      category: DrawGuessWordCategory,
      candidates: readonly DrawGuessWordCandidate[],
    ) {
      const output = await requestStructuredOutput({
        apiKey,
        model: DRAWGUESS_WORD_MODEL,
        providerLabel: 'DrawGuess',
        schema: drawGuessReviewsSchema,
        systemPrompt: REVIEW_PROMPT,
        payload: {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ word }) => ({ word })),
        },
        fetchImpl,
      });
      return parseDrawGuessReviews(output, candidates);
    },
  };
}
