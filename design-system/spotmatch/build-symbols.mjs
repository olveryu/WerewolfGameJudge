import { mkdirSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Original paths, composed explicitly per subject. No icon-font or asset dependencies.
const ink = '#29465a',
  red = '#df625e',
  gold = '#edbb45',
  green = '#53966a',
  blue = '#579fb9',
  purple = '#9b7bb9',
  pink = '#e28aa0',
  brown = '#ac7956',
  cream = '#f6dfb0',
  white = '#ffffff',
  pale = '#c9e6ed',
  orange = '#e79a50';
const p = (d, fill = 'none', stroke = ink) => `<path d="${d}" fill="${fill}" stroke="${stroke}"/>`;
const c = (x, y, radius, fill, stroke = ink) =>
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const e = (x, y, rx, ry, fill, stroke = ink) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}"/>`;
const r = (x, y, w, h, fill, radius = 3, stroke = ink) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const eyes = (x1, x2, y) => c(x1, y, 1.8, ink, 'none') + c(x2, y, 1.8, ink, 'none');
const entries = [];
let category;
const add = (id, name, art) => entries.push({ id, name, category, art });

category = '自然天气';
add(
  'sun',
  '太阳',
  p('M32 6v6m0 40v6M6 32h6m40 0h6M13 13l5 5m28 28 5 5M13 51l5-5m28-28 5-5', 'none', gold) +
    c(32, 32, 14, gold),
);
add('moon', '月亮', p('M43 7C15 2 4 24 11 42c8 21 36 23 45 1C31 51 20 24 43 7Z', purple));
add('star', '星星', p('m32 6 8 17 19 3-14 14 3 19-16-9-17 9 4-19L5 26l19-3Z', gold));
add('cloud', '云朵', p('M16 48C1 48 2 28 16 28c-1-20 27-25 34-7 14-2 17 27 0 27Z', pale));
add(
  'raindrop',
  '雨滴',
  p('M32 5C25 17 12 30 12 41a20 20 0 0 0 40 0C52 30 39 17 32 5Z', blue) +
    p('M22 38q-4 9 5 13', 'none', white),
);
add(
  'snowflake',
  '雪花',
  p(
    'M32 5v54M9 18l46 28M9 46l46-28M24 10l8 7 8-7M24 54l8-7 8 7M10 27l9-3-1-10M54 37l-9 3 1 10M10 37l9 3-1 10M54 27l-9-3 1-10',
    'none',
    blue,
  ),
);
add('lightning', '闪电', p('M37 5 12 35h17l-3 24 26-35H35Z', gold));
add(
  'rainbow',
  '彩虹',
  p('M7 51V34a25 25 0 0 1 50 0v17H47V34a15 15 0 0 0-30 0v17Z', red) +
    p('M17 51V34a15 15 0 0 1 30 0v17H37V34a5 5 0 0 0-10 0v17Z', gold) +
    p('M27 51V34a5 5 0 0 1 10 0v17Z', blue),
);
add(
  'tornado',
  '龙卷风',
  p('M5 10h54L49 23 40 36l-4 12-1 12h-6l-3-16-9-13-5-11Z', purple) +
    p('M14 20h35M21 31h20M28 42h9', 'none', cream),
);
add(
  'mountain',
  '雪山',
  p('M4 55 27 9l13 22 7-12 14 36Z', blue) + p('m17 29 10-20 12 21-10-5-5 8Z', white),
);
add(
  'volcano',
  '火山',
  p('m8 56 15-30h18l16 30Z', brown) +
    p('m23 26 5 12 5-7 6 12 2-17Z', orange) +
    p('m24 17-7-9m15 7V5m8 13 8-9', 'none', red),
);
add(
  'wave',
  '海浪',
  p('M5 51c18 4 14-30 32-35 15-4 23 9 18 18-3-9-15-8-16 0-1 11 13 14 20 12v10H5Z', blue) +
    p('M10 48q13 4 18-12', 'none', white),
);
add(
  'flame',
  '火焰',
  p('M32 5c5 18 21 19 21 35 0 26-42 26-42 0 0-9 7-15 13-21-2 13 5 13 8-14Z', red) +
    p('M32 32c3 9 10 11 10 18a10 10 0 0 1-20 0c0-7 8-11 10-18Z', gold),
);
add(
  'leaf',
  '树叶',
  p('M9 53C3 23 24 6 57 8c0 31-15 52-43 44Z', green) +
    p('m8 58 38-37M23 43l-1-15m10 5 15 1', 'none', cream),
);
add(
  'pine-tree',
  '松树',
  p('M27 45h10v15H27Z', brown) + p('m32 4 16 20h-8l15 18H43l15 12H6l15-12H9l15-18h-8Z', green),
);
add(
  'palm-tree',
  '椰子树',
  p('M26 59q10-19 8-35h7q2 21-3 35Z', brown) +
    p(
      'M36 25Q14 5 4 27q15-6 28 2Q9 25 10 44q10-12 25-13Q45 9 60 22q-15-2-22 8 19-4 22 14-12-10-25-13Z',
      green,
    ) +
    c(35, 29, 4, brown),
);
add(
  'cactus',
  '仙人掌',
  p(
    'M27 56V14a7 7 0 0 1 14 0v42M27 38H17q-9 0-9-9V18h8v10q0 3 4 3h7M41 43h8q9 0 9-9V22h-8v10q0 4-4 4h-5',
    green,
  ) +
    r(23, 54, 23, 7, brown) +
    p('M34 17v29', 'none', cream),
);
add(
  'flower',
  '小花',
  p('M32 35v25m0-10Q11 50 13 39q15-1 19 11', green) +
    e(32, 13, 9, 10, pink) +
    e(17, 24, 10, 9, pink) +
    e(23, 39, 9, 10, pink) +
    e(42, 39, 9, 10, pink) +
    e(47, 24, 10, 9, pink) +
    c(32, 26, 9, gold),
);
add(
  'mushroom',
  '蘑菇',
  p('m26 31-4 26q10 6 20 0l-4-26Z', cream) +
    p('M5 34C7 0 55 0 59 34Z', red) +
    c(22, 22, 4, white, 'none') +
    c(41, 17, 5, white, 'none') +
    c(48, 28, 3, white, 'none'),
);
add(
  'acorn',
  '橡果',
  p('M16 27h32q1 23-16 32-17-9-16-32Z', brown) +
    p('M12 29q0-20 20-20t20 20Z', cream) +
    p('M32 9q-1-6 5-6M21 15l21 12M14 23l24-10'),
);
add(
  'pinecone',
  '松果',
  p('M32 7C9 10 10 52 32 59 55 52 55 10 32 7Z', brown) +
    p('m20 19 12 8 12-8m-27 13 15 8 15-8M21 46l11 6 11-6M32 7v7', 'none', cream),
);
add(
  'shell',
  '贝壳',
  p('M25 56 6 32C-2 6 23 7 25 14c5-14 20-9 20 0 15-7 23 8 14 22L39 56Z', pink) +
    p('M32 53 18 22m14 31V19m0 34 15-31M24 56h17'),
);
add(
  'coral',
  '珊瑚',
  p('M27 59V39L13 28V12h8v12l7 5V6h9v29l8-8V14h9v17L38 46v13Z', red) +
    p('M13 20H6V10m46 13h7V8', 'none', red),
);
add(
  'crystal',
  '水晶',
  p('m23 55-9-31 13-19 16 14-4 36Z', purple) +
    p('m39 55 4-29 12-6 5 13-9 22Z', pale) +
    p('m23 55 4-29-13-2m13 2 16-7M27 5v21'),
);
add(
  'planet',
  '行星',
  c(32, 32, 20, orange) +
    p('M12 29C-9 48 1 60 34 43 65 28 70 11 52 15', 'none', purple) +
    p('m29 15 10 3M40 48l6-3', 'none', cream),
);

