#!/usr/bin/env node
/**
 * Word-review eval: compares a game's review verdicts with reference labels.
 *
 *   node scripts/word-review-eval.mjs <drawguess|undercover|fibking>
 *     Compares the stored production verdicts with the labels and prints how many model requests
 *     a real run would send. Sends nothing.
 *
 *   GEMINI_API_KEY=... node scripts/word-review-eval.mjs <game> --run
 *       [--thinking minimal|low|medium|high] [--batch <n>] [--repeat <n>] [--delay <seconds>]
 *       [--data <directory>]
 *     Reviews every sampled item with the review prompt in the working tree and reports the
 *     verdicts against the labels, against production, and across repeats.
 *     --run requires a delay of at least 5 seconds, including between repeats. Reports record the
 *     model/prompt/review versions; incomplete runs save their results and exit nonzero.
 *
 * Real runs are manual only: they spend the Gemini project quota and bypass the Worker's
 * editorial request ledger, so this script must never run from tests, quality checks or CI.
 *
 * Data lives in scripts/word-review-eval/data/<game>.items.json (sampled production material and
 * verdicts) and <game>.labels.tsv (label: y = belongs in the pool, n = does not, ? = unsure).
 * The supplied labels are AI reference judgments, not human gold labels. See data/README.md.
 * Never copy evaluation words into a prompt; related calibration terms are not independent holdouts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { createViteServer } from 'vitest/node';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'scripts/word-review-eval/data');
const REPORT_DIR = path.join(ROOT, 'scripts/word-review-eval/reports');
const WORKER_SOURCE = '/packages/api-worker/src';
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];
const REVIEW_TIMEOUT_MS = 120_000;
const PRINTED_DISAGREEMENT_LIMIT = 40;

const failedChecksOf = (qualityChecks) =>
  Object.entries(qualityChecks)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);

/** Per-game wiring: how to show an item, group it into requests, and review it. */
const GAMES = {
  drawguess: {
    describe: (item) => item.content.word,
    groupKey: (item) => item.category,
    async load(server) {
      const provider = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/drawguess/wordProvider.ts`,
      );
      const editorial = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/drawguess/wordEditorial.ts`,
      );
      const hasPinyinInitials = (word) => {
        try {
          editorial.toPinyinInitials(word);
          return true;
        } catch {
          return false;
        }
      };
      return {
        model: provider.DRAWGUESS_WORD_MODEL,
        promptVersion: editorial.DRAWGUESS_WORD_PROMPT_VERSION,
        reviewVersion: editorial.DRAWGUESS_WORD_REVIEW_VERSION,
        batchLimit: editorial.DRAWGUESS_WORD_BATCH_LIMIT,
        parse: (item) => editorial.drawGuessCandidateSchema.parse(item.content),
        // A stored rejection with every check passing can only come from the pinyin-hint rule.
        productionBlocker: (item) =>
          item.production !== null && failedChecksOf(item.production.qualityChecks).length === 0
            ? 'pinyinInitials'
            : null,
        async review(apiKey, fetchImpl, candidates) {
          const category = candidates[0].category;
          const reviews = await provider
            .createDrawGuessWordProvider(apiKey, fetchImpl)
            .reviewBatch(category, candidates);
          return reviews.map((review, index) => {
            const blocker = hasPinyinInitials(candidates[index].word) ? [] : ['pinyinInitials'];
            return {
              accepted: editorial.isDrawGuessReviewAccepted(review) && blocker.length === 0,
              failed: [...failedChecksOf(review.qualityChecks), ...blocker],
              reason: review.reason,
            };
          });
        },
      };
    },
  },
  undercover: {
    describe: (item) => `${item.content.wordA} / ${item.content.wordB}`,
    groupKey: (item) => item.category,
    async load(server) {
      const provider = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/undercover/wordProvider.ts`,
      );
      const editorial = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/undercover/wordEditorial.ts`,
      );
      const traitBlocker = (review) =>
        failedChecksOf(review.qualityChecks).length === 0 &&
        !editorial.isUndercoverReviewAccepted(review)
          ? ['traitCount']
          : [];
      return {
        model: provider.UNDERCOVER_WORD_MODEL,
        promptVersion: editorial.UNDERCOVER_WORD_PROMPT_VERSION,
        reviewVersion: editorial.UNDERCOVER_WORD_REVIEW_VERSION,
        batchLimit: editorial.UNDERCOVER_WORD_BATCH_LIMIT,
        parse: (item) => editorial.undercoverCandidateSchema.parse(item.content),
        productionBlocker: (item) =>
          item.production === null ? null : (traitBlocker(item.production)[0] ?? null),
        async review(apiKey, fetchImpl, candidates) {
          const category = candidates[0].category;
          const reviews = await provider
            .createUndercoverWordProvider(apiKey, fetchImpl)
            .reviewBatch(category, candidates);
          return reviews.map((review) => ({
            accepted: editorial.isUndercoverReviewAccepted(review),
            failed: [...failedChecksOf(review.qualityChecks), ...traitBlocker(review)],
            reason: review.reason,
          }));
        },
      };
    },
  },
  fibking: {
    describe: (item) => `${item.content.word}：${item.content.definition.coreMeaning}`,
    groupKey: () => 'all',
    async load(server) {
      const provider = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/fibking/wordProviders/gemini.ts`,
      );
      const candidate = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/fibking/wordProviders/candidate.ts`,
      );
      const types = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/fibking/wordProviders/types.ts`,
      );
      const prompt = await server.ssrLoadModule(
        `${WORKER_SOURCE}/games/fibking/wordProviders/prompt.ts`,
      );
      return {
        model: provider.GEMINI_FIB_WORD_MODEL,
        promptVersion: prompt.FIB_WORD_PROMPT_VERSION,
        reviewVersion: prompt.FIB_WORD_REVIEW_VERSION,
        batchLimit: types.FIB_WORD_REVIEW_BATCH_LIMIT,
        parse: (item) => candidate.parseFibWordEditorialCandidate(item.content),
        productionBlocker: () => null,
        async review(apiKey, fetchImpl, candidates) {
          const reviews = await provider.createGeminiFibWordProvider(apiKey, fetchImpl).reviewBatch(
            {
              category: candidates[0].category,
              evidence: [],
              deadlineAt: Date.now() + REVIEW_TIMEOUT_MS,
              signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
            },
            candidates,
          );
          return reviews.map((review) => ({
            accepted: review.decision === 'accepted',
            failed: failedChecksOf(review.qualityChecks),
            reason: review.reason,
          }));
        },
      };
    },
  },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArguments(argv) {
  const [game, ...rest] = argv;
  if (!Object.hasOwn(GAMES, game ?? ''))
    fail(
      `用法：node scripts/word-review-eval.mjs <${Object.keys(GAMES).join('|')}> [--run] [--thinking <level>] [--batch <n>] [--repeat <n>] [--delay <秒>] [--data <目录>]`,
    );
  const options = {
    game,
    run: false,
    thinking: null,
    batch: null,
    repeat: 1,
    delaySeconds: 5,
    dataDir: DEFAULT_DATA_DIR,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const readNumber = (minimum) => {
      const value = Number(rest[(index += 1)]);
      if (!Number.isInteger(value) || value < minimum) fail(`${flag} 需要不小于 ${minimum} 的整数`);
      return value;
    };
    if (flag === '--run') options.run = true;
    else if (flag === '--thinking') {
      options.thinking = rest[(index += 1)];
      if (!THINKING_LEVELS.includes(options.thinking))
        fail(`--thinking 只能是 ${THINKING_LEVELS.join(' / ')}`);
    } else if (flag === '--batch') options.batch = readNumber(1);
    else if (flag === '--repeat') options.repeat = readNumber(1);
    else if (flag === '--delay') options.delaySeconds = readNumber(0);
    else if (flag === '--data') {
      options.dataDir = path.resolve(rest[(index += 1)] ?? '');
      if (!existsSync(options.dataDir)) fail(`--data 目录不存在：${options.dataDir}`);
    } else fail(`未知参数：${flag}`);
  }
  if (options.run && options.delaySeconds < 5)
    fail('真实审核请求间隔至少 5 秒，避免超过每分钟 15 次的项目限额。');
  return options;
}

/** Labels are keyed by the sheet id; anything other than y / n / ? is reported, not guessed. */
function readLabels(dataDir, game) {
  const file = path.join(dataDir, `${game}.labels.tsv`);
  if (!existsSync(file)) fail(`找不到 ${file}`);
  const [header, ...lines] = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  const columns = header.split('\t');
  const idColumn = columns.indexOf('id');
  const labelColumn = columns.indexOf('label');
  const noteColumn = columns.indexOf('note');
  if (idColumn < 0 || labelColumn < 0 || noteColumn < 0) fail(`${file} 缺少 id、label 或 note 列`);
  const labels = new Map();
  const invalid = [];
  for (const [index, line] of lines.entries()) {
    const cells = line.split('\t');
    if (cells.length !== columns.length) fail(`${file}:${index + 2} 列数不正确`);
    const id = cells[idColumn];
    if (!id || labels.has(id)) fail(`${file}:${index + 2} id 为空或重复`);
    const label = (cells[labelColumn] ?? '').trim().toLowerCase();
    if (!['y', 'n', '?'].includes(label)) invalid.push(`${cells[idColumn]}=${cells[labelColumn]}`);
    else {
      const note = (cells[noteColumn] ?? '').trim();
      if (!note) fail(`${file}:${index + 2} 缺少标注理由`);
      labels.set(id, { label, note });
    }
  }
  if (invalid.length > 0) fail(`label 只能填 y / n / ?，以下行无效：${invalid.join('、')}`);
  return labels;
}

function readItems(dataDir, game) {
  const file = path.join(dataDir, `${game}.items.json`);
  if (!existsSync(file)) fail(`找不到 ${file}`);
  return JSON.parse(readFileSync(file, 'utf8')).items;
}

/** Group by the review request's scope, then split by the batch size under test. */
function planBatches(items, groupKey, batchSize) {
  const groups = new Map();
  for (const item of items) {
    const key = groupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].flatMap((group) => {
    const batches = [];
    for (let start = 0; start < group.length; start += batchSize)
      batches.push(group.slice(start, start + batchSize));
    return batches;
  });
}

/** Load the Worker's provider code as-is; only the Workers-only error reporter is stubbed. */
async function loadWorkerModules(game) {
  const server = await createViteServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@game-judge/game-engine': path.join(ROOT, 'packages/game-engine/src') } },
    plugins: [
      {
        name: 'word-review-eval-sentry-stub',
        enforce: 'pre',
        resolveId: (id) => (id === '@sentry/cloudflare' ? '\0sentry-stub' : null),
        load: (id) =>
          id === '\0sentry-stub' ? 'export const captureException = () => undefined;' : null,
      },
    ],
  });
  return { server, modules: await GAMES[game].load(server) };
}

/** Read the model's own JSON from either Gemini protocol, without trusting its shape. */
function readModelOutput(body) {
  const native = body?.candidates?.[0]?.content?.parts;
  if (Array.isArray(native))
    return {
      text: native
        .filter((part) => part.thought !== true)
        .map((part) => part.text)
        .join(''),
      thinkingTokens: body.usageMetadata?.thoughtsTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    };
  return {
    text: body?.choices?.[0]?.message?.content ?? '',
    thinkingTokens: body?.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    outputTokens: body?.usage?.completion_tokens ?? null,
  };
}

/**
 * Wrap fetch so an experiment can set the thinking level without touching production code, and so
 * the report can show what the model actually returned: token use and the key order of a review.
 */
function createInstrumentedFetch(thinking, telemetry) {
  return async (input, init) => {
    let request = init;
    if (thinking !== null) {
      const body = JSON.parse(init.body);
      if (String(input).includes(':generateContent'))
        body.generationConfig = {
          ...body.generationConfig,
          thinkingConfig: { thinkingLevel: thinking },
        };
      else body.reasoning_effort = thinking;
      request = { ...init, body: JSON.stringify(body) };
    }
    const startedAt = Date.now();
    const call = {
      status: null,
      durationMs: null,
      thinkingTokens: null,
      outputTokens: null,
    };
    telemetry.calls.push(call);
    let response;
    try {
      response = await fetch(input, request);
      call.status = response.status;
    } catch (error) {
      call.durationMs = Date.now() - startedAt;
      throw error;
    }
    try {
      const output = readModelOutput(await response.clone().json());
      call.durationMs = Date.now() - startedAt;
      call.thinkingTokens = output.thinkingTokens;
      call.outputTokens = output.outputTokens;
      const firstReview = JSON.parse(output.text).reviews?.[0];
      if (telemetry.reviewKeyOrder === null && firstReview !== undefined)
        telemetry.reviewKeyOrder = Object.keys(firstReview);
    } catch {
      call.durationMs = Date.now() - startedAt;
    }
    return response;
  };
}

/** One pass over every batch; a failed request marks its items as errored and the run continues. */
async function runOnce(modules, batches, candidatesById, options, telemetry) {
  const apiKey = process.env.GEMINI_API_KEY;
  const fetchImpl = createInstrumentedFetch(options.thinking, telemetry);
  const verdicts = new Map();
  for (const [index, batch] of batches.entries()) {
    if (index > 0 && options.delaySeconds > 0) await sleep(options.delaySeconds * 1000);
    const label = `[${index + 1}/${batches.length}] ${batch[0].category}（${batch.length} 条）`;
    try {
      const results = await modules.review(
        apiKey,
        fetchImpl,
        batch.map((item) => candidatesById.get(item.labelId)),
      );
      for (const [position, item] of batch.entries()) verdicts.set(item.labelId, results[position]);
      console.log(`  ${label} 完成`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const item of batch) verdicts.set(item.labelId, { error: message.slice(0, 400) });
      console.log(`  ${label} 失败：${message.slice(0, 200)}`);
    }
  }
  return verdicts;
}

/** Compare verdicts with labels; rates are conditioned on the label so variants stay comparable. */
function scoreAgainstLabels(items, labels, readVerdict) {
  const score = {
    goodAccepted: 0,
    goodRejected: 0,
    badAccepted: 0,
    badRejected: 0,
    unsure: 0,
    missing: 0,
  };
  const falseRejects = [];
  const falseAccepts = [];
  for (const item of items) {
    const label = labels.get(item.labelId);
    if (label === undefined) continue;
    const verdict = readVerdict(item);
    if (label.label === '?') score.unsure += 1;
    else if (verdict === null) score.missing += 1;
    else if (label.label === 'y' && verdict.accepted) score.goodAccepted += 1;
    else if (label.label === 'n' && !verdict.accepted) score.badRejected += 1;
    else if (label.label === 'y') {
      score.goodRejected += 1;
      falseRejects.push({ item, verdict, note: label.note });
    } else {
      score.badAccepted += 1;
      falseAccepts.push({ item, verdict, note: label.note });
    }
  }
  return { score, falseRejects, falseAccepts };
}

const percent = (part, whole) => (whole === 0 ? '—' : `${((part / whole) * 100).toFixed(0)}%`);

function printScore(title, game, result) {
  const { score, falseRejects, falseAccepts } = result;
  const good = score.goodAccepted + score.goodRejected;
  const bad = score.badAccepted + score.badRejected;
  console.log(`\n${title}`);
  if (score.unsure + score.missing > 0)
    console.log(`  未计入：标 ? 的 ${score.unsure} 条，没有审核结果的 ${score.missing} 条`);
  if (good + bad === 0) {
    console.log('  没有可比较的有效审核结果；不据此计算误放或误拒率。');
    return;
  }
  console.log(
    `  参考标注 y 的 ${good} 条：通过 ${score.goodAccepted}，误拒 ${score.goodRejected}（误拒率 ${percent(score.goodRejected, good)}）`,
  );
  console.log(
    `  参考标注 n 的 ${bad} 条：拦下 ${score.badRejected}，误放 ${score.badAccepted}（误放率 ${percent(score.badAccepted, bad)}）`,
  );
  const lines = [
    ...falseRejects.map(
      ({ item, verdict, note }) =>
        `  误拒 ${item.labelId} ${GAMES[game].describe(item)} ← ${verdict.failed.join(', ') || '未记录原因'}${note ? `｜标注备注：${note}` : ''}`,
    ),
    ...falseAccepts.map(
      ({ item, note }) =>
        `  误放 ${item.labelId} ${GAMES[game].describe(item)}${note ? `｜标注备注：${note}` : ''}`,
    ),
  ];
  for (const line of lines.slice(0, PRINTED_DISAGREEMENT_LIMIT)) console.log(line.slice(0, 200));
  if (lines.length > PRINTED_DISAGREEMENT_LIMIT)
    console.log(`  …另有 ${lines.length - PRINTED_DISAGREEMENT_LIMIT} 条见报告文件`);
}

/** Stored production outcome, with the non-model rule that caused it when the checks all passed. */
function productionVerdict(item, modules) {
  const failed = item.production === null ? [] : failedChecksOf(item.production.qualityChecks);
  const blocker = item.stratum === 'rejected' ? modules.productionBlocker(item) : null;
  return {
    accepted: item.stratum === 'accepted',
    failed: blocker === null ? failed : [...failed, blocker],
    reason: item.production?.reason ?? '',
  };
}

function summarizeRuns(items, runs) {
  const complete = items.filter((item) =>
    runs.every((run) => typeof run.get(item.labelId)?.accepted === 'boolean'),
  );
  const sameAsProduction = complete.filter(
    (item) => runs[0].get(item.labelId).accepted === (item.stratum === 'accepted'),
  ).length;
  const flipped = complete.filter(
    (item) => new Set(runs.map((run) => run.get(item.labelId).accepted)).size > 1,
  );
  return { complete, sameAsProduction, flipped };
}

function writeReport(options, items, runs, telemetry) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const file = path.join(
    REPORT_DIR,
    `${options.game}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  const report = {
    options,
    telemetry,
    items: items.map((item) => ({
      labelId: item.labelId,
      category: item.category,
      text: GAMES[options.game].describe(item),
      production: item.stratum,
      runs: runs.map((run) => run.get(item.labelId)),
    })),
  };
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const items = readItems(options.dataDir, options.game);
  const labels = readLabels(options.dataDir, options.game);
  const itemIds = new Set(items.map((item) => item.labelId));
  if (
    itemIds.size !== items.length ||
    labels.size !== items.length ||
    [...labels.keys()].some((id) => !itemIds.has(id))
  )
    fail('样本与标注必须按 labelId 完整一一对应，不能包含重复或未知 id。');
  const provenancePath = path.join(options.dataDir, 'labels.provenance.json');
  options.labelProvenance = existsSync(provenancePath)
    ? JSON.parse(readFileSync(provenancePath, 'utf8'))
    : { kind: 'unspecified' };
  const { server, modules } = await loadWorkerModules(options.game);
  try {
    const candidatesById = new Map(items.map((item) => [item.labelId, modules.parse(item)]));
    const batchSize = Math.min(options.batch ?? modules.batchLimit, modules.batchLimit);
    options.model = modules.model;
    options.promptVersion = modules.promptVersion;
    options.reviewVersion = modules.reviewVersion;
    options.batch = batchSize;
    const batches = planBatches(items, GAMES[options.game].groupKey, batchSize);
    console.log(`${options.game}：${items.length} 条样本，已标注 ${labels.size} 条。`);
    console.log(
      `模型：${options.model}；生成版本：${options.promptVersion}；审核版本：${options.reviewVersion}`,
    );
    console.log(
      `标注来源：${options.labelProvenance.kind}；误放/误拒均相对参考标注，不代表人工验收。`,
    );
    printScore(
      '线上当时的审核结论 对比 参考标注',
      options.game,
      scoreAgainstLabels(items, labels, (item) => productionVerdict(item, modules)),
    );
    const requestCount = batches.length * options.repeat;
    if (!options.run) {
      console.log(
        `\n未发起任何模型请求。加 --run 会发起 ${requestCount} 次审核请求（每批最多 ${batchSize} 条）。`,
      );
      return;
    }
    if (!process.env.GEMINI_API_KEY)
      fail('需要环境变量 GEMINI_API_KEY；不要把密钥写进命令参数或文件。');
    console.log(
      `\n开始真实审核：${requestCount} 次请求，thinking=${options.thinking ?? '模型默认'}，每批最多 ${batchSize} 条。`,
    );
    const telemetry = { calls: [], reviewKeyOrder: null };
    const runs = [];
    for (let repeat = 0; repeat < options.repeat; repeat += 1) {
      if (repeat > 0) await sleep(options.delaySeconds * 1000);
      if (options.repeat > 1) console.log(` 第 ${repeat + 1}/${options.repeat} 轮`);
      const run = await runOnce(modules, batches, candidatesById, options, telemetry);
      runs.push(run);
      printScore(
        `本次审核结论 对比 参考标注（第 ${repeat + 1} 轮）`,
        options.game,
        scoreAgainstLabels(items, labels, (item) => {
          const verdict = run.get(item.labelId);
          return typeof verdict?.accepted === 'boolean' ? verdict : null;
        }),
      );
    }
    const summary = summarizeRuns(items, runs);
    const failedCalls = telemetry.calls.filter(
      (call) => call.status === null || call.status < 200 || call.status >= 300,
    ).length;
    console.log(`\n与线上结论一致：${summary.sameAsProduction}/${summary.complete.length}`);
    if (options.repeat > 1)
      console.log(
        `${options.repeat} 轮之间结论不一致：${summary.flipped.length}/${summary.complete.length}（${summary.flipped.map((item) => item.labelId).join(' ')}）`,
      );
    console.log(
      `请求 ${telemetry.calls.length} 次，HTTP 失败或未取得响应的 ${failedCalls} 次；模型返回的单条审核键顺序：${telemetry.reviewKeyOrder?.join(' → ') ?? '未取得'}`,
    );
    console.log(`完整结果：${writeReport(options, items, runs, telemetry)}`);
    const failedItems = runs.reduce(
      (count, run) =>
        count + items.filter((item) => typeof run.get(item.labelId)?.accepted !== 'boolean').length,
      0,
    );
    if (failedItems > 0) {
      console.error(`评测未完整成功：${failedItems} 条审核缺失或失败，不能当作拒绝结论。`);
      process.exitCode = 1;
    }
  } finally {
    await server.close();
  }
}

await main();
