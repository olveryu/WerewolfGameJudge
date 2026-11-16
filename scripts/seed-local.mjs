#!/usr/bin/env node
/**
 * seed-local — 本地 D1 开发账号、奖励与词库 seed 脚本
 *
 * 通过 TypeScript AST 读取 product/rewards/catalog.ts 的奖励 ID 数组，
 * 创建确定性 dev 用户（全解锁）及三款词库游戏的本地样例词条，通过 wrangler d1 execute --local 写入。
 *
 * 用法：node scripts/seed-local.mjs
 * 或：  pnpm -F @game-judge/api-worker db:seed:local
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Dev 用户常量 ────────────────────────────────────────────────────────────

const DEV_USER_ID = '00000000-0000-4000-a000-000000000001';
const DEV_EMAIL = 'dev@test.local';
const DEV_DISPLAY_NAME = 'Dev User';
// PBKDF2-SHA256 hash of 'dev123' (deterministic salt)
const DEV_PASSWORD_HASH =
  '$pbkdf2-sha256$100000$ZGV2LXNlZWQtc2FsdC12MQ==$cKKdQtBQTaxbYFeIHkbrRnXHGwbklZK6/yuT7p91XE8=';

const FIB_WORDS = [
  [
    'fib-local-001',
    '沆瀣一气',
    '比喻气味相投的人勾结在一起。',
    '用于贬义语境，形容关系密切而不正当。',
  ],
  [
    'fib-local-002',
    '叶公好龙',
    '比喻表面上爱好某事物，实际上并不真正喜欢或敢于接近。',
    '用于形容言行不一或叶公好龙式的喜好。',
  ],
  [
    'fib-local-003',
    '囫囵吞枣',
    '比喻学习或理解时不加分析地笼统接受。',
    '常用于批评读书、学习或理解不求甚解。',
  ],
  [
    'fib-local-004',
    '醍醐灌顶',
    '比喻听到高明的意见后受到启发，顿时醒悟。',
    '用于形容受到启发后豁然开朗。',
  ],
  [
    'fib-local-005',
    '望洋兴叹',
    '比喻因力量不足或条件不够而感到无可奈何。',
    '用于面对难以企及的目标时感到无能为力。',
  ],
  ['fib-local-006', '噤若寒蝉', '形容因害怕或有所顾忌而不敢说话。', '多用于形容沉默不语的状态。'],
  [
    'fib-local-007',
    '不刊之论',
    '指正确、不可改动的言论。',
    '“刊”指削除，不能误解为不能刊登的议论。',
  ],
  [
    'fib-local-008',
    '画龙点睛',
    '比喻在关键处着笔，使内容更加生动传神。',
    '常用于形容关键的一笔或一句使整体更加出色。',
  ],
  ['fib-local-009', '杯弓蛇影', '比喻因疑神疑鬼而自相惊扰。', '用于形容把虚幻的事物当成真实威胁。'],
  [
    'fib-local-010',
    '掩耳盗铃',
    '比喻自己欺骗自己，明明掩盖不了的事偏要设法掩盖。',
    '用于形容自欺欺人的做法。',
  ],
];

const UNDERCOVER_WORD_PAIRS = [
  ['undercover-local-001', '苹果', '香蕉', 'food'],
  ['undercover-local-002', '牛奶', '豆浆', 'drinks'],
  ['undercover-local-003', '汽车', '火车', 'vehicles'],
  ['undercover-local-004', '兔子', '松鼠', 'animals'],
  ['undercover-local-005', '篮球', '足球', 'sportsAndGames'],
  ['undercover-local-006', '吉他', '钢琴', 'music'],
  ['undercover-local-007', '雨伞', '雨衣', 'dailyLife'],
  ['undercover-local-008', '冬天', '春天', 'nature'],
  ['undercover-local-009', '饺子', '馄饨', 'food'],
  ['undercover-local-010', '海豚', '鲨鱼', 'animals'],
  ['undercover-local-011', '游泳', '跑步', 'actions'],
  ['undercover-local-012', '电影', '电视剧', 'entertainment'],
];

const DRAWGUESS_WORDS = [
  ['drawguess-local-001', '大熊猫', 'dxm', 'animals', 'easy'],
  ['drawguess-local-002', '长颈鹿', 'cjl', 'animals', 'easy'],
  ['drawguess-local-003', '蝴蝶', 'hd', 'animals', 'easy'],
  ['drawguess-local-004', '西瓜', 'xg', 'food', 'easy'],
  ['drawguess-local-005', '冰淇淋', 'bql', 'food', 'medium'],
  ['drawguess-local-006', '纸飞机', 'zfj', 'toys', 'easy'],
  ['drawguess-local-007', '热气球', 'rqq', 'vehicles', 'medium'],
  ['drawguess-local-008', '自行车', 'zxc', 'vehicles', 'easy'],
  ['drawguess-local-009', '望远镜', 'wyj', 'dailyObjects', 'medium'],
  ['drawguess-local-010', '吹风机', 'cfj', 'dailyObjects', 'medium'],
  ['drawguess-local-011', '仙人掌', 'xrz', 'plants', 'medium'],
  ['drawguess-local-012', '直升机', 'zsj', 'vehicles', 'hard'],
];

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

for (const [id, wordA, wordB] of UNDERCOVER_WORD_PAIRS) {
  if (wordA >= wordB) {
    throw new Error(`Undercover seed pair ${id} must be stored in ascending word order`);
  }
}

for (const [id, word, pinyinInitials] of DRAWGUESS_WORDS) {
  if ([...word].length !== pinyinInitials.length) {
    throw new Error(`DrawGuess seed word ${id} must have one pinyin initial per character`);
  }
}

// ── 从 catalog.ts 解析 ID 数组 ─────────────────────────────────────────────

const catalogPath = resolve(__dirname, '../packages/game-engine/src/product/rewards/catalog.ts');
const catalogSrc = readFileSync(catalogPath, 'utf-8');
const catalogSourceFile = ts.createSourceFile(
  catalogPath,
  catalogSrc,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

const catalogArrays = new Map();
for (const statement of catalogSourceFile.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
    const initializer = unwrapExpression(declaration.initializer);
    if (ts.isArrayLiteralExpression(initializer)) {
      catalogArrays.set(declaration.name.text, initializer);
    }
  }
}

/** 从 AST 中提取字符串数组（支持 `...VAR_NAME` spread 引用）。 */
function extractIds(varName, ancestors = []) {
  if (ancestors.includes(varName)) {
    throw new Error(`Cyclic catalog array spread: ${[...ancestors, varName].join(' -> ')}`);
  }
  const array = catalogArrays.get(varName);
  if (array === undefined) {
    throw new Error(`Cannot find catalog array ${varName}`);
  }

  const ids = [];
  for (const element of array.elements) {
    if (ts.isStringLiteral(element)) {
      ids.push(element.text);
      continue;
    }
    if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) {
      ids.push(...extractIds(element.expression.text, [...ancestors, varName]));
      continue;
    }
    throw new Error(
      `Unsupported expression in catalog array ${varName}: ${element.getText(catalogSourceFile)}`,
    );
  }
  return ids;
}