category = '水果餐点';
add(
  'apple',
  '苹果',
  p('M32 20C10 6 3 30 13 48q8 15 19 8 14 7 21-9 12-27-9-31-7-1-12 4Z', red) +
    p('M32 21V8', 'none', brown) +
    p('M33 14Q37 2 51 7q-4 12-18 7', green) +
    p('M17 29q-4 5-2 11', 'none', white),
);
add(
  'pear',
  '梨',
  p('M27 14h10c0 17 17 19 17 34 0 18-44 18-44 0 0-15 17-17 17-34Z', gold) +
    p('M32 14q-1-8 7-10', 'none', brown) +
    p('M18 45q-2 7 5 9', 'none', white),
);
add(
  'banana',
  '香蕉',
  p('M13 11c0 30 17 39 39 24l6 4C40 73-3 51 8 12Z', gold) +
    p('M13 11 9 6m43 29 3-6M15 27q7 25 33 17', 'none', brown),
);
add(
  'orange',
  '橙子',
  c(32, 37, 23, orange) +
    p('M32 14Q34 2 48 5q0 13-16 9', green) +
    p('M16 31q0-5 6-7', 'none', cream) +
    c(46, 45, 1.3, brown, 'none'),
);
add(
  'watermelon',
  '西瓜',
  p('M4 21h56a28 28 0 0 1-56 0Z', green) +
    p('M9 21h46a23 23 0 0 1-46 0Z', red) +
    p('m20 28 2 4m11-5v5m11-4-2 4m-12 9 1 3'),
);
add(
  'strawberry',
  '草莓',
  p('M12 24Q4 38 32 59 60 38 52 24q-20-10-40 0Z', red) +
    p('m32 9 5 10 15-4-8 12-12-5-12 5-8-12 15 4Z', green) +
    p('m20 33 1 3m11-4v3m12-2-1 3m-16 6 1 3m10-3-1 3'),
);
add(
  'cherries',
  '樱桃',
  p('M16 39 34 8q0 20 15 31', 'none', green) +
    p('M34 8q17-6 23 5-15 6-23-5', green) +
    c(17, 47, 12, red) +
    c(48, 47, 12, pink) +
    p('m12 43-1 3m32-3-1 3', 'none', white),
);
add(
  'grapes',
  '葡萄',
  p('M32 16V6m0 7Q44 1 54 11q-7 11-22 2', green) +
    c(23, 24, 10, purple) +
    c(42, 24, 10, purple) +
    c(15, 39, 10, purple) +
    c(33, 39, 10, purple) +
    c(50, 39, 9, purple) +
    c(25, 52, 9, purple) +
    c(41, 52, 9, purple),
);
add(
  'pineapple',
  '菠萝',
  p('m23 22-6-15 14 8 5-12 5 14 13-8-9 16', green) +
    e(33, 40, 19, 21, gold) +
    p('m19 29 26 24m-29-12 18 17m-3-36 19 18M45 29 21 52m28-12L32 58M33 23 16 40', 'none', brown),
);
add(
  'lemon',
  '柠檬',
  p('M7 26Q25-2 49 17l9 9-6 12Q34 66 13 48L5 40Z', gold) +
    p('M17 28q8-11 20-7', 'none', white) +
    p('m7 26 6 2m39 10 6 1', 'none', brown),
);
add(
  'carrot',
  '胡萝卜',
  p('M15 20q10-12 22 0T13 59Q2 61 15 20Z', orange) +
    p('m28 15-4-11m7 11 7-12m-5 15 15-7', 'none', green) +
    p('m14 30 8 3m-7 9 6 2', 'none', brown),
);
add(
  'corn',
  '玉米',
  e(32, 28, 13, 23, gold) +
    p('M17 28q16 3 15 32Q8 53 9 26Zm30 0Q31 31 32 60q24-7 23-34Z', green) +
    p('M28 10v27m8-27v27M22 18h20m-22 8h24', 'none', brown),
);
add(
  'eggplant',
  '茄子',
  p('M44 19C31 11 32 37 15 40-6 48 22 69 44 49 54 39 58 24 44 19Z', purple) +
    p('m44 19-9 4 4-10 10 1 6 10-11-2M46 15l2-9', green),
);
add(
  'broccoli',
  '西兰花',
  p('M25 33h14l2 13 9 9H15l11-12Z', green) +
    c(17, 25, 12, green) +
    c(31, 16, 13, green) +
    c(47, 26, 13, green) +
    c(31, 31, 13, green) +
    p('m32 52 1-16m0 7-13-6m13 8 13-9', 'none', cream),
);
add(
  'pumpkin',
  '南瓜',
  p('M29 15 31 6h8l-3 11', green) +
    e(18, 37, 12, 20, orange) +
    e(46, 37, 12, 20, orange) +
    e(32, 37, 15, 22, orange) +
    p('M32 18v38', 'none', brown),
);
add(
  'bread',
  '吐司',
  p('M14 30C-5 14 18 1 32 11 49 1 69 18 51 30v28H14Z', brown) +
    p('M19 29Q4 16 22 15q10 6 20 0 16 1 4 14v23H19Z', cream),
);
add(
  'croissant',
  '可颂',
  p('M5 43 9 23l14-10 19 1 13 12 4 18-12 7-10-9H25l-9 9Z', gold) +
    p('m9 23 15 5-1-15m19 1-3 14 16-2M24 28l1 14m14-14-2 14', 'none', brown),
);
add(
  'pizza',
  '披萨',
  p('m10 13 46 7-31 39Z', gold) +
    p('M10 13q20-6 46 7l-4 7q-22-12-40-7Z', brown) +
    c(23, 29, 5, red) +
    c(38, 33, 5, red) +
    c(26, 45, 4, red) +
    p('m34 22-2 3m-17 1 2 2', 'none', green),
);
add(
  'burger',
  '汉堡',
  p('M7 29q1-23 25-23t25 23Z', gold) +
    r(7, 39, 50, 12, brown, 5) +
    p('M6 32h52l-8 10-12-5-12 5-11-6-9 5Z', green) +
    p('m12 39 18 9 15-9', gold) +
    p('M7 51h50q-1 9-10 9H17Q8 60 7 51Z', gold) +
    p('m21 18 2-2m10-2 2 2m8 4 2-2', 'none', cream),
);
add(
  'ice-cream',
  '冰淇淋',
  p('m17 32 15 28 15-28Z', gold) +
    p('m23 35 17 12m-20-6 12 9m12-15-16 13', 'none', brown) +
    p('M13 32c-7-13 3-21 11-20C30-2 51 4 49 17c10 2 10 14 3 17q-7 8-13 0-8 9-15 0-7 8-11-2Z', pink),
);
add(
  'donut',
  '甜甜圈',
  c(32, 33, 26, brown) +
    p('M7 27c4-26 48-27 50 0q-2 10-10 3-7 12-15 3-8 12-14 1-9 7-11-7Z', pink) +
    c(32, 31, 9, cream) +
    p('m17 19 3 3m23-4-3 4M25 13l2 2m22 13-3-1', 'none', white),
);
add(
  'cake',
  '蛋糕',
  p('M32 8v9', 'none', gold) +
    p('M9 30 32 17l23 13v28H9Z', cream) +
    p('M9 30h46v10l-8 5-8-5-7 6-9-6-8 4-6-4Z', pink) +
    p('M9 51h46', 'none', brown) +
    c(32, 21, 5, red),
);
add(
  'candy',
  '糖果',
  p('m17 22-12-7 1 15-1 14 13-6m28-16 13-7-1 15 1 14-14-6', purple) +
    r(15, 18, 34, 27, pink, 10) +
    p('m24 19 15 25m-3-25 10 17', 'none', white),
);
add(
  'teapot',
  '茶壶',
  p('M45 23q18-10 15 7-1 10-13 11', 'none', brown) +
    p('M16 25H8L4 14l-2 1 6 28 12 8h23q9-9 7-26Z', orange) +
    p('M14 25q0-10 18-10t18 10Z', gold) +
    c(32, 13, 4, brown) +
    p('M18 55h29'),
);
add(
  'sushi',
  '寿司',
  r(10, 25, 44, 31, white, 9) +
    e(32, 26, 22, 12, green) +
    e(32, 26, 16, 8, white) +
    e(32, 26, 9, 5, red) +
    p('M10 28v21q19 15 44 0V28q-21 19-44 0Z', green),
);

