/**
 * fibWordBank — built-in obscure-word fallback for fibking word generation.
 *
 * Guarantees a word is always available even when Gemini and Workers AI both fail.
 * Entries are genuine, real Chinese words with accurate, concise definitions.
 * Picked via Web-Crypto shuffle + usedWords filter; window exhaustion resets (allows repeats)
 * so a long session never deadlocks.
 */

import { shuffleArray } from '@werewolf/game-engine/utils/shuffle';

export interface FibWordEntry {
  word: string;
  definition: string;
}

const FIB_WORD_BANK: readonly FibWordEntry[] = Object.freeze([
  { word: '踟蹰', definition: '徘徊不前,要走不走的样子。' },
  { word: '彳亍', definition: '慢步行走,走走停停的样子。' },
  { word: '氤氲', definition: '烟气、云雾弥漫缭绕的样子。' },
  { word: '龃龉', definition: '上下牙齿不相吻合;比喻意见不合、相抵触。' },
  { word: '觊觎', definition: '非分地希望得到不该得到的东西。' },
  { word: '睥睨', definition: '斜着眼睛看人,表示傲慢或轻视。' },
  { word: '踽踽', definition: '一个人孤零零地独自走路的样子。' },
  { word: '逶迤', definition: '道路、山脉、河流弯弯曲曲延续不绝的样子。' },
  { word: '峥嵘', definition: '形容山势高峻突兀;也指才气、年岁不平凡。' },
  { word: '踉跄', definition: '走路歪斜不稳,跌跌撞撞的样子。' },
  { word: '蹒跚', definition: '腿脚不灵便,走路缓慢摇摆的样子。' },
  { word: '缱绻', definition: '形容情意缠绵深厚,难舍难分。' },
  { word: '绸缪', definition: '缠绕;引申为事先做好准备,如未雨绸缪。' },
  { word: '旖旎', definition: '柔和美好,多用来形容风光景色。' },
  { word: '婀娜', definition: '形容姿态柔软而美好。' },
  { word: '蹉跎', definition: '把时光白白地耽误过去。' },
  { word: '惆怅', definition: '因失意或失望而伤感、愁闷。' },
  { word: '怅惘', definition: '因失意而心事重重、迷茫若失。' },
  { word: '魑魅', definition: '传说中山林里害人的精怪。' },
  { word: '魍魉', definition: '传说中的山川精怪、鬼怪。' },
  { word: '饕餮', definition: '传说中贪食的凶兽;比喻贪婪凶恶的人。' },
  { word: '窸窣', definition: '形容细小、轻微的摩擦声音。' },
  { word: '啁啾', definition: '形容鸟类细碎而连续的鸣叫声。' },
  { word: '呢喃', definition: '形容燕子的叫声;也指低声细语。' },
  { word: '聒噪', definition: '声音杂乱吵闹,使人心烦。' },
  { word: '菡萏', definition: '荷花的别称,多指含苞未放的荷花。' },
  { word: '荏苒', definition: '形容时间不知不觉地渐渐过去。' },
  { word: '须臾', definition: '极短的时间;片刻之间。' },
  { word: '俄顷', definition: '一会儿,片刻的工夫。' },
  { word: '熹微', definition: '形容清晨的阳光微弱不强。' },
  { word: '皑皑', definition: '形容霜、雪洁白的样子。' },
  { word: '皲裂', definition: '皮肤因寒冷干燥而裂开。' },
  { word: '斑驳', definition: '一种颜色里夹杂着别的颜色,色彩错杂。' },
  { word: '缥缈', definition: '隐隐约约、若有若无的样子。' },
  { word: '迤逦', definition: '曲折绵延不绝的样子。' },
  { word: '蜿蜒', definition: '像蛇爬行那样弯弯曲曲地延伸。' },
  { word: '盘桓', definition: '徘徊逗留,不忍离去。' },
  { word: '徜徉', definition: '安闲自在地来回行走;留连徘徊。' },
  { word: '逡巡', definition: '因有顾虑而徘徊不前、迟疑不敢上前。' },
  { word: '踌躇', definition: '犹豫不决;也指停留不前。' },
  { word: '彷徨', definition: '走来走去拿不定主意,犹疑不决。' },
  { word: '悻悻', definition: '怨恨愤怒、悻然不悦的样子。' },
  { word: '赧然', definition: '因羞愧而脸红的样子。' },
  { word: '愠怒', definition: '心中含怒,恼怒而不形于色。' },
  { word: '嗔怒', definition: '生气、发怒。' },
  { word: '怆然', definition: '悲伤凄恻的样子。' },
  { word: '凄怆', definition: '凄凉而悲伤。' },
  { word: '恻隐', definition: '见人遭遇苦难而心中不忍、生出同情。' },
  { word: '眈眈', definition: '凶狠贪婪地注视的样子,如虎视眈眈。' },
  { word: '睽睽', definition: '张大眼睛注视的样子,如众目睽睽。' },
  { word: '瞠目', definition: '瞪着眼睛,多形容惊讶或受窘。' },
  { word: '矍铄', definition: '形容老年人精神健旺、目光有神。' },
  { word: '颟顸', definition: '形容人糊涂而马虎,不明事理。' },
  { word: '邋遢', definition: '形容人或环境不整洁、不利落。' },
  { word: '褴褛', definition: '形容衣服破烂不堪。' },
  { word: '醍醐', definition: '从酥酪中提制的精纯油脂;比喻美酒或精妙的道理。' },
  { word: '琼浆', definition: '比喻甘美的酒或饮料。' },
  { word: '甘霖', definition: '久旱之后所降的及时雨。' },
  { word: '霏霏', definition: '形容雨雪密集或烟云盛多的样子。' },
  { word: '淅沥', definition: '形容轻微的风雨声、落叶声等。' },
  { word: '潺潺', definition: '形容溪水、泉水缓缓流动的声音。' },
  { word: '汩汩', definition: '形容水流动的声音。' },
  { word: '涓涓', definition: '细小的水流缓缓流动的样子。' },
  { word: '滂沱', definition: '形容雨下得很大;也形容泪流得多。' },
  { word: '雾霭', definition: '弥漫在空中的雾气与云气。' },
  { word: '绛紫', definition: '暗紫中略带红的颜色。' },
  { word: '靛蓝', definition: '深蓝色;一种蓝色染料。' },
  { word: '缁衣', definition: '古代用黑色丝帛做的衣服;也指僧尼的黑色衣着。' },
]);

/**
 * Content blocklist — reject LLM output whose word/definition contains any of these
 * substrings. Intentionally small and conservative; the prompt also instructs safety.
 */
const FIB_WORD_BLOCKLIST: readonly string[] = Object.freeze([
  '政治',
  '色情',
  '暴力',
  '赌博',
  '毒品',
]);

export function isContentSafe(word: string, definition: string): boolean {
  const haystack = `${word} ${definition}`;
  return !FIB_WORD_BLOCKLIST.some((bad) => haystack.includes(bad));
}

/**
 * Pick a bank word not in `avoid`. If the window is exhausted (all banked words used),
 * reset by returning a freshly shuffled pick (repeat allowed) so long sessions never deadlock.
 */
export function pickFallbackWord(avoid: readonly string[]): FibWordEntry {
  const avoidSet = new Set(avoid);
  const shuffled = shuffleArray([...FIB_WORD_BANK]);
  return shuffled.find((entry) => !avoidSet.has(entry.word)) ?? shuffled[0];
}
