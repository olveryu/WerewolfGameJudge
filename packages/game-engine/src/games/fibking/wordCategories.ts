/** FibKing inventory categories shared by generation, submissions, inventory, and administration. */
import { defineWordCategoryCatalog } from '../../product/wordSupply/categoryCatalog';

/** Supply categories in order, then `other` (classification fallback; never generated). */
export const FIBKING_WORD_CATEGORY_CATALOG = defineWordCategoryCatalog('fibking', [
  { id: 'customs', name: '民俗礼仪' },
  { id: 'festivals', name: '节令节庆' },
  { id: 'clothing', name: '服饰衣冠' },
  { id: 'food', name: '饮食菜肴' },
  { id: 'drinks', name: '茶酒饮品' },
  { id: 'utensils', name: '器物用具' },
  { id: 'buildings', name: '建筑营造' },
  { id: 'crafts', name: '手工技艺' },
  { id: 'textiles', name: '纺织染绣' },
  { id: 'agriculture', name: '农耕渔猎' },
  { id: 'mining', name: '矿冶盐业' },
  { id: 'trade', name: '商业金融' },
  { id: 'currency', name: '货币钱财' },
  { id: 'transport', name: '交通行旅' },
  { id: 'education', name: '教育科举' },
  { id: 'games', name: '游戏博戏' },
  { id: 'sports', name: '体育武术' },
  { id: 'music', name: '音乐乐器' },
  { id: 'theatre', name: '戏曲曲艺' },
  { id: 'painting', name: '书画艺术' },
  { id: 'literature', name: '语言文字' },
  { id: 'dialect', name: '方言俗语' },
  { id: 'internet', name: '网络文化' },
  { id: 'occupations', name: '职业行话' },
  { id: 'law', name: '法律制度' },
  { id: 'medicine', name: '医药养生' },
  { id: 'plants', name: '植物花草' },
  { id: 'animals', name: '动物生物' },
  { id: 'earth', name: '地理矿物' },
  { id: 'astronomy', name: '天文气象' },
  { id: 'science', name: '科学技术' },
  { id: 'courtship', name: '婚恋风俗' },
  { id: 'emotions', name: '情感词语' },
  { id: 'drinkingCustoms', name: '酒令酒俗' },
  { id: 'partyGames', name: '聚会游戏' },
  { id: 'jianghu', name: '江湖行话' },
  { id: 'stageProps', name: '戏台道具' },
  { id: 'theatricalTricks', name: '戏剧机关' },
  { id: 'detective', name: '侦探推理' },
  { id: 'socialEtiquette', name: '社交礼节' },
  { id: 'urbanSlang', name: '市井俚语' },
  { id: 'other', name: '其他' },
]);
export type FibWordCategory = (typeof FIBKING_WORD_CATEGORY_CATALOG.ids)[number];
export type FibWordSupplyCategory = Exclude<FibWordCategory, 'other'>;

function isFibWordSupplyCategory(id: FibWordCategory): id is FibWordSupplyCategory {
  return id !== 'other';
}

/** Categories the supply workflow generates: every catalog id except `other`, in catalog order. */
export const FIB_WORD_CATEGORY_IDS: readonly FibWordSupplyCategory[] =
  FIBKING_WORD_CATEGORY_CATALOG.ids.filter(isFibWordSupplyCategory);