category = '动物伙伴';
add(
  'cat',
  '猫咪',
  p('m11 30 1-22 18 11h6L53 8l1 22q10 29-22 29T11 30Z', orange) +
    p('m17 18 7 6m23-6-7 6', 'none', pink) +
    eyes(23, 42, 35) +
    p('m29 43 3 3 3-3M32 46v5m-16-8-10-2m10 8L6 51m42-8 10-2m-10 8 10 2'),
);
add(
  'dog',
  '小狗',
  p('M17 20Q7 7 4 25q-3 25 15 18m28-23Q57 7 60 25q3 25-15 18', brown) +
    p('M16 20q16-14 32 0v24q-2 17-16 17T16 44Z', cream) +
    e(32, 47, 10, 9, white) +
    eyes(23, 41, 33) +
    p('m28 44 4 5 4-5Z', ink) +
    p('M32 49v7'),
);
add(
  'rabbit',
  '兔子',
  e(23, 19, 7, 17, white) +
    e(41, 19, 7, 17, white) +
    p('M23 7v20m18-20v20', 'none', pink) +
    e(32, 44, 22, 17, white) +
    eyes(23, 41, 41) +
    p('m29 48 3 3 3-3', pink) +
    p('M28 53h8m-4-2v5'),
);
add(
  'fox',
  '狐狸',
  p('M8 7 27 20h10L56 7l-4 30-20 23L12 37Z', orange) +
    p('m12 33 20 9 20-9-20 27Z', white) +
    eyes(22, 42, 31) +
    p('m27 43 5 6 5-6Z', ink) +
    p('m14 15 9 10m27-10-9 10', 'none', brown),
);
add(
  'bear',
  '棕熊',
  c(14, 15, 10, brown) +
    c(50, 15, 10, brown) +
    e(32, 36, 26, 25, brown) +
    e(32, 45, 14, 12, cream) +
    eyes(22, 42, 30) +
    e(32, 41, 5, 3, ink) +
    p('M32 44v7m-6-1q6 6 12 0'),
);
add(
  'panda',
  '熊猫',
  c(14, 13, 9, ink) +
    c(50, 13, 9, ink) +
    e(32, 35, 27, 25, white) +
    e(20, 33, 8, 10, ink) +
    e(44, 33, 8, 10, ink) +
    eyes(20, 44, 32).replaceAll(ink, white) +
    p('m27 45 5 4 5-4Z', ink) +
    p('M32 49v5m-5-1q5 4 10 0'),
);
add(
  'lion',
  '狮子',
  p('m32 3 9 6 11 1 4 11 6 10-5 10-3 12-12 3-10 5-10-5-12-3-3-12-5-10 6-10 4-11 11-1Z', brown) +
    e(32, 32, 19, 21, gold) +
    eyes(24, 40, 28) +
    e(32, 39, 10, 8, cream) +
    p('m28 36 4 4 4-4Z', ink) +
    p('M32 40v6'),
);
add(
  'elephant',
  '大象',
  e(14, 32, 12, 20, blue) +
    e(50, 32, 12, 20, blue) +
    p('M17 22q15-18 30 0v23H38v9q0 12-12 7l-6-4 4-6q7 6 7-2V35H17Z', pale) +
    eyes(24, 42, 28) +
    p('m18 39 5 9 3-9m16 0 4 9 3-9', white),
);
add(
  'giraffe',
  '长颈鹿',
  p('M25 25V10m14 15V10', 'none', brown) +
    c(25, 8, 4, brown) +
    c(39, 8, 4, brown) +
    p('M21 25 7 19q-4 15 12 15m24-9 14-6q4 15-12 15', gold) +
    p('M22 24h20l5 22q0 13-15 13T17 46Z', gold) +
    e(32, 47, 15, 10, cream) +
    eyes(25, 39, 34) +
    c(26, 49, 1.5, brown) +
    c(38, 49, 1.5, brown) +
    p('m30 19 5 9-7 3m-7 9 5 4', 'none', brown),
);
add(
  'zebra',
  '斑马',
  p('m18 25-7-17 12 2 7 14m10 0 5-14 11-2-8 19', white) +
    p('M19 23q13-7 26 0l6 23q0 14-19 14T13 46Z', white) +
    p('m25 21 7 13 7-13m-22 9 9 5m21-5-9 5M15 42l10 3m24-3-10 3', 'none', ink) +
    e(32, 51, 17, 8, ink) +
    eyes(23, 41, 38),
);
add(
  'cow',
  '奶牛',
  p('M17 22 10 9q13-4 14 12m23 1 7-13q-13-4-14 12', cream) +
    p('M20 24 6 20q-4 15 13 15m25-11 14-4q4 15-13 15', white) +
    p('M19 22q13-8 26 0l4 24q0 15-17 15T15 46Z', white) +
    p('M21 22q10-2 9 12l-9 6-5-8Z', ink) +
    e(32, 50, 17, 10, pink) +
    eyes(23, 41, 35) +
    c(25, 51, 2, ink) +
    c(39, 51, 2, ink),
);
add(
  'pig',
  '小猪',
  p('m12 27-4-18 19 9m25 9 4-18-19 9', pink) +
    e(32, 36, 26, 24, pink) +
    eyes(22, 42, 31) +
    e(32, 45, 13, 10, red) +
    c(27, 45, 2, ink) +
    c(37, 45, 2, ink),
);
add(
  'sheep',
  '绵羊',
  p('M18 45v13m28-13v13', 'none', ink) +
    c(17, 21, 11, white) +
    c(32, 15, 12, white) +
    c(47, 22, 11, white) +
    c(49, 38, 11, white) +
    c(32, 43, 13, white) +
    c(15, 37, 11, white) +
    p('M22 29q10-7 20 0l-2 19q-8 9-16 0Z', purple) +
    eyes(27, 37, 34) +
    p('m29 43 3 3 3-3'),
);
add(
  'horse',
  '骏马',
  p('M23 7 37 10l10 14 8 15-10 9-13-6-4 16H11l9-26-6-10Z', brown) +
    p('M23 7 14 16l-7 22 11-6 7-18 12-4Z', ink) +
    p('m37 10 3-7 7 18', brown) +
    c(36, 26, 2, ink) +
    p('m46 38 6 1M22 14l4 8'),
);
add(
  'penguin',
  '企鹅',
  p('m16 32-12 14 12 1m32-15 12 14-12 1', ink) +
    e(32, 33, 20, 28, ink) +
    e(32, 39, 14, 19, white) +
    eyes(25, 39, 22).replaceAll(ink, white) +
    p('m27 28 5 7 5-7Z', orange) +
    p('m22 55-8 6h16v-6m12 0 8 6H34v-6', orange),
);
add(
  'owl',
  '猫头鹰',
  p('m11 6 18 11h7L53 6v34q0 20-21 20T11 40Z', brown) +
    e(22, 30, 12, 14, cream) +
    e(42, 30, 12, 14, cream) +
    c(22, 29, 5, ink) +
    c(42, 29, 5, ink) +
    p('m28 39 4 7 4-7Z', gold) +
    p('m21 50 4 4m7-4 4 4m7-4 4 4', 'none', cream),
);
add(
  'parrot',
  '鹦鹉',
  p('M27 41 16 60l16-6 10 5-4-21', blue) +
    p('M19 35V20q0-16 16-16t15 19L38 35v13H24Z', green) +
    p('M39 18q23-1 18 19L43 29Z', gold) +
    p('M22 28q-7 20 9 20l5-20', blue) +
    c(37, 16, 3, ink),
);
add(
  'fish',
  '小鱼',
  p('m47 30 14-13v30L47 36Q19 63 3 33q16-31 44-3Z', blue) +
    p('m25 14 10-8 5 15m-15 29 10 9 5-14', gold) +
    c(17, 29, 3, ink) +
    p('M34 22q-9 11 0 22', 'none', white),
);
add(
  'whale',
  '鲸鱼',
  p('M5 33q2-23 27-17 17 2 16 26 12-1 11-17l-10 3 3-15 11 8q1 38-30 38T5 33Z', blue) +
    p('M8 43q18 17 37 4', 'none', pale) +
    c(17, 30, 2.5, ink) +
    p('M27 12V3m-3 7-5-5m12 5 5-5', 'none', blue),
);
add(
  'octopus',
  '章鱼',
  p(
    'M12 32q-3-28 20-28t20 28v15q8 6 9-4v-5m-49-6v15q-8 6-9-4v-5m17-1v15q2 13 9 0V40m6 0v12q7 13 9 0V37',
    purple,
  ) +
    eyes(24, 40, 25) +
    p('M28 34q4 4 8 0'),
);
add(
  'turtle',
  '乌龟',
  e(32, 32, 21, 18, green) +
    e(56, 32, 6, 9, green) +
    p('m20 17-6-9-7 6 8 11m6 22-6 9-8-6 8-11m25-22 6-9 7 6-8 11m-5 22 6 9 7-6-8-11', green) +
    p('m32 18 11 8v12l-11 9-12-9V26Z', gold) +
    c(58, 29, 1.5, ink),
);
add(
  'frog',
  '青蛙',
  c(19, 18, 11, green) +
    c(45, 18, 11, green) +
    e(32, 37, 26, 21, green) +
    c(19, 18, 5, white) +
    c(45, 18, 5, white) +
    eyes(19, 45, 18) +
    p('M19 39q13 13 26 0') +
    p('M10 48 5 58h14m35-10 5 10H45', 'none', green),
);
add(
  'butterfly',
  '蝴蝶',
  p('M29 27C8-11-8 24 23 36-4 39 9 69 29 44m6-17C56-11 72 24 41 36c27 3 14 33-6 8', pink) +
    p('M32 22v31m0-31L24 9m8 13 8-13', 'none', ink) +
    c(17, 25, 5, gold) +
    c(47, 25, 5, gold),
);
add(
  'bee',
  '蜜蜂',
  e(24, 18, 10, 14, pale) +
    e(42, 18, 10, 14, pale) +
    e(32, 36, 19, 15, gold) +
    p('M25 23v26m13-26v26M13 34 4 39m49-5 7 4', 'none', ink) +
    c(45, 33, 2, ink) +
    p('m43 23 4-7m-11 6V13'),
);
add(
  'snail',
  '蜗牛',
  p('M9 49h32q7-3 7-16h10v13Q59 59 9 56Z', green) +
    p('m49 34-3-11m10 11 4-11', 'none', green) +
    c(46, 21, 2.5, ink) +
    c(60, 21, 2.5, ink) +
    c(26, 33, 21, orange) +
    p('M29 48C3 48 9 16 29 20c17 3 11 24-1 20-7-2-7-12 0-12'),
);

