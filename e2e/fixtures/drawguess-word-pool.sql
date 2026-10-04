INSERT INTO drawguess_words (
  id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at
)
SELECT
  'e2e-dg-' || key,
  value ->> 'w',
  value ->> 'p',
  value ->> 'c',
  value ->> 'd',
  'active',
  '2026-10-04T00:00:00.000Z',
  NULL
FROM json_each('[
  {"w":"苹果","p":"pg","c":"食物","d":"easy"},
  {"w":"香蕉","p":"xj","c":"食物","d":"easy"},
  {"w":"猫","p":"m","c":"动物","d":"easy"},
  {"w":"狗","p":"g","c":"动物","d":"easy"},
  {"w":"太阳","p":"ty","c":"自然","d":"easy"},
  {"w":"月亮","p":"yl","c":"自然","d":"easy"},
  {"w":"汽车","p":"qc","c":"交通","d":"easy"},
  {"w":"飞机","p":"fj","c":"交通","d":"easy"},
  {"w":"雨伞","p":"ys","c":"日用品","d":"easy"},
  {"w":"眼镜","p":"yj","c":"日用品","d":"easy"},
  {"w":"大象","p":"dx","c":"动物","d":"medium"},
  {"w":"长颈鹿","p":"cjl","c":"动物","d":"medium"},
  {"w":"汉堡包","p":"hbb","c":"食物","d":"medium"},
  {"w":"自行车","p":"zxc","c":"交通","d":"medium"},
  {"w":"洗衣机","p":"xyj","c":"家电","d":"medium"},
  {"w":"圣诞树","p":"sds","c":"节日","d":"medium"},
  {"w":"变色龙","p":"bsl","c":"动物","d":"hard"},
  {"w":"埃菲尔铁塔","p":"afett","c":"建筑","d":"hard"},
  {"w":"潜水艇","p":"qst","c":"交通","d":"hard"},
  {"w":"显微镜","p":"xwj","c":"工具","d":"hard"}
]');