const avatarIds = extractIds('AVATAR_IDS');
const frameIds = extractIds('FRAME_IDS');
const flairIds = extractIds('SEAT_FLAIR_IDS');
const nameStyleIds = extractIds('NAME_STYLE_IDS');
const effectIds = extractIds('ROLE_REVEAL_EFFECT_IDS');
const seatAnimationIds = extractIds('SEAT_ANIMATION_IDS');
const allIds = [
  ...avatarIds,
  ...frameIds,
  ...flairIds,
  ...nameStyleIds,
  ...effectIds,
  ...seatAnimationIds,
];
if (new Set(allIds).size !== allIds.length) {
  throw new Error('Reward catalog contains duplicate IDs');
}

console.log(
  `Parsed ${avatarIds.length} avatars, ${frameIds.length} frames, ${flairIds.length} flairs, ${nameStyleIds.length} nameStyles, ${effectIds.length} effects, ${seatAnimationIds.length} seatAnimations (${allIds.length} total)`,
);

// ── 生成 SQL ────────────────────────────────────────────────────────────────

const unlockedJson = JSON.stringify(allIds);
const maxLevel = 99;
const maxXp = 9999;

const sql = [
  // Dev user (INSERT OR REPLACE to be idempotent)
  `INSERT OR REPLACE INTO users (id, email, password_hash, display_name, is_anonymous, created_at, updated_at) VALUES ('${DEV_USER_ID}', '${DEV_EMAIL}', '${DEV_PASSWORD_HASH}', '${DEV_DISPLAY_NAME}', 0, datetime('now'), datetime('now'));`,
  // Full-unlock user_stats with gacha tickets for testing
  `INSERT OR REPLACE INTO user_stats (user_id, xp, level, games_played, unlocked_items, normal_draws, golden_draws, normal_pity, golden_pity, version, last_login_reward_at, updated_at) VALUES ('${DEV_USER_ID}', ${maxXp}, ${maxLevel}, 100, '${unlockedJson}', 50, 10, 0, 0, 0, NULL, datetime('now'));`,
  ...FIB_WORDS.flatMap(([id, word, coreMeaning, usageNote], index) => [
    `INSERT INTO fib_word_sequence (word, published_at, pack_id) VALUES (${sqlString(word)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL) ON CONFLICT (word) DO NOTHING;`,
    `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, generation_cycle_id, created_at, activated_at, topic) VALUES (${sqlString(id)}, ${sqlString(word)}, ${sqlString(coreMeaning)}, ${sqlString(usageNote)}, 'literary', 'local', 'active', ${index}, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'literature') ON CONFLICT (word) DO NOTHING;`,
  ]),
  ...UNDERCOVER_WORD_PAIRS.map(
    ([id, wordA, wordB, category]) =>
      `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json) VALUES (${sqlString(id)}, ${sqlString(wordA)}, ${sqlString(wordB)}, ${sqlString(category)}, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), '{}') ON CONFLICT (id) DO NOTHING;`,
  ),
  ...DRAWGUESS_WORDS.map(
    ([id, word, pinyinInitials, category, difficulty]) =>
      `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at) VALUES (${sqlString(id)}, ${sqlString(word)}, ${sqlString(pinyinInitials)}, ${sqlString(category)}, ${sqlString(difficulty)}, 'active', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), NULL) ON CONFLICT (id) DO NOTHING;`,
  ),
].join(' ');