category = '日用物件';
add(
  'key',
  '钥匙',
  p('m29 34 24 24 7-8-8-8-5 5-5-5 5-5-9-9', gold) + c(21, 22, 16, gold) + c(20, 20, 6, white),
);
add(
  'umbrella',
  '雨伞',
  p('M32 7v42q0 16-13 8l-1-5') +
    p('M4 33Q7 1 32 9q25-8 28 24-9-7-18 0-10-7-20 0-9-7-18 0Z', purple) +
    p('M32 10Q19 20 22 33m10-23q13 10 10 23', 'none', white),
);
add(
  'balloon',
  '气球',
  p('M32 44q-12 8 0 13l-2 5') +
    e(32, 25, 20, 23, red) +
    p('m32 46-5 7h10Z', red) +
    p('M21 15q-5 5-4 11', 'none', white),
);
add(
  'gift',
  '礼物',
  r(9, 27, 46, 33, blue) +
    r(5, 20, 54, 12, blue) +
    p('M27 21v39h10V21Z', gold) +
    p('M32 21Q7 22 14 9q9-12 18 12Q58 22 50 9q-9-12-18 12Z', gold),
);
add(
  'clock',
  '闹钟',
  c(32, 34, 23, cream) +
    p('m18 8-6-4-7 9 7 5M46 8l6-4 7 9-7 5M18 53l-5 8m33-8 5 8M32 17v18l12 6') +
    c(32, 34, 2, ink),
);
add(
  'camera',
  '相机',
  p('M5 21h14l4-9h19l4 9h13v34H5Z', blue) +
    c(32, 37, 14, ink) +
    c(32, 37, 9, pale) +
    r(9, 25, 9, 6, gold, 1) +
    p('m29 32 6-1', 'none', white),
);
add(
  'glasses',
  '眼镜',
  r(5, 25, 22, 22, blue, 7) +
    r(37, 25, 22, 22, blue, 7) +
    p('M27 32q5-6 10 0M5 30 2 18m57 12 3-12') +
    r(9, 29, 14, 14, pale, 4) +
    r(41, 29, 14, 14, pale, 4),
);
add(
  'hat',
  '礼帽',
  p('M16 42 19 7h27l3 35', purple) + e(32, 47, 29, 11, purple) + p('m17 32 31 0-1 10H17Z', gold),
);
add(
  'crown',
  '王冠',
  p('m7 18 13 11L32 9l12 20 13-11-6 37H13Z', gold) +
    p('M13 46h38') +
    c(7, 16, 4, red) +
    c(32, 8, 4, red) +
    c(57, 16, 4, red) +
    p('m32 30 5 7-5 7-5-7Z', blue),
);
add(
  'ring',
  '戒指',
  c(32, 40, 18, gold) +
    c(32, 40, 11, white) +
    p('m20 14 7-9h10l7 9-12 14Z', pale) +
    p('M20 14h24m-17-9 5 23 5-23'),
);
add(
  'necklace',
  '项链',
  p('M8 8q-8 38 24 42Q64 46 56 8', 'none', gold) +
    p('m32 40 10 9-10 13-10-13Z', purple) +
    p('M7 23h7m36 0h8M12 36l7-3m26 0 7 3', 'none', gold),
);
add(
  'handbag',
  '手提包',
  p('M20 24V15a12 12 0 0 1 24 0v9', 'none', brown) +
    p('M10 23h44l5 34H5Z', pink) +
    p('M12 24q20 25 40 0') +
    r(28, 36, 8, 8, gold, 1),
);
add(
  'backpack',
  '双肩包',
  p('M24 13V6h16v7m-26 8H8v33h7m35-33h6v33h-7', 'none', brown) +
    r(14, 12, 36, 48, orange, 11) +
    r(20, 35, 24, 18, cream, 5) +
    p('M20 26h24m-4-2v6m-15 11h14'),
);
add(
  'shoe',
  '运动鞋',
  p('M6 22h13l6 12 12-10 9 14 13 6v12H5Z', blue) +
    p('M5 48h54v8H5Z', white) +
    p('m26 32 9 7m-4-12 8 7m-2-12 8 7'),
);
add(
  'boot',
  '雨靴',
  p('M15 7h27l-3 31 17 6q6 4 4 14H11l3-17Z', gold) + p('M14 16h27M11 51h49', 'none', brown),
);
add(
  'sock',
  '袜子',
  p('M25 5h24v30L31 55Q13 68 5 52q-5-9 8-17l12-9Z', pink) +
    p('M25 15h24m-5 25-9-9M8 39q14 0 15 19', 'none', white),
);
add(
  'mitten',
  '连指手套',
  p('M24 50 9 34q-6-11 5-12 5 0 10 11V13q0-16 16-8 16-2 16 15v20q0 13-12 14Z', purple) +
    r(23, 49, 25, 12, cream) +
    p('M34 57h6', 'none', purple),
);
add(
  'scarf',
  '围巾',
  p('M10 10h44v18H38v32H21V28H10Z', red) +
    p('M21 28h17M14 10v18m32-18v18M25 55v7m8-7v7', 'none', cream),
);
add(
  'mug',
  '马克杯',
  p('M46 22q22-4 15 13-4 8-15 6', white) +
    p('M7 17h42v29q0 13-21 13T7 46Z', blue) +
    p('M17 28v16', 'none', white) +
    p('M18 11q-5-5 0-9m13 9q-5-5 0-9', 'none', brown),
);
add(
  'bottle',
  '水壶',
  r(24, 4, 16, 10, blue) +
    p('M24 14v8L16 32v25h32V32l-8-10v-8Z', pale) +
    r(16, 35, 32, 15, blue) +
    p('m30 38-3 8h9', 'none', white),
);
add(
  'candle',
  '蜡烛',
  p('M31 3q-16 16 1 20Q48 18 31 3Z', gold) +
    r(20, 23, 24, 33, cream) +
    p('M20 24v13q6 7 8-3 3 12 8 4V26', white) +
    p('M12 59h40M32 23v-5'),
);
add(
  'lamp',
  '台灯',
  p('M31 31v25M18 59h28', 'none', brown) +
    p('m20 8-9 27h42L44 8Z', gold) +
    p('M47 36v9', 'none', brown) +
    c(47, 47, 2, brown),
);
add(
  'chair',
  '椅子',
  r(15, 5, 34, 28, brown, 6) +
    p('M16 28v13m32-13v13M17 47l-3 13m33-13 3 13') +
    r(10, 38, 44, 10, orange) +
    p('M24 12v13m16-13v13', 'none', cream),
);
add(
  'mirror',
  '手镜',
  p('m27 40-4 20h18l-4-20Z', purple) +
    e(32, 24, 22, 21, purple) +
    e(32, 24, 16, 15, pale) +
    p('m23 24 9-9m-4 18 13-13', 'none', white),
);
add(
  'comb',
  '梳子',
  p('M8 13h48v12H8Z', pink) +
    p('M9 25v29m8-29v29m8-29v29m8-29v29m8-29v29m8-29v29m7-29v29', 'none', purple),
);

category = '出行建筑';
add(
  'car',
  '小汽车',
  p('m6 31 8-18h32l9 18 5 5v16H4V36Z', red) +
    p('m18 18-5 13h36l-7-13Z', pale) +
    p('M31 18v13') +
    c(16, 51, 7, ink) +
    c(48, 51, 7, ink) +
    r(8, 37, 8, 5, gold, 1) +
    r(48, 37, 8, 5, gold, 1),
);
add(
  'bus',
  '巴士',
  r(10, 4, 44, 52, gold, 7) +
    r(15, 13, 34, 21, pale) +
    p('M32 13v21M15 42h7m20 0h7M18 5h28') +
    r(14, 53, 9, 8, ink) +
    r(41, 53, 9, 8, ink),
);
add(
  'bicycle',
  '自行车',
  c(15, 45, 12, blue) +
    c(49, 45, 12, blue) +
    p('m15 45 12-24 13 24H15l11-19 23 19-9-33h9M21 20h13', 'none', ink),
);
add(
  'scooter',
  '滑板车',
  c(12, 54, 7, blue) +
    c(51, 54, 7, blue) +
    p('M12 47h28l9-35h-9M49 12h8', 'none', orange) +
    p('m40 47 11 7'),
);
add(
  'train',
  '火车',
  r(13, 5, 38, 47, blue, 8) +
    r(18, 13, 28, 18, pale) +
    p('M32 13v18M20 52l-8 9m32-9 8 9M15 57h34') +
    c(22, 42, 4, gold) +
    c(42, 42, 4, gold) +
    p('M25 8h14'),
);
add(
  'airplane',
  '飞机',
  p('M28 22V8q4-11 8 0v14l24 17v8l-24-9v13l7 6v5l-11-3-11 3v-5l7-6V38L4 47v-8Z', pale) +
    p('M32 10v17', 'none', blue),
);
add(
  'helicopter',
  '直升机',
  p('M8 5h45M31 5v12M14 52h38m-28-9-3 9m22-9 4 9') +
    p('M18 20h20q20 2 21 20H23L9 29H3V16h9Z', orange) +
    p('M35 21v16h20q-6-15-20-16Z', pale),
);
add(
  'rocket',
  '火箭',
  p('m20 33-11 9v17l15-11m20-15 11 9v17L40 48', red) +
    p('M24 49Q8 25 32 3q24 22 8 46Z', white) +
    c(32, 25, 7, blue) +
    p('m26 50 6 12 6-12', gold) +
    p('m24 13 16 0', 'none', red),
);
add(
  'sailboat',
  '帆船',
  p('M32 5v42M6 48h52l-10 12H17Z', brown) +
    p('M27 10 5 41h22Z', cream) +
    p('m36 17 21 24H36Z', red) +
    p('M4 62h56', 'none', blue),
);
add(
  'submarine',
  '潜水艇',
  p('M25 21V10h13v6h-6v5', gold) +
    p('M48 28h10v-7h4v28h-4v-7H48', orange) +
    r(3, 22, 51, 31, gold, 15) +
    c(18, 37, 7, blue) +
    c(39, 37, 7, blue) +
    p('m17 34 3-1m18 1 3-1', 'none', white),
);
add(
  'anchor',
  '船锚',
  c(32, 11, 7, blue) +
    p(
      'M32 18v40M19 27h26M7 36q0 21 25 22 25-1 25-22M7 36l-4 10m4-10 10 6m40-6 4 10m-4-10-10 6',
      'none',
      blue,
    ),
);
add(
  'compass',
  '指南针',
  c(32, 34, 26, cream) +
    c(32, 5, 3, brown) +
    p('m40 15-3 24-13 13 3-24Z', red) +
    p('m27 28 10 11-13 13Z', blue) +
    c(32, 34, 3, white) +
    p('M32 12v4m0 36v4M10 34h4m36 0h4'),
);
add(
  'map',
  '地图',
  p('m4 14 18-8 20 8 18-8v44l-18 8-20-8-18 8Z', cream) +
    p('M22 6v44m20-36v44', 'none', brown) +
    p('m8 39 9-12 11 8 10-13 14 7', 'none', blue) +
    c(49, 38, 6, red) +
    p('m45 42 4 7 4-7', red),
);
add(
  'suitcase',
  '行李箱',
  p('M23 15V5h18v10') +
    r(10, 15, 44, 42, orange, 5) +
    p('M20 16v40m24-40v40M14 57v4m36-4v4') +
    r(25, 28, 14, 9, cream, 1),
);
add(
  'tent',
  '帐篷',
  p('M5 55 31 8l28 47Z', orange) +
    p('m31 8 5 47H5Z', gold) +
    p('m31 29 5 26H18Z', ink) +
    p('M3 59h58m-51-4-5 4m49-4 6 4', 'none', brown),
);
add(
  'house',
  '房屋',
  p('M11 28v31h42V28', cream) +
    p('M4 29 32 5l28 24Z', red) +
    r(26, 39, 12, 20, brown, 1) +
    r(15, 32, 8, 9, blue, 1) +
    r(42, 32, 8, 9, blue, 1) +
    p('M47 16V7h8v16', red),
);
add(
  'castle',
  '城堡',
  p('M8 59V22H4V7h8v7h7V7h8v15h-4v12h18V22h-4V7h8v7h7V7h8v15h-4v37Z', purple) +
    p('M25 59V47q7-15 14 0v12Z', cream) +
    p('M15 29v8m34-8v8M30 7v24m0-24 14 7-14 7', gold),
);
add(
  'lighthouse',
  '灯塔',
  p('m20 58 5-35h14l6 35Z', white) +
    p('m24 31 16 0 2 10H22Zm-3 20h23l2 7H20Z', red) +
    r(22, 13, 20, 11, gold, 1) +
    p('m19 13 13-9 13 9Z', red) +
    p('M8 60h48M17 18H3m44 0h14'),
);
add(
  'bridge',
  '大桥',
  p('M5 49h54v8H5Z', brown) +
    p('M13 51V9m38 42V9M13 15Q32 61 51 15M5 23l8-8m38 0 8 8', 'none', blue) +
    p('M22 30v19m10-11v11m10-19v19', 'none', blue),
);
add(
  'ferris-wheel',
  '摩天轮',
  c(32, 27, 22, blue) +
    p('m23 59 9-32 9 32M16 59h32M10 27h44M32 5v44M16 11l32 32m-32 0 32-32') +
    c(32, 27, 4, gold) +
    r(25, 3, 14, 9, red) +
    r(3, 25, 13, 11, gold) +
    r(48, 25, 13, 11, gold) +
    r(26, 46, 12, 10, red),
);
add(
  'hot-air-balloon',
  '热气球',
  p('M32 4C1 4 2 29 22 43h20C62 29 63 4 32 4Z', orange) +
    p('M32 4Q13 17 27 43h10Q51 17 32 4Z', gold) +
    p('m22 43 4 10m16-10-4 10') +
    r(24, 52, 16, 10, brown, 2),
);
add(
  'traffic-light',
  '红绿灯',
  p('M32 48v13M22 61h20') +
    r(18, 3, 28, 48, ink, 6) +
    c(32, 13, 6, red) +
    c(32, 27, 6, gold) +
    c(32, 41, 6, green),
);
add(
  'signpost',
  '路牌',
  p('M30 7h5v54h-5Z', brown) +
    p('M9 11h38l12 9-12 9H9Z', blue) +
    p('M55 34H18L5 43l13 9h37Z', gold) +
    p('M41 20h8m-31 23h8', 'none', white),
);
add(
  'windmill',
  '风车',
  p('m23 33-7 27h32l-7-27Z', cream) +
    p('M30 26 10 5 3 13l21 20-20 19 8 8 20-21 20 20 8-8-21-19L59 12l-8-8Z', blue) +
    c(32, 32, 6, gold) +
    p('M28 60V47h8v13', brown),
);
add(
  'globe',
  '地球仪',
  p('M45 5q25 29-8 45M32 49v10M19 61h27', 'none', brown) +
    c(29, 27, 23, blue) +
    p('m15 9 8 6-3 10-12 3 4 11 11 2 6-10 8 2 4-10 9-3-5-9-14-6Z', green) +
    p('m30 43 6-2 2 7-6 2Z', green),
);

