/** Undercover inventory categories shared by state, editorial supply, administration, and the client. */
import { defineWordCategoryCatalog } from '../../product/wordSupply/categoryCatalog';

export const UNDERCOVER_WORD_CATEGORY_CATALOG = defineWordCategoryCatalog('undercover', [
  { id: 'food', name: '吃喝美食' },
  { id: 'dailyLife', name: '日常生活' },
  { id: 'school', name: '校园学习' },
  { id: 'work', name: '职场工作' },
  { id: 'relationships', name: '人际关系' },
  { id: 'actions', name: '动作状态' },
  { id: 'entertainment', name: '文娱休闲' },
  { id: 'sportsAndGames', name: '运动游戏' },
  { id: 'travel', name: '出行旅行' },
  { id: 'nature', name: '自然世界' },
  { id: 'drinks', name: '饮品' },
  { id: 'desserts', name: '甜点零食' },
  { id: 'cooking', name: '烹饪厨房' },
  { id: 'clothing', name: '服饰穿搭' },
  { id: 'beauty', name: '美妆护理' },
  { id: 'home', name: '家居生活' },
  { id: 'pets', name: '宠物' },
  { id: 'animals', name: '动物' },
  { id: 'plants', name: '植物花草' },
  { id: 'weather', name: '天气气候' },
  { id: 'vehicles', name: '交通工具' },
  { id: 'shopping', name: '购物消费' },
  { id: 'technology', name: '数码科技' },
  { id: 'music', name: '音乐' },
  { id: 'filmAndTelevision', name: '影视' },
  { id: 'festivals', name: '节日习俗' },
  { id: 'occupations', name: '职业身份' },
  { id: 'health', name: '健康运动' },
  { id: 'hobbies', name: '兴趣爱好' },
  { id: 'outdoors', name: '户外活动' },
  { id: 'dating', name: '约会场景' },
  { id: 'romance', name: '恋爱互动' },
  { id: 'wedding', name: '婚礼现场' },
  { id: 'nightlife', name: '夜生活' },
  { id: 'partyGames', name: '聚会游戏' },
  { id: 'barCulture', name: '酒吧文化' },
  { id: 'actionComedy', name: '动作喜剧' },
  { id: 'mystery', name: '悬疑推理' },
  { id: 'awkwardMoments', name: '尴尬瞬间' },
  { id: 'adultLife', name: '成年生活' },
]);
export type UndercoverCategory = (typeof UNDERCOVER_WORD_CATEGORY_CATALOG.ids)[number];

/** Label of the `'all'` config choice; `'all'` selects every category and is not itself one. */
export const UNDERCOVER_ALL_CATEGORIES_LABEL = '全部分类';
