/** Curated local word bank used by development, tests, and explicit local policy. */

import {
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_USED_WORD_LIMIT,
  type FibWordDefinition,
} from '@game-judge/game-engine/games/fibking/public';

export interface LocalFibWord {
  readonly word: string;
  readonly definition: FibWordDefinition;
}

const LOCAL_FIB_WORD_SEEDS = [
  { word: '踟蹰', definition: '徘徊不前，要走不走的样子。' },
  { word: '彳亍', definition: '慢步行走，走走停停的样子。' },
  { word: '氤氲', definition: '烟气或云雾弥漫缭绕的样子。' },
  { word: '龃龉', definition: '比喻意见不合或彼此抵触。' },
  { word: '觊觎', definition: '非分地希望得到不该得到的东西。' },
  { word: '睥睨', definition: '斜眼看人，表示傲慢或轻视。' },
  { word: '踽踽', definition: '一个人孤零零独自行走的样子。' },
  { word: '逶迤', definition: '道路或山水弯曲延续的样子。' },
  { word: '峥嵘', definition: '形容山势高峻，也比喻才气不凡。' },
  { word: '蹀躞', definition: '迈着小步来回行走或徘徊。' },
  { word: '迍邅', definition: '处境艰难，行进受阻而不得前。' },
  { word: '缱绻', definition: '形容情意缠绵深厚，难舍难分。' },
  { word: '绸缪', definition: '引申为事先做好准备。' },
  { word: '旖旎', definition: '柔和美好，多用来形容风光。' },
  { word: '骀荡', definition: '形容春光舒展和畅，也指胸襟开阔。' },
  { word: '侘傺', definition: '失意而神情惆怅，长久不得志。' },
  { word: '惝恍', definition: '因失意而精神恍惚，若有所失。' },
  { word: '怅惘', definition: '因失意而迷茫若失。' },
  { word: '窸窣', definition: '形容细小轻微的摩擦声音。' },
  { word: '啁啾', definition: '形容鸟类细碎连续的鸣叫声。' },
  { word: '謦欬', definition: '咳嗽声，也借指谈笑或言语。' },
  { word: '啴缓', definition: '声音舒缓和畅，也形容宽舒从容。' },
  { word: '菡萏', definition: '尚未开放的荷花，也泛指荷花。' },
  { word: '荏苒', definition: '形容时间不知不觉地过去。' },
  { word: '咄嗟', definition: '呼吸之间，形容时间非常短促。' },
  { word: '俄顷', definition: '一会儿，片刻的工夫。' },
  { word: '熹微', definition: '形容清晨的阳光微弱。' },
  { word: '皑皑', definition: '形容霜雪洁白的样子。' },
  { word: '皴皱', definition: '皮肤或物体表面粗糙起皱。' },
  { word: '陆离', definition: '色彩繁杂绚丽，参差错综。' },
  { word: '泬寥', definition: '天空清朗空旷，也形容寂静。' },
  { word: '迤逦', definition: '曲折绵延不绝的样子。' },
  { word: '轇轕', definition: '事物纵横交错，纠缠而难以理清。' },
  { word: '盘桓', definition: '徘徊逗留，不忍离去。' },
  { word: '纡徐', definition: '从容舒缓，不急迫仓促。' },
  { word: '逡巡', definition: '因有顾虑而徘徊不前。' },
  { word: '趑趄', definition: '脚步迟疑，想前进又不敢前进。' },
  { word: '踯躅', definition: '徘徊不前，也指缓慢地来回走。' },
  { word: '悻悻', definition: '怨恨愤怒而不高兴的样子。' },
  { word: '赧然', definition: '因羞愧而脸红的样子。' },
  { word: '愀然', definition: '神色严肃或因忧惧而变了脸色。' },
  { word: '怵惕', definition: '心中惊惧警觉，不能安定。' },
  { word: '怆然', definition: '悲伤凄恻的样子。' },
  { word: '凄怆', definition: '处境凄凉，内心十分悲伤。' },
  { word: '憯怛', definition: '忧伤悲痛，内心不安。' },
  { word: '眈眈', definition: '凶狠贪婪地注视的样子。' },
  { word: '睽睽', definition: '许多人张眼注视的样子。' },
  { word: '蹙頞', definition: '皱起眉头，形容忧愁不悦。' },
  { word: '矍铄', definition: '形容老年人精神健旺。' },
  { word: '颟顸', definition: '形容人糊涂马虎，不明事理。' },
  { word: '伶俜', definition: '孤单无依，处境困苦。' },
  { word: '醍醐', definition: '比喻精妙的道理或智慧。' },
  { word: '琼浆', definition: '比喻甘美的酒或饮料。' },
  { word: '膏泽', definition: '滋润作物的雨水，也比喻恩惠。' },
  { word: '霏霏', definition: '形容雨雪密集或烟云盛多。' },
  { word: '滂濞', definition: '水势浩大，也形容声响宏阔。' },
  { word: '潏潏', definition: '水流涌出的样子，也指水声。' },
  { word: '汩汩', definition: '形容水流动的声音。' },
  { word: '涓涓', definition: '细小水流缓缓流动的样子。' },
  { word: '霶霈', definition: '雨势盛大，也比喻恩泽广厚。' },
  { word: '叆叇', definition: '云彩浓密昏暗，遮蔽天空。' },
  { word: '绛紫', definition: '暗紫中略带红的颜色。' },
  { word: '缁色', definition: '黑中略带赤意的深暗颜色。' },
  { word: '阒寂', definition: '环境空旷安静，完全没有声息。' },
  { word: '倥偬', definition: '事情急迫繁忙，奔走而不得闲。' },
  { word: '觳觫', definition: '因恐惧而身体发抖的样子。' },
  { word: '乖舛', definition: '事情违背常理，命运多有不顺。' },
  { word: '僭越', definition: '超越本分或身份去做不应做的事。' },
  { word: '廓落', definition: '空阔寂寥，也可形容胸襟开朗。' },
  { word: '翕忽', definition: '迅疾短暂，转眼之间便发生变化。' },
  { word: '町畦', definition: '田地界限，也比喻拘束人的规矩。' },
  { word: '刍荛', definition: '割草打柴的人，也谦称浅陋意见。' },
  { word: '蠲除', definition: '免除或清除积存的事物。' },
  { word: '觇视', definition: '暗中窥看并观察动静。' },
  { word: '崔嵬', definition: '山势高大险峻，也形容建筑巍峨。' },
  { word: '嵯峨', definition: '山势高峻不齐，层叠耸立。' },
  { word: '蓊郁', definition: '草木繁茂，浓密而有生气。' },
  { word: '蘧然', definition: '惊喜或惊醒时突然领悟的样子。' },
  { word: '信息茧房', definition: '因持续接触同类信息而形成的封闭认知空间。' },
  { word: '情绪劳动', definition: '为工作要求而管理或表演自身情绪的过程。' },
  { word: '幸存者偏差', definition: '只关注留下的样本而忽略失败者造成的判断偏差。' },
  { word: '峰终定律', definition: '人主要依据体验高峰和结尾形成整体印象的规律。' },
  { word: '鸟笼效应', definition: '获得一件物品后继续添置配套物品的心理倾向。' },
] as const;

function createLocalFibWord(seed: (typeof LOCAL_FIB_WORD_SEEDS)[number]): LocalFibWord {
  const coreMeaning =
    seed.definition.length >= FIB_DEFINITION_FIELD_MIN_LENGTH
      ? seed.definition
      : `${seed.definition}这是该词在常见语境中的基本含义。`;
  return {
    word: seed.word,
    definition: {
      coreMeaning,
      usageNote: `使用“${seed.word}”时应结合具体对象与上下文，避免只凭字面猜测其含义。`,
    },
  };
}

export const LOCAL_FIB_WORD_BANK: readonly LocalFibWord[] =
  LOCAL_FIB_WORD_SEEDS.map(createLocalFibWord);

if (LOCAL_FIB_WORD_BANK.length <= FIB_USED_WORD_LIMIT) {
  throw new Error('Local Fib word bank must exceed the used-word history window');
}