category = '运动音乐';
add(
  'football',
  '足球',
  c(32, 32, 27, white) +
    p('m32 20 12 9-5 14H25l-5-14Z', ink) +
    p('m32 20V5m12 24 13-5M39 43l8 13M25 43l-8 13m3-27L7 24') +
    p('m18 9 14 4 14-4M7 26l8 12-2 13m38 0-2-13 8-12M23 57l9-9 9 9'),
);
add(
  'basketball',
  '篮球',
  c(32, 32, 27, orange) + p('M5 32h54M32 5v54M13 12q38 21 0 40m38-40Q13 33 51 52'),
);
add(
  'tennis',
  '网球拍',
  p('m28 39-17 22-6-5 17-22', brown) +
    e(39, 23, 18, 21, green) +
    p('M27 10v25m8-31v39m8-39v39m8-33v25M23 16h31M21 24h36m-33 8h30', 'none', cream) +
    c(49, 51, 10, gold) +
    p('M43 44q10 3 10 14', 'none', white),
);
add(
  'badminton',
  '羽毛球',
  p('m22 42-16-29 12 4 3-12 11 11L43 5l3 12 12-4-16 29Z', white) +
    p('m18 17 10 25m4-26v26m14-25L36 42', 'none', blue) +
    p('M22 42h20v7a10 10 0 0 1-20 0Z', red),
);
add(
  'baseball',
  '棒球',
  c(32, 32, 26, cream) +
    p('M14 13q27 19 0 38m36-38Q23 32 50 51', 'none', red) +
    p('m20 17-5 4m9 3-6 4m7 4-6 1m5 7-6-2m24-21 5 4m-9 3 6 4m-7 4 6 1m-5 7 6-2', 'none', red),
);
add(
  'rugby',
  '橄榄球',
  p('M9 8q51-5 47 47Q4 61 9 8Z', brown) +
    p('m20 44 24-24m-19 5 14 14m-8-20 14 14m-26-2 14 14', 'none', cream) +
    p('M10 23 23 10m18 44 13-13', 'none', white),
);
add(
  'bowling',
  '保龄球',
  p('M19 5h9v16q-1 7 7 18 12 22-11 22T12 39q9-11 7-18Z', cream) +
    p('M18 21h11m-12 6h13', 'none', red) +
    c(46, 45, 16, blue) +
    c(43, 39, 2, ink) +
    c(49, 41, 2, ink) +
    c(44, 46, 2, ink),
);
add(
  'golf',
  '高尔夫',
  p('M33 53V5m0 0 20 9-20 9', red) +
    e(31, 55, 26, 6, green) +
    c(14, 44, 7, white) +
    c(12, 42, 1, pale, 'none') +
    c(17, 45, 1, pale, 'none') +
    c(11, 47, 1, pale, 'none'),
);
add(
  'skateboard',
  '滑板',
  p('M5 32q0 13 12 13h30q12 0 12-13', 'none', brown) +
    r(7, 25, 50, 12, blue, 6) +
    c(18, 49, 6, gold) +
    c(46, 49, 6, gold) +
    p('M18 37v6m28-6v6'),
);
add(
  'roller-skate',
  '轮滑鞋',
  p('M14 7h24v22l18 11v9H8V31Z', purple) +
    p('M8 43h48v7H8Z', cream) +
    p('M23 20h14m-14 8h15m-4 7h12') +
    c(18, 56, 6, gold) +
    c(46, 56, 6, gold),
);
add(
  'dumbbell',
  '哑铃',
  r(19, 26, 26, 12, blue) +
    r(9, 14, 12, 36, purple) +
    r(43, 14, 12, 36, purple) +
    r(3, 21, 7, 22, purple) +
    r(54, 21, 7, 22, purple),
);
add(
  'boxing-glove',
  '拳击手套',
  p('M18 43Q5 40 6 28q0-12 10-8V13q0-11 15-8 24-5 24 18v12q-1 13-13 17Z', red) +
    r(17, 47, 28, 14, cream) +
    p('M18 22v13q11 0 11 10M23 53h15', 'none', brown),
);
add(
  'trophy',
  '奖杯',
  p('M18 12H5q-1 22 18 23m23-23h13q1 22-18 23', gold) +
    p('M17 5h30v17q0 17-15 17T17 22Z', gold) +
    p('M32 39v14M19 59h26l-3-7H22Z', brown) +
    p('m32 13 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z', cream),
);
add(
  'medal',
  '奖牌',
  p('m10 5 12 28h20L54 5H38l-6 18-7-18Z', blue) +
    c(32, 43, 18, gold) +
    p('m32 30 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z', orange),
);
add(
  'whistle',
  '哨子',
  p('M17 27Q2 33 6 46q7 22 28 6l12-16h14V21H28Z', gold) +
    c(20, 41, 8, ink) +
    r(39, 22, 8, 6, white, 0) +
    p('M19 27V12q14-14 21-4', 'none', blue),
);
add(
  'guitar',
  '吉他',
  p('m36 29 17-23 7 5-20 23q9 13-5 24-13 9-25-3-12-13 0-24 9-9 17-1Z', brown) +
    c(27, 41, 7, ink) +
    p('m22 45 30-34m-35 33 9 8', 'none', cream) +
    p('m49 5 11 8', 'none', brown),
);
add(
  'violin',
  '小提琴',
  p(
    'm29 23 15-18 6 5-15 18q11 8 2 15-7-3-7 5 0 12-14 13Q1 57 5 45q2-9 11-9 7 0 1-8 4-9 12-5Z',
    orange,
  ) +
    p('m15 49 30-40m-30 3 44 44', 'none', brown) +
    p('m16 42 8 8m-9-16-3 5m18 6-3 5'),
);
add(
  'trumpet',
  '小号',
  p('M8 29h32L59 14v39L40 40H8Z', gold) +
    p('M19 40v10h21V29m-13-1V17m9 11V17M23 16h8m1 0h8M3 26v17', 'none', brown) +
    p('M52 22v23', 'none', cream),
);
add(
  'drum',
  '鼓',
  e(32, 47, 25, 12, red) +
    r(7, 24, 50, 24, red, 0) +
    e(32, 24, 25, 12, cream) +
    p('m7 25 12 25 13-25 13 25 12-25', 'none', gold) +
    p('m13 4 33 19M51 4 23 20', 'none', brown) +
    c(12, 4, 3, brown) +
    c(52, 4, 3, brown),
);
add(
  'piano',
  '钢琴',
  p('M7 9h50v44H7Z', ink) +
    r(10, 30, 44, 20, white, 0) +
    p('M19 31v19m9-19v19m9-19v19m9-19v19M12 53v8m40-8v8') +
    r(16, 30, 6, 11, ink, 0) +
    r(25, 30, 6, 11, ink, 0) +
    r(43, 30, 6, 11, ink, 0),
);
add(
  'microphone',
  '麦克风',
  p('m28 33-18 22 5 6 21-20Z', purple) +
    c(42, 22, 18, blue) +
    p('m29 11 25 22m-29-12 19 18m-6-34 20 18', 'none', pale) +
    p('m12 58-5 4'),
);
add(
  'headphones',
  '耳机',
  p('M8 40V29a24 24 0 0 1 48 0v11', 'none', ink) +
    p('M15 35v-8a17 17 0 0 1 34 0v8', 'none', blue) +
    r(4, 31, 14, 25, purple, 6) +
    r(46, 31, 14, 25, purple, 6),
);
add(
  'music-note',
  '音符',
  p('M24 46V15L54 7v34', 'none', purple) +
    p('M24 15v10l30-8V7Z', purple) +
    e(16, 49, 11, 8, purple) +
    e(46, 44, 11, 8, purple),
);
add(
  'maracas',
  '沙锤',
  p('m19 32 12 26 6-3-13-26m16 4L29 58l6 3 12-25', brown) +
    e(17, 21, 12, 18, red) +
    e(47, 22, 12, 18, gold) +
    p('M5 20h24m-21 8h18M36 17h22m-23 8h24', 'none', cream),
);
add(
  'kite',
  '风筝',
  p('M32 4 54 25 32 47 10 25Z', gold) +
    p('M32 4v43L10 25Z', red) +
    p('M10 25h44M32 47q17 7 0 14') +
    p('m34 52 9-3-1 9Z', blue),
);

