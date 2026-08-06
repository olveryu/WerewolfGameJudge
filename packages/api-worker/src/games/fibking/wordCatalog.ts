/** Versioned, project-authored Chinese word catalog used as FibKing's sole content source. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordDefinition,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';

export const FIB_WORD_CATALOG_VERSION = 1;
export const FIB_WORD_HISTORY_LIMIT = 50;

const SELECTION_HASH_HEX_LENGTH = 8;
const CHINESE_WORD_PATTERN = /^\p{Script=Han}+$/u;
const CHINESE_TEXT_PATTERN = /^(?=.*\p{Script=Han})[\p{Script=Han}\p{N}\p{P}\p{Zs}]+$/u;

const fibWordDefinitionSchema = z
  .strictObject({
    coreMeaning: z.string().min(1).max(FIB_DEFINITION_FIELD_MAX_LENGTH).regex(CHINESE_TEXT_PATTERN),
    usageNote: z.string().min(1).max(FIB_DEFINITION_FIELD_MAX_LENGTH).regex(CHINESE_TEXT_PATTERN),
  })
  .readonly();

const fibWordCatalogEntrySchema = z
  .strictObject({
    id: z.string().regex(/^fib-[0-9]{4}$/),
    word: z.string().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH).regex(CHINESE_WORD_PATTERN),
    definition: fibWordDefinitionSchema,
    editorialStatus: z.literal('reviewed'),
    reference: z
      .strictObject({
        title: z.string().min(1),
        url: z.url(),
      })
      .readonly(),
  })
  .readonly();

const fibWordCatalogSchema = z
  .array(fibWordCatalogEntrySchema)
  .refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length, {
    message: 'Fib word catalog entry IDs must be unique',
  })
  .refine((entries) => new Set(entries.map((entry) => entry.word)).size === entries.length, {
    message: 'Fib word catalog words must be unique',
  })
  .readonly();

export type FibWordCatalogEntry = z.output<typeof fibWordCatalogEntrySchema>;

export interface FibWordCatalogRequest {
  readonly avoidWords: readonly string[];
  readonly recentWords: readonly string[];
  readonly selectionSeed: string;
}

export interface FibWordCatalogSelection {
  readonly catalogEntryId: string;
  readonly catalogVersion: number;
  readonly word: string;
  readonly definition: FibWordDefinition;
}

type ReferenceKind = 'dictionary' | 'modern';

function createReference(word: string, kind: ReferenceKind): FibWordCatalogEntry['reference'] {
  return kind === 'dictionary'
    ? {
        title: `汉典“${word}”词条`,
        url: `https://www.zdic.net/hans/${encodeURIComponent(word)}`,
      }
    : {
        title: `百度百科“${word}”词条`,
        url: `https://baike.baidu.com/item/${encodeURIComponent(word)}`,
      };
}

function entry(
  id: string,
  word: string,
  coreMeaning: string,
  usageNote: string,
  referenceKind: ReferenceKind = 'dictionary',
): unknown {
  return {
    id,
    word,
    definition: { coreMeaning, usageNote },
    editorialStatus: 'reviewed',
    reference: createReference(word, referenceKind),
  };
}

export const FIB_WORD_CATALOG = fibWordCatalogSchema.parse([
  entry(
    'fib-0001',
    '踟蹰',
    '来回走动而迟迟不能向前，也指拿不定主意。',
    '多用于书面语，既可写脚步徘徊，也可写内心犹疑；重点在迟迟不前。',
  ),
  entry(
    'fib-0002',
    '彳亍',
    '步子缓慢、时走时停的样子。',
    '常用于文学描写，突出独自行走时的迟缓节奏；不等同于因选择困难而犹豫。',
  ),
  entry(
    'fib-0003',
    '氤氲',
    '烟气、云雾或香气浓郁流动的样子。',
    '多形容可见或可感的气息弥漫，也可营造朦胧气氛；通常不形容固体堆积。',
  ),
  entry(
    'fib-0004',
    '龃龉',
    '上下牙齿不相配，引申为意见不合或相互抵触。',
    '书面语中多用于人与人、观点或安排之间的不协调，比一般争吵更强调难以相合。',
  ),
  entry(
    'fib-0005',
    '觊觎',
    '怀着非分之想，希望取得不属于自己的事物。',
    '带明显贬义，常与权位、利益或财物搭配；不能泛指正当愿望。',
  ),
  entry(
    'fib-0006',
    '睥睨',
    '斜着眼睛看，引申为傲慢地轻视他人。',
    '可写具体神态，也可写居高临下的态度；用于雄视四方时有时带豪迈意味。',
  ),
  entry(
    'fib-0007',
    '踽踽',
    '孤身行走、缺少同伴的样子。',
    '常见于“踽踽独行”，重点是孤单无依，不单指走路速度缓慢。',
  ),
  entry(
    'fib-0008',
    '逶迤',
    '道路、山脉或水流弯曲而绵延。',
    '用于具有连续走势的景物，强调曲折延伸；不用于短小而突然的转弯。',
  ),
  entry(
    'fib-0009',
    '峥嵘',
    '山势高峻突兀，引申为才气、气概或岁月不平凡。',
    '可形容地貌，也常用于“头角峥嵘”“峥嵘岁月”；语气比普通高大更有锋芒。',
  ),
  entry(
    'fib-0010',
    '蹀躞',
    '迈着小步来回走动。',
    '多见于古典或文学语境，侧重细碎步态；与“踯躅”相比，未必含强烈犹豫。',
  ),
  entry(
    'fib-0011',
    '迍邅',
    '处境艰难，前行受到阻碍。',
    '属于典雅书面语，常写命途或事业受挫；不是一般道路拥堵。',
  ),
  entry(
    'fib-0012',
    '缱绻',
    '情意深厚缠绵，彼此难以分离。',
    '多写亲密情感或眷恋，也可形容诗文情致；通常不用于短暂好感。',
  ),
  entry(
    'fib-0013',
    '绸缪',
    '紧密缠绕，引申为事先周密准备。',
    '现代常见于“未雨绸缪”，强调风险发生前筹划；不能把临时补救称为绸缪。',
  ),
  entry(
    'fib-0014',
    '旖旎',
    '柔美宜人、富有情致。',
    '多形容风光或氛围，也可写柔和情态；一般不用于雄壮、冷峻的景象。',
  ),
  entry(
    'fib-0015',
    '骀荡',
    '舒展和畅，也可指胸襟开阔洒脱。',
    '常形容春光、气候或人的气度，带古雅色彩；不是散漫拖沓。',
  ),
  entry(
    'fib-0016',
    '侘傺',
    '失意惆怅、长久不得志的状态。',
    '多见于古典文学，重在遭遇挫折后的郁结；比普通伤心更含身世失意。',
  ),
  entry(
    'fib-0017',
    '惝恍',
    '精神迷离恍惚，心神不能安定。',
    '常用于若有所失或感受难以把握的状态；不等同于医学意义的昏迷。',
  ),
  entry(
    'fib-0018',
    '怅惘',
    '因失意或希望落空而惆怅迷茫。',
    '强调惆怅中带茫然，常用于回忆、离别或落空之后；比单纯遗憾更低回。',
  ),
  entry(
    'fib-0019',
    '窸窣',
    '细小物体摩擦时连续发出的轻微声音。',
    '常写衣料、草叶或纸张的动静，适合安静环境中的细声；不用来写巨大声响。',
  ),
  entry(
    'fib-0020',
    '啁啾',
    '鸟类细碎而连续的鸣叫声。',
    '主要模拟鸟鸣，有时也借指细密的人声；与洪亮长鸣不同。',
  ),
  entry(
    'fib-0021',
    '謦欬',
    '咳嗽声，古时也借指谈笑或言语。',
    '多用于古雅书面表达，如亲承謦欬，表示聆听尊长言谈；日常咳嗽一般不用此词。',
  ),
  entry(
    'fib-0022',
    '啴缓',
    '声音宽舒和缓，或举止从容不迫。',
    '多见于古籍和音乐描写，强调舒展节奏；不是行动迟钝。',
  ),
  entry(
    'fib-0023',
    '菡萏',
    '荷花的古称，也可专指尚未开放的花苞。',
    '常用于诗词和典雅景物描写；现代日常表达通常直接说荷花。',
  ),
  entry(
    'fib-0024',
    '荏苒',
    '时间在不知不觉中渐渐过去。',
    '常与光阴、岁月搭配，含流逝感；不用于瞬间发生的变化。',
  ),
  entry(
    'fib-0025',
    '咄嗟',
    '呼吸之间的极短时间，也可表示吆喝呵斥。',
    '表示时间时常见于“咄嗟之间”；需结合语境与表示斥责的本义区分。',
  ),
  entry(
    'fib-0026',
    '俄顷',
    '很短的一会儿、片刻。',
    '书面叙事中用于连接短时间内发生的变化；比“顷刻”语气更古雅。',
  ),
  entry(
    'fib-0027',
    '熹微',
    '天色刚亮时光线微弱的样子。',
    '常写黎明或晨光，兼有微明与渐亮之意；不泛指任何昏暗光线。',
  ),
  entry(
    'fib-0028',
    '皑皑',
    '霜雪洁白并大片覆盖的样子。',
    '通常与白雪、雪峰搭配，强调洁白和连片；不用于零散白点。',
  ),
  entry(
    'fib-0029',
    '皴皱',
    '皮肤或物体表面粗糙并形成皱纹。',
    '可用于皮肤、树皮或干裂表面，突出纹理；与单纯弯折形成的褶皱有别。',
  ),
  entry(
    'fib-0030',
    '陆离',
    '色彩繁杂绚丽，或形态错综参差。',
    '常见于“光怪陆离”“斑驳陆离”，强调多样交错；不等同于整齐鲜艳。',
  ),
  entry(
    'fib-0031',
    '泬寥',
    '天空清朗空旷，也可形容环境寂静。',
    '古雅用语，常营造高远清冷之感；不是普通房间的安静。',
  ),
  entry(
    'fib-0032',
    '迤逦',
    '一路曲折延伸、连绵不断。',
    '可写道路、队伍或行程缓缓展开；侧重延续过程，不只描述形状。',
  ),
  entry(
    'fib-0033',
    '轇轕',
    '事物纵横交错、纠缠而难以理清。',
    '多形容关系、矛盾或结构复杂缠结；比一般混乱更强调彼此牵连。',
  ),
  entry(
    'fib-0034',
    '盘桓',
    '来回徘徊或停留不去。',
    '既可写脚步，也可写因留恋而逗留；比短暂停顿更有迟迟不离之意。',
  ),
  entry(
    'fib-0035',
    '纡徐',
    '举止或行文从容舒缓。',
    '用于节奏不急迫且有条理的状态；不含拖延懒散的贬义。',
  ),
  entry(
    'fib-0036',
    '逡巡',
    '因顾虑而迟疑退让、徘徊不前。',
    '常写面对决定或权威时不敢上前；比一般等待更突出畏缩。',
  ),
  entry(
    'fib-0037',
    '趑趄',
    '脚步迟疑，想前进却不敢前进。',
    '可比喻办事犹疑不决，语气偏书面；核心是欲进又止。',
  ),
  entry(
    'fib-0038',
    '踯躅',
    '在一个地方来回走，迟迟不前。',
    '常伴随犹豫、留恋或焦虑；比“徘徊”更古雅。',
  ),
  entry(
    'fib-0039',
    '悻悻',
    '怨恨、恼怒而不满意的样子。',
    '常写受挫后带气离开，如悻悻而去；不是单纯兴致低落。',
  ),
  entry(
    'fib-0040',
    '赧然',
    '因羞愧或不好意思而脸红。',
    '侧重羞惭外露的神态，通常程度较轻；不用于愤怒导致的脸红。',
  ),
  entry(
    'fib-0041',
    '愀然',
    '神色忽然严肃或因忧惧而改变。',
    '多写表情由轻松转为凝重，常用“愀然变色”；不是长期性格严肃。',
  ),
  entry(
    'fib-0042',
    '怵惕',
    '内心惊惧并保持警觉。',
    '兼有害怕和戒备两层意思，常见于书面语；比单纯紧张更有危机感。',
  ),
  entry(
    'fib-0043',
    '怆然',
    '悲伤凄恻的样子。',
    '多用于触景、怀人时突然涌起的深切悲感；语气比难过更沉重。',
  ),
  entry(
    'fib-0044',
    '凄怆',
    '处境凄凉、内心悲痛。',
    '可同时形容环境感受和人的情绪；比“凄凉”更突出悲伤。',
  ),
  entry(
    'fib-0045',
    '憯怛',
    '忧伤悲痛，心中不安。',
    '属于古雅书面语，常表达深重哀痛；日常轻微烦恼不宜使用。',
  ),
  entry(
    'fib-0046',
    '眈眈',
    '专注注视的样子，常含凶狠或贪婪意味。',
    '常见于“虎视眈眈”，表示等待机会攫取；不是中性的认真观看。',
  ),
  entry(
    'fib-0047',
    '睽睽',
    '许多人一同张眼注视。',
    '通常用于“众目睽睽”，强调公开场合无法避开视线；不指两个人私下对视。',
  ),
  entry(
    'fib-0048',
    '蹙頞',
    '皱眉并收紧鼻梁，表示忧愁或不悦。',
    '是较具体的面部神态描写，书面色彩强；比普通皱眉更细致。',
  ),
  entry(
    'fib-0049',
    '矍铄',
    '老年人精神健旺、行动有力。',
    '专用于年长者的良好精神状态，含赞许；不能泛指年轻人精力充沛。',
  ),
  entry(
    'fib-0050',
    '颟顸',
    '糊涂马虎，不明事理。',
    '用于批评人的判断和办事态度，贬义明显；不只是偶然粗心。',
  ),
  entry(
    'fib-0051',
    '伶俜',
    '孤单无依、处境困苦。',
    '多见于文学语境，兼写孤独与无所依靠；不等同于主动独处。',
  ),
  entry(
    'fib-0052',
    '醍醐',
    '从乳制品提炼出的精华，常比喻精妙道理。',
    '现代多见于“醍醐灌顶”，表示受到透彻启发；不能泛指普通提醒。',
  ),
  entry(
    'fib-0053',
    '琼浆',
    '传说中的仙酒，后比喻甘美珍贵的饮品。',
    '带赞美和文学色彩，常与玉液连用；日常白水一般不这样称呼。',
  ),
  entry(
    'fib-0054',
    '膏泽',
    '滋润作物的雨水，引申为恩惠。',
    '古典语境中可指及时雨或惠及众人的好处；不是油膏留下的污渍。',
  ),
  entry(
    'fib-0055',
    '霏霏',
    '雨雪、烟云等密集纷飞的样子。',
    '常用于连续而细密的景象，如雨雪霏霏；不强调单个颗粒。',
  ),
  entry(
    'fib-0056',
    '滂濞',
    '水势浩大，或声音宏阔。',
    '属于古雅用语，可写奔涌水流和盛大声势；不用于细流轻响。',
  ),
  entry(
    'fib-0057',
    '潏潏',
    '水流不断涌出或流动的样子。',
    '多见于古籍水景描写，也可使人联想到水声；不是静止水面。',
  ),
  entry(
    'fib-0058',
    '汩汩',
    '水流连续发出的声音或流动的样子。',
    '常写泉水、溪水持续流淌；与“涓涓”相比更侧重可听见的流声。',
  ),
  entry(
    'fib-0059',
    '涓涓',
    '细小水流缓慢而连续地流动。',
    '强调水量细微但不间断，也可比喻持续的小贡献；不用于洪流。',
  ),
  entry(
    'fib-0060',
    '霶霈',
    '雨势盛大，也可比喻恩泽深广。',
    '古雅书面语，既可实写大雨，也可作颂扬性比喻；不同于普通阵雨。',
  ),
  entry(
    'fib-0061',
    '叆叇',
    '浓云密布、遮暗天空的样子。',
    '多用于古典景物描写，强调云层厚重昏暗；不是轻薄白云。',
  ),
  entry(
    'fib-0062',
    '绛紫',
    '紫色中带有较深的红色。',
    '用于颜色辨识，介于深红和紫之间；不是泛指所有暗紫色。',
  ),
  entry(
    'fib-0063',
    '缁色',
    '黑中略带红意的深暗颜色。',
    '常见于古代服色或织物描述；与纯黑相比带有细微暖色。',
  ),
  entry(
    'fib-0064',
    '阒寂',
    '空旷而寂静，几乎没有声息。',
    '书面语中常用于夜晚、街巷或荒地，静寂程度很深；不只是声音稍小。',
  ),
  entry(
    'fib-0065',
    '倥偬',
    '事情急迫繁忙，奔走而不得闲。',
    '常见于“戎马倥偬”“事务倥偬”，强调忙乱紧迫；不是从容的忙碌。',
  ),
  entry(
    'fib-0066',
    '觳觫',
    '因恐惧而身体发抖。',
    '古雅用语，常描写面对威胁时战栗；不能用于寒冷造成的普通发抖。',
  ),
  entry(
    'fib-0067',
    '乖舛',
    '事情违背常理而不顺，或命运多有波折。',
    '多用于书面叙述境遇与预期相反；不是性格乖巧与否。',
  ),
  entry(
    'fib-0068',
    '僭越',
    '超越身份、本分或权限行事。',
    '带批评意味，常用于礼制、职权和边界；与合理授权后的代行不同。',
  ),
  entry(
    'fib-0069',
    '廓落',
    '空间空阔寂寥，也可形容胸襟开朗。',
    '需依语境判断是景物的空旷还是人的豁达；不等同于物品掉落。',
  ),
  entry(
    'fib-0070',
    '翕忽',
    '变化迅速，转眼即逝。',
    '常写景象或状态开合变幻，带古雅色彩；不是长时间渐变。',
  ),
  entry(
    'fib-0071',
    '町畦',
    '田地之间的界限，引申为拘束人的规矩。',
    '比喻用法常指过分分门别类或自设边界；不是一般农业面积单位。',
  ),
  entry(
    'fib-0072',
    '刍荛',
    '割草打柴的人，旧时也用来谦称浅陋意见。',
    '常见于“刍荛之见”，说话人自谦；不能用来贬低他人的意见。',
  ),
  entry(
    'fib-0073',
    '蠲除',
    '免除负担，或清除积存的问题。',
    '书面语中常与税费、旧弊搭配；比一般删除更有解除之意。',
  ),
  entry(
    'fib-0074',
    '觇视',
    '暗中窥看并观察动静。',
    '强调不公开的侦察性观看，带隐蔽意味；不同于公开参观。',
  ),
  entry(
    'fib-0075',
    '崔嵬',
    '山势或建筑高大险峻。',
    '常用于具有压迫感和层次感的高耸景物；比普通高大更雄奇。',
  ),
  entry(
    'fib-0076',
    '嵯峨',
    '山石高峻不齐、层叠耸立。',
    '侧重峰峦参差的形态，也可写高耸建筑；不用于平滑整齐的高度。',
  ),
  entry(
    'fib-0077',
    '蓊郁',
    '草木茂盛浓密，充满生机。',
    '多形容成片植被繁茂；比“绿色”更强调枝叶密集。',
  ),
  entry(
    'fib-0078',
    '蘧然',
    '忽然惊醒、惊喜或有所领悟的样子。',
    '古雅语境中表示状态突然转变，具体情绪需看上下文；不是持续兴奋。',
  ),
  entry(
    'fib-0079',
    '电子榨菜',
    '吃饭时用来陪伴和消遣的轻松数字内容。',
    '网络比喻，强调像佐餐小菜一样提供陪伴；不指真实食品或电子设备。',
    'modern',
  ),
  entry(
    'fib-0080',
    '情绪价值',
    '互动中为他人带来的理解、安慰和积极感受。',
    '常用于评价关系体验，不等于一味迎合，也不能替代实际责任与行动。',
    'modern',
  ),
  entry(
    'fib-0081',
    '信息茧房',
    '长期接触相似信息后形成的封闭认知环境。',
    '强调算法选择与个人偏好共同缩窄视野；不是简单的信息数量不足。',
    'modern',
  ),
  entry(
    'fib-0082',
    '数字游民',
    '依靠网络远程工作并在不同地点生活的人。',
    '核心是工作不受固定办公地点限制；普通出差或短期旅行者不一定属于此类。',
    'modern',
  ),
  entry(
    'fib-0083',
    '反向旅游',
    '主动避开热门目的地或高峰时段的旅行选择。',
    '目的是降低拥挤和成本、寻找替代体验；并非把既定路线倒着走。',
    'modern',
  ),
  entry(
    'fib-0084',
    '松弛感',
    '面对压力时仍显得自然、从容而不过度紧绷的状态。',
    '强调稳定和自在，不等于懒散、敷衍或缺少边界。',
    'modern',
  ),
  entry(
    'fib-0085',
    '钝感力',
    '不过度受外界评价和细小刺激影响的心理能力。',
    '通常指有选择地降低敏感度以维持行动；不是对风险和他人感受完全麻木。',
    'modern',
  ),
  entry(
    'fib-0086',
    '显眼包',
    '言行格外醒目并常带喜剧效果的人。',
    '网络称呼可亲昵也可调侃，语气取决于关系；不宜在正式场合随意贴标签。',
    'modern',
  ),
  entry(
    'fib-0087',
    '班味',
    '长期工作压力在人身上呈现出的疲惫、拘谨或机械感。',
    '多用于职场自嘲，描述一种综合状态；不是实际气味。',
    'modern',
  ),
  entry(
    'fib-0088',
    '社交电量',
    '一个人投入社交活动时可支配的精力。',
    '用电量作比喻，可说耗尽或充电；它描述主观精力，不是人格好坏。',
    'modern',
  ),
  entry(
    'fib-0089',
    '赛博搭子',
    '主要通过网络陪伴、交流或共同活动的轻量伙伴。',
    '关系通常围绕特定兴趣且线下接触较少；不必等同于亲密朋友。',
    'modern',
  ),
  entry(
    'fib-0090',
    '搭子文化',
    '围绕某项具体活动建立低负担伙伴关系的社交方式。',
    '常见饭搭子、运动搭子等，边界较明确；与需要全面情感投入的关系不同。',
    'modern',
  ),
  entry(
    'fib-0091',
    '精神离职',
    '仍保留职位，但心理上降低投入和组织认同的状态。',
    '通常指只完成职责底线、不再额外付出；与正式提交离职不同。',
    'modern',
  ),
  entry(
    'fib-0092',
    '已读乱回',
    '看过消息后故意给出跳脱、错位或不相干的回复。',
    '多用于熟人间制造幽默效果；若发生在严肃沟通中可能被视为敷衍。',
    'modern',
  ),
  entry(
    'fib-0093',
    '情绪劳动',
    '为符合工作或角色要求而调节、压抑或展示情绪。',
    '重点是情绪表达成为任务的一部分；不等同于所有让人心累的活动。',
    'modern',
  ),
  entry(
    'fib-0094',
    '幸存者偏差',
    '只观察留下或成功的样本而忽略已淘汰样本造成的误判。',
    '分析经验和数据时需主动寻找未被看见的失败案例；不是“幸存者一定判断错误”。',
    'modern',
  ),
  entry(
    'fib-0095',
    '峰终定律',
    '人往往依据体验最强烈的时刻和结尾评价整段经历。',
    '它描述记忆评价的倾向，不表示过程中的其他部分完全没有影响。',
    'modern',
  ),
  entry(
    'fib-0096',
    '鸟笼效应',
    '拥有一件物品后继续添置与之配套物品的心理倾向。',
    '常用于解释消费和配置扩张；不是关于真实鸟笼使用方式的规律。',
    'modern',
  ),
  entry(
    'fib-0097',
    '沉没成本',
    '已经发生且无法收回，不会因当前选择而改变的成本。',
    '理性决策应比较未来收益与代价；继续投入只为“不浪费过去”容易受其影响。',
    'modern',
  ),
  entry(
    'fib-0098',
    '多巴胺穿搭',
    '用明亮、高饱和色彩营造愉悦感的穿衣风格。',
    '名称借用愉悦联想描述视觉风格，不代表服装能直接改变人体化学过程。',
    'modern',
  ),
  entry(
    'fib-0099',
    '反向消费',
    '主动削减品牌溢价、转而重视实用和性价比的消费倾向。',
    '并非完全停止消费，而是重新排序需求、价格和品牌的权重。',
    'modern',
  ),
  entry(
    'fib-0100',
    '城市漫游',
    '不以打卡固定景点为目标，步行感受城市街区的活动。',
    '强调开放路线和日常空间观察；与按表赶景点的观光方式不同。',
    'modern',
  ),
  entry(
    'fib-0101',
    '不刊之论',
    '正确而不可改动的言论。',
    '“刊”在这里指削除或修改；这个褒义词不能用来表示未发表的观点。',
  ),
]);

if (FIB_WORD_CATALOG.length <= FIB_USED_WORD_LIMIT + FIB_WORD_HISTORY_LIMIT) {
  throw new Error('Fib word catalog must exceed the combined room and participant history windows');
}

/** Explicit terminal signal when every reviewed catalog entry is excluded. */
export class FibWordCatalogExhaustedError extends Error {
  readonly failureCode = 'catalog-exhausted' as const;

  constructor() {
    super('Fib word catalog has no eligible entry');
    this.name = 'FibWordCatalogExhaustedError';
  }
}

export async function selectFibWordCatalogEntry(
  request: FibWordCatalogRequest,
): Promise<FibWordCatalogSelection> {
  if (request.selectionSeed.length === 0) {
    throw new Error('Fib word selection seed must be non-empty');
  }
  const excludedWords = new Set([...request.avoidWords, ...request.recentWords]);
  const eligibleEntries = FIB_WORD_CATALOG.filter(
    (candidate) => !excludedWords.has(candidate.word),
  );
  if (eligibleEntries.length === 0) throw new FibWordCatalogExhaustedError();

  const selectionHash = await sha256Hex(request.selectionSeed);
  const selectionValue = Number.parseInt(selectionHash.slice(0, SELECTION_HASH_HEX_LENGTH), 16);
  const selected = eligibleEntries[selectionValue % eligibleEntries.length];
  if (selected === undefined) {
    throw new Error('[FAIL-FAST] Fib word catalog selection produced no entry');
  }
  return {
    catalogEntryId: selected.id,
    catalogVersion: FIB_WORD_CATALOG_VERSION,
    word: selected.word,
    definition: selected.definition,
  };
}
