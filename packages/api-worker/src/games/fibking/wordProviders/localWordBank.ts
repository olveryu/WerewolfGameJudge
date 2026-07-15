/** Curated local word bank used by development, tests, and explicit local policy. */

import { FIB_USED_WORD_LIMIT } from '@werewolf/game-engine/games/fibking/public';

export interface LocalFibWord {
  readonly word: string;
  readonly definition: string;
}

export const LOCAL_FIB_WORD_BANK: readonly LocalFibWord[] = [
  { word: '踟蹰', definition: '徘徊不前，要走不走的样子。' },
  { word: '彳亍', definition: '慢步行走，走走停停的样子。' },
  { word: '氤氲', definition: '烟气或云雾弥漫缭绕的样子。' },
  { word: '龃龉', definition: '比喻意见不合或彼此抵触。' },
  { word: '觊觎', definition: '非分地希望得到不该得到的东西。' },
  { word: '睥睨', definition: '斜眼看人，表示傲慢或轻视。' },
  { word: '踽踽', definition: '一个人孤零零独自行走的样子。' },
  { word: '逶迤', definition: '道路或山水弯曲延续的样子。' },
  { word: '峥嵘', definition: '形容山势高峻，也比喻才气不凡。' },
  { word: '踉跄', definition: '走路歪斜不稳的样子。' },
  { word: '蹒跚', definition: '腿脚不灵便，走路缓慢摇摆。' },
  { word: '缱绻', definition: '形容情意缠绵深厚，难舍难分。' },
  { word: '绸缪', definition: '引申为事先做好准备。' },
  { word: '旖旎', definition: '柔和美好，多用来形容风光。' },
  { word: '婀娜', definition: '形容姿态柔软而美好。' },
  { word: '蹉跎', definition: '把时光白白耽误过去。' },
  { word: '惆怅', definition: '因失意或失望而伤感愁闷。' },
  { word: '怅惘', definition: '因失意而迷茫若失。' },
  { word: '窸窣', definition: '形容细小轻微的摩擦声音。' },
  { word: '啁啾', definition: '形容鸟类细碎连续的鸣叫声。' },
  { word: '呢喃', definition: '指低声细语，也可形容燕鸣。' },
  { word: '聒噪', definition: '声音杂乱吵闹，使人心烦。' },
  { word: '菡萏', definition: '尚未开放的荷花，也泛指荷花。' },
  { word: '荏苒', definition: '形容时间不知不觉地过去。' },
  { word: '须臾', definition: '极短的时间，片刻。' },
  { word: '俄顷', definition: '一会儿，片刻的工夫。' },
  { word: '熹微', definition: '形容清晨的阳光微弱。' },
  { word: '皑皑', definition: '形容霜雪洁白的样子。' },
  { word: '皲裂', definition: '皮肤因寒冷干燥而裂开。' },
  { word: '斑驳', definition: '多种颜色错杂在一起。' },
  { word: '缥缈', definition: '隐隐约约，若有若无。' },
  { word: '迤逦', definition: '曲折绵延不绝的样子。' },
  { word: '蜿蜒', definition: '弯弯曲曲地向前延伸。' },
  { word: '盘桓', definition: '徘徊逗留，不忍离去。' },
  { word: '徜徉', definition: '安闲自在地来回行走。' },
  { word: '逡巡', definition: '因有顾虑而徘徊不前。' },
  { word: '踌躇', definition: '犹豫不决，停留不前。' },
  { word: '彷徨', definition: '走来走去，拿不定主意。' },
  { word: '悻悻', definition: '怨恨愤怒而不高兴的样子。' },
  { word: '赧然', definition: '因羞愧而脸红的样子。' },
  { word: '愠怒', definition: '心中含怒，恼怒而不外露。' },
  { word: '嗔怒', definition: '因不满而生气或发怒。' },
  { word: '怆然', definition: '悲伤凄恻的样子。' },
  { word: '凄怆', definition: '处境凄凉，内心十分悲伤。' },
  { word: '恻隐', definition: '见人受苦而心中不忍。' },
  { word: '眈眈', definition: '凶狠贪婪地注视的样子。' },
  { word: '睽睽', definition: '许多人张眼注视的样子。' },
  { word: '瞠目', definition: '瞪着眼睛，常表示惊讶。' },
  { word: '矍铄', definition: '形容老年人精神健旺。' },
  { word: '颟顸', definition: '形容人糊涂马虎，不明事理。' },
  { word: '褴褛', definition: '形容衣服破烂不堪。' },
  { word: '醍醐', definition: '比喻精妙的道理或智慧。' },
  { word: '琼浆', definition: '比喻甘美的酒或饮料。' },
  { word: '甘霖', definition: '久旱之后降下的及时雨。' },
  { word: '霏霏', definition: '形容雨雪密集或烟云盛多。' },
  { word: '淅沥', definition: '形容轻微的风雨或落叶声。' },
  { word: '潺潺', definition: '形容溪水缓缓流动的声音。' },
  { word: '汩汩', definition: '形容水流动的声音。' },
  { word: '涓涓', definition: '细小水流缓缓流动的样子。' },
  { word: '滂沱', definition: '形容雨下得很大。' },
  { word: '雾霭', definition: '弥漫在空中的雾气与云气。' },
  { word: '绛紫', definition: '暗紫中略带红的颜色。' },
  { word: '靛蓝', definition: '一种较深的蓝色。' },
] as const;

if (LOCAL_FIB_WORD_BANK.length <= FIB_USED_WORD_LIMIT) {
  throw new Error('Local Fib word bank must exceed the used-word history window');
}