category = '工具园艺';
add(
  'hammer',
  '锤子',
  p('m24 26 9-8 26 33-9 9Z', brown) +
    p('M4 19 22 4l16 5 7 12-10 9-8-7-10 9Z', blue) +
    p('m13 12 10 11', 'none', pale),
);
add(
  'wrench',
  '扳手',
  p('M41 5 32 18l10 9 14-9q5 18-14 21L21 59Q7 67 5 53l24-24Q19 9 41 5Z', blue) +
    c(14, 53, 3, white),
);
add(
  'screwdriver',
  '螺丝刀',
  p('m37 22 15-17 7 6-16 17-9 12-6-6Z', pale) +
    p('M28 29q4-3 10 3t3 10L23 60q-7 6-15-2T7 44Z', red) +
    p('m14 47 14-14m-7 21 14-14', 'none', cream),
);
add(
  'saw',
  '锯子',
  p('m6 44 31-31 16 15-5 5-4-1-1 6-6-1-1 6-6-1-1 6-6-1-1 6-6-1-3 6Z', pale) +
    p('M38 10q5-7 11 0l11 11q5 6-2 12l-4 3-20-20Z', brown) +
    p('m43 15 11 11-2 3-12-11Z', cream),
);
add(
  'pliers',
  '钳子',
  p('M15 5 27 19l10-1L49 5l3 13-13 15H25L12 18Z', blue) +
    p('m25 30-13 26q-1 7 6 5l15-24 13 24q7 2 6-5L39 30Z', red) +
    c(32, 29, 5, pale),
);
add(
  'scissors',
  '剪刀',
  e(15, 48, 10, 12, red) +
    e(48, 48, 10, 12, red) +
    p('m23 39 28-34 4 5-17 24 11 4m-9 1L12 5l-3 5 17 24-11 5', pale) +
    c(32, 31, 3, ink),
);
add(
  'ruler',
  '直尺',
  p('m5 43 40-38 15 16-40 38Z', gold) +
    p('m39 12 6 6m-13 0 4 5m-11 2 7 7m-14-1 5 5m-12 2 7 7m-14-1 5 5', 'none', brown),
);
add(
  'pencil',
  '铅笔',
  p('m10 43 30-35 15 13-30 34-20 5Z', gold) +
    p('m40 8 4-5q3-3 7 1l8 7q4 4 0 7l-4 3Z', pink) +
    p('m10 43 15 12-20 5Z', cream) +
    p('M5 60l4-13 7 6Z', ink) +
    p('m18 44 29-31', 'none', brown),
);
add(
  'paintbrush',
  '画笔',
  p('m26 35 25-32 9 8-29 30Z', brown) +
    p('m26 32 8 7-6 7-9-8Z', pale) +
    p('M21 39q19 10 1 19Q11 63 3 55q12-1 10-8-1-7 8-8Z', blue),
);
add(
  'palette',
  '调色盘',
  p('M32 5C-3 5-5 54 24 59c23 5 4-20 20-21 25 4 18-33-12-33Z', cream) +
    c(19, 19, 6, red) +
    c(37, 14, 5, blue) +
    c(50, 25, 5, green) +
    c(12, 37, 5, purple) +
    c(25, 46, 5, gold) +
    e(35, 29, 5, 6, white),
);
add(
  'bucket',
  '水桶',
  p('M13 25V17q19-25 38 0v8', 'none', brown) +
    p('m9 23 7 36h32l7-36Z', blue) +
    e(32, 23, 23, 7, pale) +
    p('M19 34v13', 'none', white),
);
add(
  'watering-can',
  '洒水壶',
  p('M40 23q20-18 20 4 0 14-15 13', 'none', green) +
    p('M12 25h30l6 30H14L3 32l7-4 7 13Z', green) +
    p('M23 25V15h12v10', gold) +
    p('m3 32-1-9 9-4 4 8Z', gold) +
    p('m3 12 1-4m6 3 2-4', 'none', blue),
);
add(
  'shovel',
  '铲子',
  p('M24 4h16v12l-8 8-8-8Z', green) +
    p('M32 22v23', 'none', brown) +
    p('M17 39h30v10q-2 10-15 14-13-4-15-14Z', blue) +
    p('M32 41v14', 'none', pale),
);
add(
  'rake',
  '耙子',
  p('M32 26v35', 'none', brown) + p('M7 6v20h50V6M17 6v20M27 6v20M37 6v20M47 6v20', 'none', blue),
);
add(
  'axe',
  '斧头',
  p('m33 7 9 4-20 50-10-4Z', brown) +
    p('M25 12 40 17l-3 15-20-4L4 14q13 4 21-2Z', blue) +
    p('M4 14 17 28l4-7Z', pale),
);
add(
  'wheelbarrow',
  '独轮车',
  p('m11 18 42 3-9 22H22Z', green) +
    p('m13 23-5-8H2m22 28-7 13m26-13 5 15H32') +
    c(18, 53, 8, brown) +
    p('m20 21 5 13', 'none', cream),
);
add(
  'ladder',
  '梯子',
  p('M14 4h7v56h-7Zm29 0h7v56h-7Z', brown) +
    p('M21 14h22m-22 12h22m-22 12h22m-22 12h22', 'none', orange),
);
add(
  'gear',
  '齿轮',
  p(
    'm26 4 12 0 2 9 7 3 8-4 6 10-7 6v8l7 6-6 10-8-4-7 3-2 9H26l-2-9-7-3-8 4-6-10 7-6v-8l-7-6 6-10 8 4 7-3Z',
    blue,
  ) +
    c(32, 32, 12, pale) +
    c(32, 32, 6, white),
);
add(
  'magnet',
  '磁铁',
  p('M7 9h15v25q0 17 20 0V9h15v25C57 69 7 69 7 34Z', red) + p('M7 9h15v13H7Zm35 0h15v13H42Z', pale),
);
add(
  'nut',
  '螺母',
  p('m19 6 26 0 15 26-15 26H19L4 32Z', blue) +
    c(32, 32, 14, pale) +
    c(32, 32, 9, white) +
    p('m19 6 7 13m19-13-7 13M4 32h14m28 0h14M19 58l7-13m19 13-7-13', 'none', pale),
);
add(
  'padlock',
  '挂锁',
  p('M18 29V17a14 14 0 0 1 28 0v12h-7V17a7 7 0 0 0-14 0v12Z', blue) +
    r(10, 27, 44, 33, gold, 6) +
    c(32, 40, 5, ink) +
    p('m30 43-2 8h8l-2-8Z', ink),
);
add(
  'flashlight',
  '手电筒',
  p('m16 31 16-14 13 14-15 16Z', blue) +
    p('m30 47-12 13-13-14 11-15Z', blue) +
    p('m32 17 3-12 24 26-14 0Z', gold) +
    p('m21 33 4 4') +
    p('m46 4 2 5m10 4 4-1m-6 11 6 1', 'none', gold),
);
add(
  'plug',
  '电源插头',
  p('M21 4v17m22-17v17', 'none', ink) +
    p('M13 19h38v15q0 14-19 14T13 34Z', blue) +
    p('M32 48v7q0 9-16 6') +
    p('M22 30h20', 'none', pale),
);
add(
  'battery',
  '电池',
  r(5, 16, 50, 33, green, 5) +
    r(55, 25, 6, 15, ink, 1) +
    p('M14 32h12m-6-6v12m20-6h9', 'none', white),
);
add(
  'thermometer',
  '温度计',
  p('M23 39V13a9 9 0 0 1 18 0v26q7 5 7 11 0 12-16 12T16 50q0-6 7-11Z', white) +
    c(32, 49, 9, red) +
    p('M32 18v31', 'none', red) +
    p('M45 14h9m-9 10h6m-6 10h9', 'none', blue),
);