console.log('\n=== Dev user seed ===');
console.log(`  Email:    ${DEV_EMAIL}`);
console.log(`  Password: dev123`);
console.log(`  UUID:     ${DEV_USER_ID}`);
console.log(`  Level:    ${maxLevel} (XP: ${maxXp})`);
console.log(`  Unlocked: ${allIds.length} items`);
console.log(
  `  Word bank: ${FIB_WORDS.length} FibKing words, ${UNDERCOVER_WORD_PAIRS.length} Undercover pairs, ${DRAWGUESS_WORDS.length} DrawGuess words\n`,
);

// ── 执行 ────────────────────────────────────────────────────────────────────

const workerDir = resolve(__dirname, '../packages/api-worker');
const tmpSql = join(workerDir, '.seed-local-tmp.sql');

try {
  // Write SQL to temp file to avoid shell $ expansion mangling the password hash
  writeFileSync(tmpSql, sql, 'utf-8');
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'werewolf-db',
      '--local',
      '--config=wrangler.toml',
      `--file=${tmpSql}`,
    ],
    {
      cwd: workerDir,
      encoding: 'utf-8',
      stdio: 'inherit',
    },
  );
  console.log('\nSeed complete! Login with dev@test.local / dev123');
} catch (e) {
  console.error('Seed failed:', e);
  process.exitCode = 1;
} finally {
  if (existsSync(tmpSql)) {
    unlinkSync(tmpSql);
  }
}