category = '趣玩科学';
add(
  'book',
  '书本',
  p('M32 16Q17 5 4 12v41q14-6 28 3 14-9 28-3V12q-13-7-28 4Z', blue) +
    p('M32 16Q18 7 9 12v34q13-3 23 5 10-8 23-5V12q-9-5-23 4Z', cream) +
    p('M32 16v35M15 21l10 3m-10 7 10 3m14-10 10-3m-10 13 10-3', 'none', brown),
);
add(
  'envelope',
  '信封',
  r(4, 13, 56, 39, cream, 3) +
    p('m4 15 28 23 28-23M4 52l19-20m37 20L41 32', 'none', brown) +
    p('m32 24 3-4q9-2 6 7l-9 9-9-9q-3-9 6-7Z', red),
);
add(
  'scroll',
  '卷轴',
  p('M17 7h34v43q0 11-14 11H11V22H6V12q0-5 11-5Z', cream) +
    p(
      'M17 7q10 0 10 15H6m31 39q-11 0-11-12H5q-4 12 6 12M33 18h11m-20 13h20m-20 8h20',
      'none',
      brown,
    ),
);
add(
  'bookmark',
  '书签',
  p('M15 5h34v55L32 46 15 60Z', red) + p('m32 14 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z', gold),
);
add(
  'bell',
  '铃铛',
  c(32, 7, 4, gold) +
    p('M12 43V26q0-17 20-17t20 17v17l7 9H5Z', gold) +
    p('M24 53q0 12 16 0', brown) +
    p('M21 25q0-7 7-8', 'none', cream),
);
add(
  'dice',
  '骰子',
  r(8, 8, 48, 48, cream, 9) +
    c(20, 20, 4, ink) +
    c(44, 20, 4, ink) +
    c(32, 32, 4, ink) +
    c(20, 44, 4, ink) +
    c(44, 44, 4, ink),
);
add(
  'puzzle',
  '拼图块',
  p('M8 24h15q-6-16 8-16t8 16h17v14q-16-5-16 8t16 7v7H8V45q15 7 15-7T8 31Z', green),
);
add(
  'chess-knight',
  '国际象棋马',
  p('M14 52q-2-20 16-28l-9-1-8 9-8-8L28 5l17 8q18 17 7 39Z', purple) +
    p('m28 5 2-3 6 9M24 35q17-8 17-19') +
    c(29, 17, 2, white) +
    r(9, 52, 48, 9, purple),
);
add(
  'spinning-top',
  '陀螺',
  p('M28 5h8v13h-8Z', brown) +
    p('M8 27q24-23 48 0L32 58Z', red) +
    e(32, 27, 24, 10, gold) +
    p('M32 37v21M19 36l13 22 13-22', 'none', cream) +
    p('M32 58v4', 'none', brown),
);
add(
  'yoyo',
  '悠悠球',
  p('M32 26V9q0-9 13-5') +
    e(35, 41, 23, 20, blue) +
    e(27, 41, 20, 20, purple) +
    c(27, 41, 12, pink) +
    c(27, 41, 4, cream),
);
add(
  'robot',
  '机器人',
  p('M32 6v10M11 28H4v17h7m42-17h7v17h-7M21 53v8m22-8v8') +
    c(32, 5, 3, red) +
    r(11, 16, 42, 38, blue, 7) +
    r(17, 23, 30, 15, pale, 3) +
    eyes(24, 40, 30) +
    r(23, 43, 18, 6, cream, 1) +
    p('M28 43v6m8-6v6'),
);
add(
  'alien',
  '外星人',
  p('M32 4C-8 2 5 41 32 59 59 41 72 2 32 4Z', green) +
    p('M13 24q19 0 15 16-15-1-15-16Zm38 0q-19 0-15 16 15-1 15-16Z', ink) +
    p('M27 48h10'),
);
add(
  'ufo',
  '飞碟',
  p('M18 29q-1-25 14-25t14 25Z', pale) +
    e(32, 32, 29, 12, purple) +
    p('M8 39q24 20 48 0', blue) +
    c(14, 32, 3, gold) +
    c(32, 35, 3, gold) +
    c(50, 32, 3, gold) +
    p('m23 50-4 10m13-9v11m9-12 4 10', 'none', gold),
);
add(
  'telescope',
  '望远镜',
  p('m11 28 36-22 11 20-37 18Z', blue) +
    p('m42 9 7-4 12 21-8 4Z', gold) +
    p('m6 34 8-4 6 10-8 4Z', ink) +
    p('M32 39v9m0 0L17 61m15-13 16 13m-16-13v13', 'none', brown),
);
add(
  'microscope',
  '显微镜',
  p('M39 21q18 6 10 23-4 10-20 10M13 60h42M29 51v9', 'none', blue) +
    p('m19 6 12-4 13 28-14 6Z', purple) +
    p('m29 4 5-2 5 10-6 2Z', ink) +
    p('M15 43h26', 'none', ink) +
    c(41, 32, 5, gold),
);
add(
  'beaker',
  '烧瓶',
  p('M23 5h18M26 5v21L8 52q-6 9 7 9h34q13 0 7-9L38 26V5', pale) +
    p('M19 38h26l11 16q3 7-7 7H15q-10 0-7-7Z', green) +
    c(26, 47, 3, gold) +
    c(39, 53, 3, gold) +
    c(34, 32, 2, green),
);
add(
  'atom',
  '原子',
  `<g fill="none" stroke="${blue}"><ellipse cx="32" cy="32" rx="29" ry="11"/><ellipse cx="32" cy="32" rx="29" ry="11" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="29" ry="11" transform="rotate(120 32 32)"/></g>` +
    c(32, 32, 6, red) +
    c(10, 25, 4, gold) +
    c(45, 11, 4, gold) +
    c(43, 53, 4, gold),
);
add(
  'dna',
  '双螺旋',
  p('M14 4C60 17 4 47 50 60', 'none', blue) +
    p('M50 4C4 17 60 47 14 60', 'none', red) +
    p('M23 8h18M28 19h8M23 30h18M23 34h18M28 45h8M23 56h18', 'none', purple),
);
add(
  'hourglass',
  '沙漏',
  p('M13 7h38v8q0 9-15 17 15 8 15 17v8H13v-8q0-9 15-17-15-8-15-17Z', pale) +
    p('M15 17h34L32 32Zm17 20 15 18H17Z', gold) +
    p('M9 5h46M9 59h46', 'none', brown),
);
add(
  'feather',
  '羽毛',
  p('M13 50C-1 24 42-8 56 6 70 20 37 63 13 50Z', purple) +
    p('m5 60 43-45M15 49l-1-17m9 9 18 1m-10-9 1-17m6 10 14 0', 'none', cream),
);
add(
  'tooth',
  '牙齿',
  p(
    'M32 12C3-5 5 21 13 34c4 10 1 26 10 26 6 0 3-19 9-19s3 19 9 19c9 0 6-16 10-26C59 21 61-5 32 12Z',
    white,
  ) + p('M19 17q-7 0-4 10m10-15 10 5', 'none', blue),
);
add(
  'bandage',
  '创可贴',
  p('m7 39 32-32q10-8 18 1t-1 18L25 57Q15 65 7 56T7 39Z', cream) +
    p('m20 33 13-13 14 14-13 13Z', pink) +
    p('m15 40 2 2m4 4 2 2m-11-4 2 2m4 4 2 2m22-33 2 2m4 4 2 2m-11-4 2 2m4 4 2 2', 'none', brown),
);
add(
  'lifebuoy',
  '救生圈',
  c(32, 32, 28, white) +
    p(
      'M23 6q9-4 18 0l-4 14H27ZM58 23q4 9 0 18l-14-4V27ZM41 58q-9 4-18 0l4-14h10ZM6 41q-4-9 0-18l14 4v10Z',
      red,
    ) +
    c(32, 32, 14, pale),
);
add(
  'treasure-chest',
  '宝箱',
  p('M7 29V18Q7 5 20 5h24q13 0 13 13v11Z', brown) +
    r(7, 28, 50, 31, brown, 2) +
    p('M14 6h7v53h-7Zm29 0h7v53h-7Z', gold) +
    p('M7 28h50', 'none', ink) +
    r(27, 25, 10, 16, gold, 1) +
    c(32, 31, 2, ink),
);
add(
  'diamond',
  '钻石',
  p('m16 8 32 0 13 18-29 34L3 26Z', blue) +
    p('M3 26h58M16 8l7 18 9 34 9-34 7-18M23 26l9-18 9 18', 'none', pale),
);

if (
  entries.length !== 200 ||
  new Set(entries.map(({ id }) => id)).size !== 200 ||
  new Set(entries.map(({ name }) => name)).size !== 200
) {
  throw new Error('Exactly 200 unique subjects are required');
}
const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, 'symbols'), { recursive: true });
const catalog = entries.map(({ id, name, category, art }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="${id}-title"><title id="${id}-title">${name}</title><g transform="translate(1.6 1.6) scale(.95)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${art}</g></svg>`;
  writeFileSync(join(root, 'symbols', `${id}.svg`), svg + '\n');
  return { id, name, category, file: `symbols/${id}.svg`, svg };
});
writeFileSync(
  join(root, 'catalog.json'),
  JSON.stringify(
    {
      title: '一眼成对 · 原创符号评审草稿',
      version: 1,
      viewBox: '0 0 64 64',
      count: catalog.length,
      categories: [...new Set(catalog.map(({ category }) => category))],
      symbols: catalog.map(({ id, name, category, file }) => ({ id, name, category, file })),
    },
    null,
    2,
  ) + '\n',
);

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#edf2f7">
<title>一眼成对 · 200 枚原创符号</title>
<style>
:root{color-scheme:light;--bg:#edf2f7;--surface:#fff;--ink:#1a3149;--muted:#526779;--blue:#285f86;--border:#c4d2de;--hover:#e0e9f1;--size:48px;font:14px/1.5 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);accent-color:var(--blue)}
*{box-sizing:border-box}body{margin:0}button,input,select{font:inherit;color:inherit}button,select{cursor:pointer}button,a,input,select{-webkit-tap-highlight-color:transparent}button,input,select,.download{min-height:44px;border:1px solid var(--border);border-radius:8px;background:var(--surface)}button{padding:8px 14px}button:hover,.tile:hover{background:var(--hover)}:focus-visible{outline:3px solid var(--blue);outline-offset:3px}input{caret-color:var(--blue)}::selection{background:#c7dfef;color:var(--ink)}*{scrollbar-color:#8fa7b9 var(--bg)}a{color:var(--blue);text-underline-offset:3px}
.wrap{max-width:1280px;margin:auto;padding:32px 24px}header{display:flex;justify-content:space-between;align-items:start;gap:24px;margin-bottom:24px}h1{font-size:26px;line-height:1.35;letter-spacing:-.025em;margin:0 0 8px}header p{margin:0;color:var(--muted);max-width:68ch}.draft{font-size:13px;border:1px solid var(--border);border-radius:6px;padding:4px 10px;white-space:nowrap;background:var(--surface)}
.controls{display:flex;flex-wrap:wrap;gap:16px;align-items:end;padding:20px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.field{display:grid;gap:6px}.field>span,legend{font-size:13px;font-weight:600}.search{flex:1;min-width:220px}input[type=search]{width:100%;padding:10px 12px}select{padding:9px 34px 9px 12px;max-width:100%}fieldset{margin:0;padding:0;border:0}legend{padding:0 0 6px}.sizes{display:flex;gap:4px}.sizes button{min-width:46px;padding:8px}.sizes [aria-pressed=true]{background:var(--blue);border-color:var(--blue);color:white}.rotation{display:flex;align-items:center;gap:8px;min-height:44px}input[type=checkbox]{width:18px;height:18px;min-height:0;margin:0}.summary{display:flex;gap:12px;justify-content:space-between;align-items:baseline;margin:20px 0 12px;color:var(--muted);font-size:13px}.summary strong{color:var(--ink);font-variant-numeric:tabular-nums}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden}.tile{border:0;border-radius:0;padding:16px 8px 12px;background:var(--surface);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}.art{height:88px;display:grid;place-items:center;width:100%}.art svg{width:var(--size);height:var(--size);transform:rotate(var(--angle,0deg));flex:none}.name{font-weight:600}.id{font-size:11px;color:var(--muted);overflow-wrap:anywhere;line-height:1.4}.tile:focus-visible{outline-offset:-4px}.empty{text-align:center;padding:56px 16px}.empty p{color:var(--muted)}[hidden]{display:none!important}.detail{margin-top:24px;border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:24px;display:flex;gap:24px;align-items:center;scroll-margin:20px}.detail svg{width:160px;height:160px;flex:none}.detail h2{font-size:21px;margin:0 0 6px}.detail p{color:var(--muted);margin:0 0 16px}.download{display:inline-flex;align-items:center;padding:8px 14px;background:var(--blue);color:white;text-decoration:none}.detail button{margin-left:auto;align-self:start}footer{margin-top:24px;color:var(--muted);font-size:12px}footer p{margin:4px 0}
@media(max-width:600px){.wrap{padding:20px 16px}header{gap:12px;flex-direction:column;margin-bottom:20px}h1{font-size:23px}.controls{gap:12px}.search{flex-basis:100%}.category{flex:1;min-width:150px}.grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}.tile{padding:12px 4px}.summary{align-items:start}.summary span:last-child{text-align:right;max-width:140px}.detail{flex-wrap:wrap;padding:16px;gap:16px}.detail svg{width:112px;height:112px}.detail button{margin-left:0}.detail-copy{flex:1;min-width:140px}}
</style>
</head>
<body>
<main class="wrap">
<header><div><h1>一眼成对 · 原创符号库</h1><p>200 个不同主题，8 个分类。检查小尺寸辨识度、轮廓差异与旋转后的表现；点击图案可查看大图并下载 SVG。</p></div><span class="draft">评审草稿 · 非定稿</span></header>
<section class="controls" aria-label="筛选与预览设置">
<label class="field search"><span>搜索符号</span><input id="search" type="search" placeholder="中文名称或英文 ID，如：苹果 / apple" autocomplete="off"></label>
<label class="field category"><span>分类</span><select id="category"><option value="">全部分类 · 200</option></select></label>
<fieldset><legend>图案尺寸（px）</legend><div class="sizes" aria-label="图案像素尺寸"><button type="button" data-size="32" aria-pressed="false">32</button><button type="button" data-size="48" aria-pressed="true">48</button><button type="button" data-size="72" aria-pressed="false">72</button></div></fieldset>
<label class="rotation"><input id="rotation" type="checkbox">旋转预览</label>
</section>
<div class="summary"><span id="count" role="status" aria-live="polite"></span><span>64 × 64 矢量画布</span></div>
<div id="grid" class="grid" aria-label="符号目录"></div>
<section id="empty" class="empty" hidden><h2>没有找到匹配符号</h2><p>试试更短的名称，或清除分类和搜索条件。</p><button id="reset" type="button">清除筛选</button></section>
<section id="detail" class="detail" aria-label="符号详情" tabindex="-1" hidden><div id="detail-art"></div><div class="detail-copy"><h2 id="detail-name"></h2><p id="detail-meta"></p><a id="download" class="download">下载 SVG</a></div><button id="close" type="button">收起详情</button></section>
<footer><p>原创手绘路径草稿：不是颜色变体合集，不使用外部图片、字体或网络请求。</p><p>当前用于视觉评审，尚未完成逐个主题的实机辨识测试。支持离线打开；独立文件位于 symbols/，元数据见 catalog.json。</p></footer>
<noscript><p>请启用 JavaScript 查看完整的 200 枚符号；也可直接打开 symbols/ 中的 SVG 文件。</p></noscript>
</main>
<script id="catalog-data" type="application/json">${JSON.stringify(catalog).replaceAll('<', '\\u003c')}</script>
<script>
const catalog=JSON.parse(document.getElementById('catalog-data').textContent);
const grid=document.getElementById('grid'),search=document.getElementById('search'),category=document.getElementById('category'),rotation=document.getElementById('rotation'),detail=document.getElementById('detail');
let selectedButton=null,downloadUrl=null;
for(const name of new Set(catalog.map(s=>s.category))){const option=document.createElement('option');option.value=name;option.textContent=name+' · '+catalog.filter(s=>s.category===name).length;category.append(option);}
function hideDetail(){detail.hidden=true;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}}
function showDetail(symbol,button){hideDetail();selectedButton=button;document.getElementById('detail-art').innerHTML=symbol.svg.replaceAll(symbol.id+'-title',symbol.id+'-detail-title');document.getElementById('detail-name').textContent=symbol.name;document.getElementById('detail-meta').textContent=symbol.id+' · '+symbol.category+' · SVG';downloadUrl=URL.createObjectURL(new Blob([symbol.svg],{type:'image/svg+xml;charset=utf-8'}));const link=document.getElementById('download');link.href=downloadUrl;link.download=symbol.id+'.svg';detail.hidden=false;detail.scrollIntoView({block:'nearest'});detail.focus({preventScroll:true});}
function render(){hideDetail();grid.replaceChildren();const query=search.value.trim().toLocaleLowerCase();const visible=catalog.filter(s=>(!category.value||s.category===category.value)&&(!query||(s.name+' '+s.id).toLocaleLowerCase().includes(query)));for(const symbol of visible){const button=document.createElement('button');button.type='button';button.className='tile';button.setAttribute('aria-label','查看'+symbol.name+' · '+symbol.id);const art=document.createElement('span');art.className='art';art.setAttribute('aria-hidden','true');art.innerHTML=symbol.svg;const angle=(catalog.indexOf(symbol)*47)%121-60;art.style.setProperty('--angle',rotation.checked?angle+'deg':'0deg');const name=document.createElement('span');name.className='name';name.textContent=symbol.name;const id=document.createElement('span');id.className='id';id.textContent=symbol.id;button.append(art,name,id);button.addEventListener('click',()=>showDetail(symbol,button));grid.append(button);}document.getElementById('count').innerHTML='显示 <strong>'+visible.length+'</strong> / 200 枚符号';grid.hidden=visible.length===0;document.getElementById('empty').hidden=visible.length!==0;}
search.addEventListener('input',render);category.addEventListener('change',render);rotation.addEventListener('change',render);
for(const button of document.querySelectorAll('[data-size]'))button.addEventListener('click',()=>{document.documentElement.style.setProperty('--size',button.dataset.size+'px');for(const other of document.querySelectorAll('[data-size]'))other.setAttribute('aria-pressed',String(other===button));});
document.getElementById('reset').addEventListener('click',()=>{search.value='';category.value='';render();search.focus();});
document.getElementById('close').addEventListener('click',()=>{hideDetail();if(selectedButton?.isConnected)selectedButton.focus();});
detail.addEventListener('keydown',event=>{if(event.key==='Escape'){hideDetail();if(selectedButton?.isConnected)selectedButton.focus();}});
render();
</script>
</body>
</html>
`;
writeFileSync(join(root, 'index.html'), page);
process.stdout.write(
  `Built ${catalog.length} symbols in ${new Set(catalog.map((s) => s.category)).size} categories.\n`,
);
