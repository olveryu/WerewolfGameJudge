/**
 * Generator tests: run the real generator against a fixture repository
 * assembled from the real shared files it edits, for all three presets.
 * Real-tree copies validate formatting, lint, web/engine/Worker types,
 * generated engine and web client tests and registration contracts. Demo regeneration
 * must also match the shipped reference game. Run with
 * `node --test scripts/new-game.test.mjs` (also wrapped by
 * contracts/newGameGenerator.contract.test.ts in the root vitest suite).
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { editEngineContractsTest } from './lib/new-game/edits.mjs';
import {
  FILE_CAPABILITY_GATES,
  generateNewGame,
  generatorFacts,
  PACK_SEGMENT_SWITCHES,
  PRESET_CAPABILITIES,
  SHARED_EDITS,
} from './lib/new-game/generate.mjs';
import {
  assertRegistrationGameTypes,
  findLatestRegistrationMigration,
  nextMigrationName,
} from './lib/new-game/migration.mjs';
import {
  applyCapabilityBlocks,
  deriveGameNames,
  renderTemplateFile,
} from './lib/new-game/render.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every shared file the generator edits; the fixture copies the real ones. */
const SHARED_FILES = SHARED_EDITS.map(({ file }) => file);
const fixtureRoots = new Set();
test.after(() => {
  for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

function makeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'new-game-fixture-'));
  fixtureRoots.add(root);
  for (const file of SHARED_FILES) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, file), target);
  }
  const migrationsSource = path.join(REPO_ROOT, 'packages/api-worker/migrations');
  const migrationsTarget = path.join(root, 'packages/api-worker/migrations');
  fs.mkdirSync(migrationsTarget, { recursive: true });
  for (const name of fs.readdirSync(migrationsSource)) {
    if (name.endsWith('.sql')) {
      fs.copyFileSync(path.join(migrationsSource, name), path.join(migrationsTarget, name));
    }
  }
  return root;
}

/**
 * A private copy of the real repository tree with the heavy read-only
 * trees (dependencies, media assets) symlinked back in instead of
 * copied. Generation inside the copy sees the real prettier/eslint
 * environment without ever mutating the shared tree, so this is safe
 * to run in parallel with other suites.
 */
function makeRealRepoCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'new-game-real-repo-'));
  fixtureRoots.add(root);
  fs.cpSync(REPO_ROOT, root, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(REPO_ROOT, source);
      if (relative === '') return true;
      const segments = relative.split(path.sep);
      return (
        segments[0] !== '.git' &&
        segments[0] !== 'assets' &&
        !segments[0].startsWith('.new-game-') &&
        !segments.includes('node_modules')
      );
    },
  });
  for (const linked of [
    'assets',
    'node_modules',
    'packages/game-engine/node_modules',
    'packages/api-worker/node_modules',
    'packages/web/node_modules',
  ]) {
    const real = path.join(REPO_ROOT, linked);
    if (fs.existsSync(real)) fs.symlinkSync(real, path.join(root, linked), 'dir');
  }
  return root;
}

/** The vitest CLI a workspace package of `root` resolves. */
function resolveVitestBin(root, packageDir) {
  const vitestPackageJson = createRequire(path.join(root, packageDir, 'package.json')).resolve(
    'vitest/package.json',
  );
  return path.resolve(
    path.dirname(vitestPackageJson),
    JSON.parse(fs.readFileSync(vitestPackageJson, 'utf8')).bin.vitest,
  );
}

function typecheckFixture(root, project) {
  const require = createRequire(path.join(root, 'package.json'));
  try {
    execFileSync(
      process.execPath,
      [require.resolve('typescript/bin/tsc'), '--noEmit', '--project', project],
      { cwd: root, stdio: 'pipe', encoding: 'utf8' },
    );
  } catch (error) {
    throw new Error(
      `Fixture typecheck failed (${project}, ${root})\n${error.stdout ?? ''}${error.stderr ?? ''}`,
      { cause: error },
    );
  }
}

/**
 * Whole-file products a capability adds on top of the base skeleton,
 * keyed by capability: the expectation side of the generator's
 * FILE_CAPABILITY_GATES. A new gated template file joins this table
 * under its capability, or the file-list assertion below fails for
 * the packs that enable the capability.
 */
const CAPABILITY_FILE_ADDITIONS = [
  {
    capability: 'stageDeadline',
    files: ({ engine }) => [`${engine}/__tests__/phaseDeadlineProtocol.contract.test.ts`],
  },
  {
    capability: 'identityViewing',
    files: ({ engine, client, pascal }) => [
      `${engine}/__tests__/identityViewingProtocol.contract.test.ts`,
      `${client}/components/${pascal}RoleCardAdapter.ts`,
    ],
  },
  {
    capability: 'audioOrchestration',
    files: ({ client, pascal }) => [`${client}/room/hooks/use${pascal}AudioOrchestration.ts`],
  },
];

function expectedCreatedFiles(gameId, preset) {
  const pascal = gameId.charAt(0).toUpperCase() + gameId.slice(1);
  const engine = `packages/game-engine/src/games/${gameId}`;
  const worker = `packages/api-worker/src/games/${gameId}`;
  const client = `packages/web/src/games/${gameId}`;
  const files = [
    `${engine}/state/version.ts`,
    `${engine}/state/codec.ts`,
    `${engine}/state/types.ts`,
    `${engine}/state/parseState.ts`,
    `${engine}/state/normalize.ts`,
    `${engine}/commands/types.ts`,
    `${engine}/domain/decision.ts`,
    `${engine}/domain/evolve.ts`,
    `${engine}/domain/rules.ts`,
    `${engine}/domain/seating.ts`,
    `${engine}/domain/visibility.ts`,
    `${engine}/engine.ts`,
    `${engine}/public.ts`,
    `${engine}/__tests__/engine.test.ts`,
    `${engine}/__tests__/migration.test.ts`,
    `${worker}/schemas.ts`,
    `${worker}/effects.ts`,
    `${worker}/module.ts`,
    `${worker}/__tests__/schemas.test.ts`,
    `${engine}/publicStats.ts`,
    `${engine}/__tests__/publicStats.test.ts`,
    `${worker}/dbSchema.ts`,
    `${worker}/publicUserStats.ts`,
    `${worker}/__tests__/publicUserStats.test.ts`,
    `${client}/components/${pascal}StatsPanel.tsx`,
    `${client}/components/__tests__/${pascal}StatsPanel.test.tsx`,
    `${client}/services/${gameId}Stats.ts`,
    `${client}/module.ts`,
    `${client}/home.ts`,
    `${client}/navigation/${gameId}GameNavigation.ts`,
    `${client}/model/${pascal}RoomSession.ts`,
    `${client}/screens/${pascal}RulesScreen.tsx`,
    `${client}/room/${pascal}RoomScreen.tsx`,
    `${client}/room/${pascal}RoomScreen.css`,
    `${client}/room/${gameId}RoomAdapter.ts`,
    `${client}/room/${gameId}GuidanceMatrix.ts`,
    `${client}/room/${gameId}RoomCommandFailureMessage.ts`,
    `${client}/room/hooks/use${pascal}RoomState.ts`,
    `${client}/room/__tests__/${gameId}GuidanceMatrix.test.ts`,
    `${client}/room/__tests__/${gameId}RoomCommandFailureMessage.test.ts`,
    `${client}/review/to${pascal}ReviewDocument.ts`,
    `${client}/review/${gameId}Review.ts`,
    `${client}/review/__tests__/${gameId}Review.test.ts`,
    `packages/web/src/test-utils/${gameId}State.ts`,
    `docs/${gameId}-game-design.md`,
    `e2e/specs/${gameId}.spec.ts.tmpl`,
  ];
  for (const addition of CAPABILITY_FILE_ADDITIONS) {
    if (PRESET_CAPABILITIES[preset][addition.capability]) {
      files.push(...addition.files({ engine, client, pascal }));
    }
  }
  return files.sort();
}

function readFixture(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('capability blocks keep lines only for enabled capabilities and fail fast on bad markers', () => {
  const capabilities = { identityViewing: true, stageDeadline: false };
  const text = [
    'base',
    '//#cap identityViewing',
    'viewing line',
    '//#end',
    '//#cap stageDeadline',
    'deadline line',
    '//#end',
    'tail',
  ].join('\n');
  assert.equal(applyCapabilityBlocks(text, capabilities), 'base\nviewing line\ntail');
  // Negated blocks invert the switch: kept exactly when the key is off.
  assert.equal(applyCapabilityBlocks('//#cap !stageDeadline\nx\n//#end', capabilities), 'x');
  assert.equal(applyCapabilityBlocks('//#cap !identityViewing\nx\n//#end', capabilities), '');
  assert.throws(
    () => applyCapabilityBlocks('//#cap nope\nx\n//#end', capabilities),
    /Unknown capability block "nope"/,
  );
  assert.throws(
    () => applyCapabilityBlocks('//#cap !nope\nx\n//#end', capabilities),
    /Unknown capability block "!nope"/,
  );
  assert.throws(
    () =>
      applyCapabilityBlocks('//#cap identityViewing\n//#cap stageDeadline\n//#end', capabilities),
    /Nested capability block/,
  );
  assert.throws(() => applyCapabilityBlocks('//#end', capabilities), /without a start marker/);
  assert.throws(
    () => applyCapabilityBlocks('//#cap identityViewing\nx', capabilities),
    /Unterminated capability block/,
  );
});

for (const preset of ['identity', 'stage', 'demo-hybrid']) {
  test(`generates the complete ${preset} skeleton and wires every registration point`, () => {
    const root = makeFixtureRepo();
    const summary = generateNewGame({
      rootDir: root,
      gameId: 'demoproto',
      preset,
      displayName: '演示原型',
      subtitle: '生成器自证用临时游戏',
    });

    // File-list completeness (the plan §4 checklist).
    assert.deepEqual(
      summary.createdFiles.filter((file) => !file.includes('/migrations/')),
      expectedCreatedFiles('demoproto', preset),
    );
    assert.match(summary.migrationName, /^\d{4}_demoproto\.sql$/);
    assert.ok(
      fs.existsSync(path.join(root, 'packages/api-worker/migrations', summary.migrationName)),
    );
    assert.deepEqual(summary.editedFiles, SHARED_FILES);
    assert.ok(fs.existsSync(path.join(root, summary.reportPath)));

    // No template token survives anywhere.
    for (const file of summary.createdFiles) {
      assert.ok(!readFixture(root, file).includes('__GAME_'), `${file} still carries a token`);
    }

    // Registry + canonical type list + reward parameter table.
    const gameTypes = readFixture(root, 'packages/game-engine/src/platform/protocol/gameTypes.ts');
    assert.ok(gameTypes.includes(`  'demoproto',\n] as const;`));
    const registry = readFixture(root, 'packages/game-engine/src/games/registry.ts');
    assert.ok(registry.includes('demoproto: {'));
    // Scope the production-flag assertion to the generated entry itself:
    // the fixture registry already carries seven `isProduction: true`
    // lines for the shipped games, so a file-wide includes() is vacuous.
    const entryStart = registry.indexOf('demoproto: {');
    const demoprotoEntry = registry.slice(entryStart, registry.indexOf('\n  },', entryStart));
    assert.ok(
      demoprotoEntry.includes('isProduction: false'),
      'default generation registers the new game as non-production',
    );
    const reportText = readFixture(root, summary.reportPath);
    assert.ok(reportText.includes('上线（翻生产）'), 'default report carries the go-live step');
    assert.ok(reportText.includes('homeProductionFilter'), 'go-live step names the tripwire list');
    assert.ok(
      demoprotoEntry.includes("rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.demoproto }"),
    );
    const earnings = readFixture(root, 'packages/game-engine/src/product/rewards/earnings.ts');
    assert.ok(
      earnings.includes(
        'demoproto: { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 }',
      ),
    );

    // Capabilities: the contract expectation row and the engine
    // declaration must carry exactly the preset table.
    const capabilities = PRESET_CAPABILITIES[preset];
    const contract = readFixture(
      root,
      'packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts',
    );
    const row = new RegExp(`demoproto: \\{[^}]*\\}`).exec(contract);
    assert.ok(row !== null, 'capabilities contract row missing');
    const engineSource = readFixture(root, 'packages/game-engine/src/games/demoproto/engine.ts');
    for (const [key, value] of Object.entries(capabilities)) {
      assert.ok(row[0].includes(`${key}: ${value}`), `contract row ${key}`);
      assert.ok(engineSource.includes(`${key}: ${value}`), `engine declaration ${key}`);
    }

    // Catalogs and whitelist points.
    assert.ok(
      readFixture(root, 'packages/game-engine/package.json').includes('"./games/demoproto/public"'),
    );
    assert.ok(
      readFixture(
        root,
        'packages/game-engine/src/platform/__tests__/architecture.contract.test.ts',
      ).includes(`'./games/demoproto/public',`),
    );
    assert.ok(
      readFixture(
        root,
        'packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts',
      ).includes(`'demoproto',`),
    );
    const engineContracts = readFixture(
      root,
      'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
    );
    assert.ok(
      engineContracts.includes(
        `import { demoprotoEngine } from '../../../games/demoproto/engine';`,
      ),
    );
    assert.equal(
      (engineContracts.match(/demoproto: demoprotoEngine,/g) ?? []).length,
      5,
      'every complete catalog literal in contracts.test.ts gains the new engine',
    );
    const engineCatalog = readFixture(root, 'packages/game-engine/src/games/catalog.ts');
    assert.ok(engineCatalog.includes(`import { demoprotoEngine } from './demoproto/engine';`));
    assert.ok(engineCatalog.includes('demoproto: demoprotoEngine,'));
    const workerCatalog = readFixture(root, 'packages/api-worker/src/games/catalog.ts');
    assert.ok(
      workerCatalog.includes(`import { demoprotoWorkerModule } from './demoproto/module';`),
    );
    assert.ok(
      workerCatalog.includes('demoproto: registerWorkerGameModule(demoprotoWorkerModule),'),
    );
    const clientCatalog = readFixture(root, 'packages/web/src/games/catalog.ts');
    assert.ok(clientCatalog.includes(`import { demoprotoHome } from '@/games/demoproto/home';`));
    assert.ok(
      clientCatalog.includes(
        '  demoproto: { home: demoprotoHome, AccountStats: DemoprotoStatsPanel },',
      ),
    );
    const clientModules = readFixture(root, 'packages/web/src/games/clientModules.tsx');
    assert.ok(clientModules.includes('demoproto: createDemoprotoClientModule,'));
    assert.ok(
      clientModules.includes(
        "import { createDemoprotoClientModule } from '@/games/demoproto/module';",
      ),
    );
    assert.ok(clientModules.includes("    demoproto: cacheLoad(() => loadModule('demoproto')),"));
    const dispatch = readFixture(
      root,
      'packages/web/src/__tests__/botDispatchDiscipline.contract.test.ts',
    );
    assert.ok(dispatch.includes('demoproto: ['));
    assert.ok(
      dispatch.includes(`demoproto: ['games/demoproto/room/hooks/useDemoprotoRoomState.ts'],`),
    );
    const guidanceRegistry = readFixture(
      root,
      'packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts',
    );
    assert.ok(
      guidanceRegistry.includes(
        `import { DEMOPROTO_GUIDANCE_MATRIX } from '@/games/demoproto/room/demoprotoGuidanceMatrix';`,
      ),
    );
    assert.ok(guidanceRegistry.includes('  demoproto: DEMOPROTO_GUIDANCE_MATRIX,'));
    const reviewRegistry = readFixture(
      root,
      'packages/web/src/__tests__/roomReview.contract.test.ts',
    );
    assert.ok(
      reviewRegistry.includes(
        `import { demoprotoReview } from '@/games/demoproto/review/demoprotoReview';`,
      ),
    );
    assert.ok(
      reviewRegistry.includes(
        `import { DEMOPROTO_REVIEW_ROUNDS } from '@/test-utils/demoprotoState';`,
      ),
    );
    assert.ok(
      reviewRegistry.includes('  demoproto: reviewCase(demoprotoReview, DEMOPROTO_REVIEW_ROUNDS),'),
    );

    // Integration report: parameters, migration and the manual steps
    // that must not be automated away (migration review, e2e approval).
    const report = readFixture(root, summary.reportPath);
    assert.ok(report.includes('还差的人工步骤'));
    assert.deepEqual(
      [...report.matchAll(/^(\d+)\. \*\*/gm)].map((match) => Number(match[1])),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      'the report numbers its nine manual steps in order',
    );
    assert.ok(report.includes(summary.migrationName));
    assert.ok(report.includes('审 migration'));
    assert.ok(report.includes('e2e 启用需用户批准'));
    // The review step names the skeleton document and contribution a
    // game fills, and the closed block vocabulary it fills them with.
    assert.ok(report.includes('本局复盘填空'));
    assert.ok(
      report.includes('packages/web/src/games/demoproto/review/toDemoprotoReviewDocument.ts'),
    );
    assert.ok(report.includes('packages/web/src/games/demoproto/review/demoprotoReview.ts'));
    assert.ok(report.includes('packages/web/src/features/room/review/types.ts'));
    // The word-library step names all three workflow registration
    // sites: the registry entry, the worker entrypoint export and
    // the wrangler binding (the last one has no contract weld).
    assert.ok(report.includes('workerWorkflows'));
    assert.ok(report.includes("exportName: 'DemoprotoWordSupplyWorkflow'"));
    assert.ok(report.includes('packages/api-worker/src/index.ts'));
    assert.ok(
      report.includes(
        `export { DemoprotoWordSupplyWorkflow } from './games/demoproto/wordSupplyWorkflow';`,
      ),
    );
    assert.ok(report.includes('packages/api-worker/wrangler.toml'));
    assert.ok(report.includes('[[workflows]]'));
    assert.ok(report.includes('binding = "DEMOPROTO_WORD_SUPPLY"'));
    // The TODO_IDENTITY follow-up note rides on the identityViewing
    // capability, not on the preset name.
    assert.equal(
      report.includes('TODO_IDENTITY'),
      capabilities.identityViewing,
      'report TODO_IDENTITY note follows identityViewing',
    );

    // Migration: both game_type CHECK lists extended, manual step marked.
    const migration = readFixture(root, `packages/api-worker/migrations/${summary.migrationName}`);
    const lists = [...migration.matchAll(/game_type IN \(([^)]*)\)/g)];
    assert.ok(lists.length >= 2, 'expected both game_type CHECK lists');
    for (const list of lists) assert.ok(list[1].includes(`'demoproto'`));
    assert.ok(migration.includes('TODO(gameplay)'));
    assert.ok(migration.includes('CREATE TABLE demoproto_user_stats'));
    assert.ok(migration.includes("typeof(games_played) = 'integer'"));
    assert.ok(migration.includes('ON DELETE CASCADE'));
    const statsOwnerContract = readFixture(root, 'contracts/architecture.contract.test.ts');
    assert.ok(
      statsOwnerContract.includes(
        "['demoproto_user_stats', 'packages/api-worker/src/games/demoproto/dbSchema.ts']",
      ),
    );
    const statsModule = readFixture(root, 'packages/api-worker/src/games/demoproto/module.ts');
    assert.ok(statsModule.includes('parsePublicUserStats: parseDemoprotoPublicStats'));
    assert.ok(statsModule.includes('getPublicUserStats: getDemoprotoPublicUserStats'));
    const statsEffects = readFixture(root, 'packages/api-worker/src/games/demoproto/effects.ts');
    assert.ok(
      statsEffects.includes(
        'z.union([gameCompletionPayloadSchema, demoprotoCompletionPayloadSchema])',
      ),
    );
    assert.ok(
      statsEffects.includes(
        "'stats' in effect.payload ? demoprotoStatsSettlement(effect.payload.stats) : undefined",
      ),
    );
    const roomHook = readFixture(
      root,
      'packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts',
    );
    assert.ok(
      roomHook.includes("useGameProfileDetails(profile.selection, '演示原型战绩', '本游戏局数')"),
    );
    assert.ok(roomHook.includes('    gameDetails,'));
    assert.ok(
      readFixture(root, 'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx').includes(
        'profileDetailsRenderer=',
      ),
    );
    assert.ok(
      readFixture(root, 'packages/web/src/games/demoproto/room/demoprotoRoomAdapter.ts').includes(
        'gameDetails: input.gameDetails',
      ),
    );
    assert.ok(report.includes('不需要额外指标也必须记录批准理由'));
    assert.ok(
      report.includes('名单同步不是上线充分条件') || report.includes('两处齐不是上线充分条件'),
    );

    // Preset wiring markers the capability welds depend on.
    const engineGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/game-engine/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    const clientGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/web/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    if (capabilities.botTestScaffold) {
      assert.ok(engineGameDir.includes('demoproto.bots.markAllBotsViewed'));
    }
    // Every pack ships the review end to end: the module declares the
    // contribution, the room state resolves it through the platform
    // hook, the screen mounts its overlay, and the adapter places the
    // shared entry on the bottom tier and the host sheet, closing the
    // ended task with the review beside next round / return to lobby.
    const clientModule = readFixture(root, 'packages/web/src/games/demoproto/module.ts');
    assert.ok(clientModule.includes('review: demoprotoReview,'), 'module declares the review');
    const reviewHook = readFixture(
      root,
      'packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts',
    );
    assert.ok(reviewHook.includes('useRoomReview({'), 'room state resolves the review');
    assert.ok(
      readFixture(root, 'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx').includes(
        'screen.reviewOverlay',
      ),
      'room screen mounts the review overlay',
    );
    const adapterSource = readFixture(
      root,
      'packages/web/src/games/demoproto/room/demoprotoRoomAdapter.ts',
    );
    assert.ok(
      adapterSource.includes(
        `buildViewerReviewBottomButtons(input.review, 'secondary', input.viewer)`,
      ),
    );
    assert.ok(adapterSource.includes('buildReviewHostAction(input.review)'));
    assert.ok(adapterSource.includes('hostReviewClosingTask()'));
    assert.ok(!adapterSource.includes('hostClosingTask('), 'ended task offers the review');
    if (capabilities.identityViewing) {
      // The generated room screen consumes the shared RevealRoleCardModal.
      assert.ok(clientGameDir.includes('RevealRoleCardModal'));
    } else {
      assert.ok(!clientGameDir.includes('RevealRoleCardModal'));
    }
    if (capabilities.stageDeadline) {
      assert.ok(engineGameDir.includes('deadlineAt'));
      // E-2 PR-5: the generated deadline engine assembles expiry
      // through the shared phase-deadline chassis only — the guard
      // and the settle.due constructor are called, and no self-written
      // gate keyword (raw actor resolution, hand-built settle effect)
      // survives in the generated engine.
      assert.ok(
        engineSource.includes('guardPhaseExpiry('),
        'deadline engine calls the expiry guard',
      );
      assert.ok(
        engineSource.includes('buildSettleDueEffect('),
        'deadline engine calls the settle.due constructor',
      );
      assert.ok(
        !engineSource.includes('resolveSystemActorEffectId'),
        'deadline engine has no self-written system-channel gate',
      );
      assert.ok(
        !engineSource.includes('resolveUncontrolledUserActorId'),
        'deadline engine has no self-written user-channel gate',
      );
      assert.ok(
        !engineSource.includes("type: 'demoproto.settle.due'"),
        'deadline engine does not hand-build the settle.due effect',
      );
      // The generated worker side delivers through the shared
      // settle.due helper: handler, business key and delivery time.
      const workerEffects = readFixture(root, 'packages/api-worker/src/games/demoproto/effects.ts');
      const workerModule = readFixture(root, 'packages/api-worker/src/games/demoproto/module.ts');
      assert.ok(
        workerEffects.includes('createSettleDueHandler'),
        'worker effects use the shared settle handler',
      );
      assert.ok(
        !workerEffects.includes('dispatchEffectCommand'),
        'worker settle handler is not hand-rolled over the raw dispatch',
      );
      assert.ok(
        workerModule.includes('settleDueBusinessKey('),
        'worker module uses the business-key helper',
      );
      assert.ok(
        workerModule.includes('settleDueDeliveryAt('),
        'worker module uses the delivery-time helper',
      );
      assert.ok(
        !workerModule.includes(':settle:${'),
        'worker module does not hand-build the settle business key',
      );
      // D3: expiry is server-only — no client sends expire. The
      // stage pack's rendered hook is countdown-only: it calls
      // useStageDeadline with the deadline alone and exposes
      // remainingSeconds for display. If the countdown block were
      // silently dropped from the assembled hook, these assertions
      // fail with it. The demo-hybrid pack renders no countdown
      // surface at all, exactly like the shipped demo.
      const roomHook = readFixture(
        root,
        'packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts',
      );
      if (!capabilities.identityViewing) {
        assert.ok(roomHook.includes('useStageDeadline({'), 'rendered hook calls useStageDeadline');
        assert.ok(!roomHook.includes('shouldExpire'), 'rendered hook has no expire gate');
        assert.ok(!roomHook.includes('onExpire'), 'rendered hook has no expire dispatch');
        assert.ok(!roomHook.includes('attemptKey'), 'rendered hook has no single-shot key');
        assert.ok(!roomHook.includes('phase.expire'), 'rendered hook never dispatches expire');
        assert.ok(roomHook.includes('remainingSeconds'), 'rendered hook exposes the countdown');
      } else {
        assert.ok(!roomHook.includes('useStageDeadline'), 'hybrid hook has no countdown');
      }
      // The public expire command is gone from the generated engine
      // entirely, and so is the phase.expired event it used to emit:
      // the internal settle runs through the terminal seam (game.ended
      // + game.completed), exactly like the shipped demo, which has no
      // phase.expired anywhere — the event type and its evolve case
      // were dead code with no constructor left, so they were deleted
      // from the templates rather than kept.
      assert.ok(!engineSource.includes(`'demoproto.phase.expire'`), 'no public expire command');
      assert.ok(
        engineSource.includes(`'demoproto.phase.settleExpired'`),
        'internal settle command dispatched',
      );
      assert.ok(
        engineSource.includes('endDemoprotoGame(state, context)'),
        'settle runs through the terminal seam',
      );
      assert.ok(!engineGameDir.includes('phase.expired'), 'dead phase.expired event is gone');
      // D3 follow-up: the host self-rescue retry rides the same settle
      // dispatch — vocabulary entry only, no duplicated settle logic.
      // The retry command is public in the engine and the Worker
      // schema, gated host-first in decide; the stage pack's room
      // hook exposes isOverdue and the stage area renders the shared
      // rescue UI. The demo-hybrid pack renders no countdown surface
      // at all, so it gets none of the client wiring.
      assert.ok(
        engineSource.includes(`'demoproto.phase.retrySettle'`),
        'retry command in engine vocabulary',
      );
      assert.ok(engineSource.includes(`case 'demoproto.phase.retrySettle':`), 'retry decide case');
      assert.ok(
        engineSource.includes(`settleExpired(state, context, 'uncontrolledUser')`),
        'retry re-drives the existing settle dispatch',
      );
      assert.ok(engineSource.includes('notHostRetrySettle'), 'retry host gate reason');
      assert.ok(
        readFixture(root, 'packages/api-worker/src/games/demoproto/schemas.ts').includes(
          `'demoproto.phase.retrySettle'`,
        ),
        'retry in worker schema',
      );
      assert.ok(
        readFixture(
          root,
          'packages/web/src/games/demoproto/room/demoprotoRoomCommandFailureMessage.ts',
        ).includes('notHostRetrySettle'),
        'retry failure copy',
      );
      if (!capabilities.identityViewing) {
        assert.ok(roomHook.includes('isOverdue'), 'stage hook exposes isOverdue');
        assert.ok(
          clientGameDir.includes('StageSettleRescue'),
          'stage area renders the shared rescue UI',
        );
        assert.ok(
          clientGameDir.includes(`'demoproto.phase.retrySettle'`),
          'stage area submits the retry',
        );
      } else {
        assert.ok(!roomHook.includes('isOverdue'), 'hybrid hook has no rescue wiring');
        assert.ok(!clientGameDir.includes('StageSettleRescue'), 'hybrid client has no rescue UI');
      }
    } else {
      assert.ok(!engineGameDir.includes('deadlineAt'));
      assert.ok(!engineGameDir.includes('retrySettle'), 'no-deadline engine has no retry command');
      assert.ok(!clientGameDir.includes('retrySettle'), 'no-deadline client has no retry wiring');
      assert.ok(
        !clientGameDir.includes('StageSettleRescue'),
        'no-deadline client has no rescue UI',
      );
    }
    if (capabilities.audioOrchestration) {
      assert.ok(engineGameDir.includes('demoproto.audio.ack'));
    } else {
      // The audio wiring is segment-gated end to end: a pack that
      // declares it off must not leak a single audio marker into the
      // generated engine or client (the capabilities contract welds
      // the declaration to exactly this source evidence).
      assert.ok(!engineGameDir.includes('audio.ack'), 'audio-off engine has no ack command');
      assert.ok(
        !engineGameDir.includes('pendingAudioEffects'),
        'audio-off engine has no audio queue fields',
      );
      assert.ok(
        !clientGameDir.includes('applyAudioPlaybackLock'),
        'audio-off client has no audio playback lock',
      );
      assert.ok(
        !clientGameDir.includes('AudioOrchestration'),
        'audio-off client has no audio binding',
      );
    }
  });
}

test('audioOrchestration segments render the full audio wiring when on and nothing when off', () => {
  // No shipped pack declares audioOrchestration (narration is a
  // per-game choice, not an archetype trait), so the on-state cannot
  // be reached through generateNewGame's preset table. Prove the
  // segment at the layer it lives in instead: render the whole
  // template tree with the identity pack's record, once with the
  // capability flipped on and once off, applying the same whole-file
  // gates and destination rendering the generator uses.
  const names = deriveGameNames('demoproto');
  const extraTokens = {
    __GAME_DISPLAY_NAME__: '演示原型',
    __GAME_SUBTITLE__: '生成器自证用临时游戏',
    __GAME_ICON_NAME__: 'game-controller-outline',
    __GAME_ICON_COMPONENT__: 'IconGameControllerOutline',
    __GAME_TIER__: 'mini',
    __GAME_PRESET__: 'identity',
    __GAME_COMPLETION_TYPE__: 'DemoprotoCompletionPayload | ',
    __GAME_REQUIREMENT_COUNT__: '11',
    __GAME_TEST_BEGIN__: 'viewAllAndBegin(session);',
  };
  const baseRecord = {
    ...PRESET_CAPABILITIES.identity,
    ...PACK_SEGMENT_SWITCHES.identity,
    businessStats: true,
  };
  const renderTree = (capabilities) => {
    const rendered = new Map();
    for (const layer of ['shared', 'game']) {
      const layerDir = path.join(REPO_ROOT, 'scripts/lib/new-game/templates', layer);
      const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const entryPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            walk(entryPath);
          } else if (entry.name.endsWith('.tmpl')) {
            const relative = path.relative(layerDir, entryPath).slice(0, -'.tmpl'.length);
            const gate = FILE_CAPABILITY_GATES[relative];
            if (gate !== undefined && capabilities[gate] !== true) continue;
            const destination = renderTemplateFile(relative.split(path.sep).join('/'), {
              names,
              capabilities,
              extraTokens,
            });
            rendered.set(
              destination,
              renderTemplateFile(fs.readFileSync(entryPath, 'utf8'), {
                names,
                capabilities,
                extraTokens,
              }),
            );
          }
        }
      };
      walk(layerDir);
    }
    return rendered;
  };

  const hookFile = 'packages/web/src/games/demoproto/room/hooks/useDemoprotoAudioOrchestration.ts';
  const on = renderTree({ ...baseRecord, audioOrchestration: true });
  const off = renderTree({ ...baseRecord, audioOrchestration: false });

  // The whole-file gate is the only file-set difference.
  assert.ok(on.has(hookFile), 'audio-on render includes the binding hook file');
  assert.ok(!off.has(hookFile), 'audio-off render excludes the binding hook file');
  assert.deepEqual(
    [...on.keys()].filter((file) => !off.has(file)),
    [hookFile],
  );
  assert.deepEqual(
    [...off.keys()].filter((file) => !on.has(file)),
    [],
  );

  const onUnion = [...on.values()].join('\n');
  const wiringMarkers = [
    // Engine state slice + strict parse of the queue.
    'pendingAudioEffects',
    'isAudioPlaying: state.isAudioPlaying',
    // Ack command across commands/types, engine decide and worker schemas.
    `'demoproto.audio.ack'`,
    // Queue/clear events and their evolve landing on the shared machine.
    `'demoproto.audio.queued'`,
    `'demoproto.audio.cleared'`,
    'queueAudioBatch(',
    'acknowledgeAudioQueue(',
    // The platform gate guard at the returnToLobby wiring point.
    'guardAudioPlayback(',
    // Per-game audio reasons and their client failure copy.
    `audioPlaying: 'demoproto_audio_playing'`,
    `notHostAckAudio: 'demoproto_not_host_ack_audio'`,
    '播报尚未结束，请稍候',
    // Client playback lock at the room-state assembly exit.
    'applyAudioPlaybackLock(',
    'DEMOPROTO_AUDIO_LOCK_EXEMPT_ACTION_KEYS',
    // Orchestrator binding call in the room-state hook.
    'useDemoprotoAudioOrchestration(',
    // The generated engine test segment for the queue/ack/gate chain.
    `describe('Demoproto audio queue and ack'`,
  ];
  for (const marker of wiringMarkers) {
    assert.ok(onUnion.includes(marker), `audio-on render is missing wiring marker: ${marker}`);
  }
  assert.ok(
    on
      .get('packages/game-engine/src/games/demoproto/engine.ts')
      .includes('audioOrchestration: true'),
    'audio-on engine declares the capability true',
  );

  const offUnion = [...off.values()].join('\n');
  for (const marker of wiringMarkers) {
    assert.ok(!offUnion.includes(marker), `audio-off render leaks wiring marker: ${marker}`);
  }
  assert.ok(
    off
      .get('packages/game-engine/src/games/demoproto/engine.ts')
      .includes('audioOrchestration: false'),
    'audio-off engine declares the capability false',
  );
  assert.ok(
    off
      .get('packages/web/src/games/demoproto/room/demoprotoRoomAdapter.ts')
      .includes('isAudioPlaying: false'),
    'audio-off shell explicitly declares no narration',
  );

  const root = makeRealRepoCopy();
  try {
    generateNewGame({ rootDir: root, gameId: 'demoproto', preset: 'identity' });
    for (const [file, content] of on) {
      const destination = path.join(root, file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content);
    }
    for (const project of [
      'packages/web/tsconfig.json',
      'packages/game-engine/tsconfig.test.json',
    ]) {
      typecheckFixture(root, project);
    }
    execFileSync(
      process.execPath,
      [resolveVitestBin(root, 'packages/web'), 'run', 'src/games/demoproto'],
      { cwd: path.join(root, 'packages/web'), stdio: 'pipe', encoding: 'utf8' },
    );
    execFileSync(
      process.execPath,
      [resolveVitestBin(root, 'packages/game-engine'), 'run', 'src/games/demoproto'],
      { cwd: path.join(root, 'packages/game-engine'), stdio: 'pipe', encoding: 'utf8' },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('counts share generator facts and numbering does not confuse physical and registration migrations', () => {
  const facts = generatorFacts();
  assert.deepEqual(facts.sharedFiles, SHARED_FILES);
  const files = fs
    .readdirSync(path.join(REPO_ROOT, 'packages/api-worker/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({
      name,
      content: readFixture(REPO_ROOT, `packages/api-worker/migrations/${name}`),
    }));
  assert.equal(findLatestRegistrationMigration(files).name, '0065_demo.sql');
  assert.equal(
    nextMigrationName(['0075_physical.sql', '0065_demo.sql', '0070_physical.sql'], 'probe'),
    '0076_probe.sql',
  );
  for (const preset of Object.keys(PRESET_CAPABILITIES)) {
    assert.equal(facts.filesByPreset[preset], expectedCreatedFiles('probe', preset).length + 1);
  }
});

test('new formal games cannot disable stats, even when non-production or demo-hybrid', () => {
  const root = makeFixtureRepo();
  for (const preset of Object.keys(PRESET_CAPABILITIES)) {
    assert.throws(
      () =>
        generateNewGame({
          rootDir: root,
          gameId: 'probe',
          preset,
          businessStats: false,
        }),
      /only for non-production demo reference/,
    );
  }
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demo',
        preset: 'demo-hybrid',
        production: true,
        businessStats: false,
      }),
    /only for non-production demo reference/,
  );
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/probe')), false);
});

test('consecutive registrations copy rebuilds but never the preceding game owned stats table', () => {
  const root = makeFixtureRepo();
  const first = generateNewGame({ rootDir: root, gameId: 'firstprobe', preset: 'stage' });
  const second = generateNewGame({ rootDir: root, gameId: 'secondprobe', preset: 'identity' });
  const migration = readFixture(root, `packages/api-worker/migrations/${second.migrationName}`);
  assert.ok(migration.includes(`from ${first.migrationName}`));
  assert.ok(migration.includes('CREATE TABLE secondprobe_user_stats'));
  assert.ok(!migration.includes('CREATE TABLE firstprobe_user_stats'));
  const checks = [...migration.matchAll(/game_type IN \(([^)]*)\)/g)];
  assert.ok(checks.length >= 2);
  for (const [, list] of checks) {
    assert.ok(list.includes("'firstprobe'"));
    assert.ok(list.includes("'secondprobe'"));
  }
});

test('stale registration CHECK lists fail before any generated file is written', () => {
  assert.doesNotThrow(() =>
    assertRegistrationGameTypes("game_type IN ('demo', 'werewolf')", ['werewolf', 'demo']),
  );
  assert.throws(
    () =>
      assertRegistrationGameTypes("game_type IN ('werewolf', 'demo', 'demo')", [
        'werewolf',
        'demo',
      ]),
    /does not match the canonical game set/,
  );
  assert.throws(
    () =>
      assertRegistrationGameTypes("game_type IN ('werewolf', 'demo')", [
        'werewolf',
        'demo',
        'probe',
      ]),
    /does not match the canonical game set/,
  );
  const root = makeFixtureRepo();
  const file = path.join(root, 'packages/api-worker/migrations/0065_demo.sql');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll(", 'demo'", ''));
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'probe', preset: 'stage' }),
    /does not match the canonical game set/,
  );
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/probe')), false);
});

test('production: true registers the new game as production and reports the list-only go-live step', () => {
  const root = makeFixtureRepo();
  const summary = generateNewGame({
    rootDir: root,
    gameId: 'demoproto',
    preset: 'identity',
    production: true,
  });
  const registry = readFixture(root, 'packages/game-engine/src/games/registry.ts');
  const entryStart = registry.indexOf('demoproto: {');
  const demoprotoEntry = registry.slice(entryStart, registry.indexOf('\n  },', entryStart));
  assert.ok(
    demoprotoEntry.includes('isProduction: true'),
    '--production generation registers the new game as production',
  );
  const report = readFixture(root, summary.reportPath);
  assert.ok(
    report.includes('上线（同步绊线名单）'),
    'production report carries the list-only step',
  );
  assert.ok(report.includes('homeProductionFilter'), 'list-only step names the tripwire list');
});

test('generated output passes format, lint, typecheck, engine and client tests with tooling present', (t) => {
  // The fixture-repo cases above structurally cannot catch shaping
  // defects: without node_modules both shaping passes skip silently.
  // This case generates in a copy of the real tree (dependencies
  // symlinked in; see makeRealRepoCopy) so prettier and eslint --fix
  // really run. The probe id's PascalCase name sorts ahead of fixed
  // identifier prefixes (Aaprobe before e.g. handle/commit), so
  // simple-import-sort must reorder import/export members — the exact
  // input that used to leave unformatted text behind when the lint
  // pass ran after the format pass with nothing re-formatting after.
  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules', 'prettier'))) {
    t.skip('requires installed dependencies (node_modules)');
    return;
  }
  // Every preset must pass: the three packs render different segment
  // combinations out of the one template tree, so each one's shaping
  // is only proven in the real tree.
  for (const preset of ['identity', 'stage', 'demo-hybrid']) {
    const root = makeRealRepoCopy();
    try {
      const summary = generateNewGame({ rootDir: root, gameId: 'aaprobe', preset });
      assert.equal(summary.formatted, true, `prettier pass must run, not skip (${preset})`);
      const require = createRequire(path.join(root, 'package.json'));
      const prettierBin = require.resolve('prettier/bin/prettier.cjs');
      // Same scope the generator's format pass claims: formattable
      // extensions, templates excluded (their rendered outputs are the
      // other entries in the list).
      const formatTargets = summary.createdFiles.filter(
        (file) => /\.(?:ts|tsx|js|mjs|json|md|css)$/.test(file) && !file.endsWith('.tmpl'),
      );
      execFileSync(process.execPath, [prettierBin, '--check', ...formatTargets], {
        cwd: root,
        stdio: 'pipe',
      });
      const eslintBin = path.join(
        path.dirname(require.resolve('eslint/package.json')),
        'bin',
        'eslint.js',
      );
      const lintTargets = summary.createdFiles.filter((file) => /\.(?:ts|tsx)$/.test(file));
      execFileSync(process.execPath, [eslintBin, '--max-warnings', '0', ...lintTargets], {
        cwd: root,
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=4096']
            .filter(Boolean)
            .join(' '),
        },
      });
      for (const project of [
        'packages/web/tsconfig.json',
        'packages/game-engine/tsconfig.test.json',
        'packages/api-worker/tsconfig.json',
      ]) {
        typecheckFixture(root, project);
      }
      // The generated web tests (guidance matrix, review, failure copy)
      // render a different begin path per pack, so each pack proves its
      // own rendering by running them, and its registrations through the
      // web contracts the generator edited.
      execFileSync(
        process.execPath,
        [resolveVitestBin(root, 'packages/web'), 'run', 'src/games/aaprobe', 'src/__tests__'],
        { cwd: path.join(root, 'packages/web'), stdio: 'pipe', encoding: 'utf8' },
      );
      execFileSync(
        process.execPath,
        [
          resolveVitestBin(root, 'packages/game-engine'),
          'run',
          'src/games/aaprobe',
          'src/platform/__tests__/phaseDeadlineVariants.contract.test.ts',
          'src/platform/__tests__/gameRegistry.contract.test.ts',
        ],
        {
          cwd: path.join(root, 'packages/game-engine'),
          stdio: 'pipe',
          encoding: 'utf8',
        },
      );
      execFileSync(
        process.execPath,
        [resolveVitestBin(root, 'packages/api-worker'), 'run', 'src/games/aaprobe'],
        { cwd: path.join(root, 'packages/api-worker'), stdio: 'pipe', encoding: 'utf8' },
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

/** Remove one exact text fragment from a copied file; fail loudly when absent. */
function removeExactText(root, file, text) {
  const target = path.join(root, file);
  const content = fs.readFileSync(target, 'utf8');
  if (!content.includes(text)) throw new Error(`strip anchor missing in ${file}`);
  fs.writeFileSync(target, content.replace(text, ''));
}

/** Remove the lines from `startLine` through the next exact `endLine`, inclusive. */
function removeEntryBlock(root, file, startLine, endLine) {
  const target = path.join(root, file);
  const lines = fs.readFileSync(target, 'utf8').split('\n');
  const start = lines.findIndex((line) => line === startLine);
  if (start === -1) throw new Error(`strip block start missing in ${file}: ${startLine}`);
  const end = lines.findIndex((line, index) => index > start && line === endLine);
  if (end === -1) throw new Error(`strip block end missing in ${file}: ${endLine}`);
  lines.splice(start, end - start + 1);
  fs.writeFileSync(target, lines.join('\n'));
}

/** The shipped demo registration migration; the fixture world is frozen at its number. */
const DEMO_REGISTRATION_MIGRATION = '0065_demo.sql';

/**
 * Strip the shipped demo out of a real-repo copy so the generator
 * accepts the id again: its product files, its registration migration
 * and every shared-file registration entry. The fixture must also
 * lose every migration newer than demo's own registration: the
 * generator numbers the next migration max+1 and derives it from the
 * latest registration migration, so the regenerated demo migration
 * lands on demo's number and reproduces the shipped file only in the
 * repo world as it was when demo was generated.
 */
function stripShippedDemo(root) {
  const migrationsDir = path.join(root, 'packages/api-worker/migrations');
  if (!fs.existsSync(path.join(migrationsDir, DEMO_REGISTRATION_MIGRATION))) {
    throw new Error(`strip demo migration missing: ${DEMO_REGISTRATION_MIGRATION}`);
  }
  const demoNumber = Number.parseInt(DEMO_REGISTRATION_MIGRATION.slice(0, 4), 10);
  for (const dir of [
    'packages/game-engine/src/games/demo',
    'packages/api-worker/src/games/demo',
    'packages/web/src/games/demo',
  ]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  }
  for (const file of [
    'docs/demo-game-design.md',
    'e2e/specs/demo.spec.ts.tmpl',
    `packages/api-worker/migrations/${DEMO_REGISTRATION_MIGRATION}`,
    'packages/web/src/test-utils/demoState.ts',
  ]) {
    fs.rmSync(path.join(root, file), { force: true });
  }
  // Migrations newer than demo's own registration postdate the world
  // the shipped demo was generated in. Leaving any of them in would
  // renumber the regenerated demo migration (0067 once 0066 exists)
  // and, once a newer registration migration lands, change its
  // derivation source too — either breaks the byte-exact comparison
  // against the shipped file. Strip them so the fixture is the repo
  // as it was when demo was generated.
  for (const name of fs.readdirSync(migrationsDir)) {
    const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
    if (match !== null && Number.parseInt(match[1], 10) > demoNumber) {
      fs.rmSync(path.join(migrationsDir, name), { force: true });
    }
  }
  removeExactText(root, 'packages/game-engine/src/platform/protocol/gameTypes.ts', "  'demo',\n");
  removeEntryBlock(root, 'packages/game-engine/src/games/registry.ts', '  demo: {', '  },');
  removeEntryBlock(
    root,
    'packages/game-engine/src/platform/__tests__/phaseDeadlineVariants.contract.test.ts',
    '  demo: {',
    '  },',
  );
  removeExactText(
    root,
    'packages/game-engine/src/product/rewards/earnings.ts',
    '  // TODO(new-game): confirm the completion reward amounts for demo.\n' +
      '  demo: { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 },\n',
  );
  removeEntryBlock(
    root,
    'packages/game-engine/package.json',
    '    "./games/demo/public": {',
    '    },',
  );
  removeExactText(
    root,
    'packages/game-engine/src/platform/__tests__/architecture.contract.test.ts',
    "  './games/demo/public',\n",
  );
  removeExactText(
    root,
    'packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts',
    "      'demo',\n",
  );
  removeExactText(
    root,
    'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
    "import { demoEngine } from '../../../games/demo/engine';\n",
  );
  const contractsFile = path.join(
    root,
    'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
  );
  const contractsLines = fs.readFileSync(contractsFile, 'utf8').split('\n');
  const keptLines = contractsLines.filter((line) => !line.includes('demo: demoEngine,'));
  if (contractsLines.length - keptLines.length !== 5) {
    throw new Error('expected exactly five demo catalog entries in contracts.test.ts');
  }
  fs.writeFileSync(contractsFile, keptLines.join('\n'));
  removeEntryBlock(
    root,
    'packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts',
    '  demo: {',
    '  },',
  );
  removeExactText(
    root,
    'packages/game-engine/src/games/catalog.ts',
    "import { demoEngine } from './demo/engine';\n",
  );
  removeExactText(root, 'packages/game-engine/src/games/catalog.ts', '  demo: demoEngine,\n');
  removeExactText(
    root,
    'packages/api-worker/src/games/catalog.ts',
    "import { demoWorkerModule } from './demo/module';\n",
  );
  removeExactText(
    root,
    'packages/api-worker/src/games/catalog.ts',
    '  demo: registerWorkerGameModule(demoWorkerModule),\n',
  );
  removeExactText(
    root,
    'packages/web/src/games/catalog.ts',
    "import { demoHome } from '@/games/demo/home';\n",
  );
  removeExactText(root, 'packages/web/src/games/catalog.ts', '  demo: { home: demoHome },\n');
  removeExactText(
    root,
    'packages/web/src/games/clientModules.tsx',
    '  demo: createDemoClientModule,\n',
  );
  removeExactText(
    root,
    'packages/web/src/games/clientModules.tsx',
    "import { createDemoClientModule } from '@/games/demo/module';\n",
  );
  removeExactText(
    root,
    'packages/web/src/games/clientModules.tsx',
    "    demo: cacheLoad(() => loadModule('demo')),\n",
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/botDispatchDiscipline.contract.test.ts',
    "  demo: ['games/demo/room/hooks/useDemoRoomState.ts'],\n",
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts',
    "import { DEMO_GUIDANCE_MATRIX } from '@/games/demo/room/demoGuidanceMatrix';\n",
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts',
    '  demo: DEMO_GUIDANCE_MATRIX,\n',
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/roomReview.contract.test.ts',
    "import { demoReview } from '@/games/demo/review/demoReview';\n",
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/roomReview.contract.test.ts',
    "import { DEMO_REVIEW_ROUNDS } from '@/test-utils/demoState';\n",
  );
  removeExactText(
    root,
    'packages/web/src/__tests__/roomReview.contract.test.ts',
    '  demo: reviewCase(demoReview, DEMO_REVIEW_ROUNDS),\n',
  );
}

/**
 * Pinned demo compare exceptions (G-5): the shipped demo is the
 * finalized instance of the skeleton, so a handful of texts are
 * deliberately ahead of the templates — the design doc records the
 * preset it was originally generated with, three documentation blocks
 * carry demo's finalized facts where the templates keep TODO
 * fill-ins, and two registration entries carry hand completions.
 * Each entry rewrites the shipped text into the regenerated text;
 * after rewriting, the files must be byte-identical. An entry whose
 * text no longer matches fails the case, so this list only shrinks.
 */
const DEMO_COMPARE_EXCEPTIONS = [
  {
    file: 'docs/demo-game-design.md',
    body: '> 状态：骨架（由 `pnpm new-game demo --preset identity` 生成，待设计定稿）',
    generated: '> 状态：骨架（由 `pnpm new-game demo --preset demo-hybrid` 生成，待设计定稿）',
  },
  {
    file: 'docs/demo-game-design.md',
    body: '> 原型预设：identity',
    generated: '> 原型预设：demo-hybrid',
  },
  {
    file: 'packages/game-engine/src/games/demo/domain/rules.ts',
    body: [
      '/**',
      ' * The demo playing stage is an idle stage: it opens when the host',
      ' * begins the game and settles when this deadline expires through the',
      ' * scheduled `demo.settle.due` effect (the #162 delivery form). The',
      ' * duration only exists so the full chain has a real stage deadline to',
      ' * arm, deliver and settle against.',
      ' */',
    ].join('\n'),
    generated: [
      '// TODO(gameplay): 骨架舞台时长占位（毫秒）。真实阶段链落地时，每个阶段的',
      '// 时长在本文件按阶段定义，开始阶段时按当前阶段取值算 deadlineAt。',
    ].join('\n'),
  },
  {
    file: 'packages/game-engine/src/games/demo/engine.ts',
    body: [
      ' * 终局接缝。玩法状态机判定出胜负时从这里收口：',
      ' * 一次性发 game.ended 事件 + 结算 effect（xpSettled 防重复）。',
      ' * demo 没有玩法判定，触发点就是阶段截止：`demo.phase.settleExpired`',
      ' * 过门后转调本函数（engine.test.ts 已钉住本接缝的结算形状，不许改形状）。',
    ].join('\n'),
    generated: [
      ' * TODO(gameplay): 终局接缝。玩法状态机判定出胜负时从这里收口：',
      ' * 一次性发 game.ended 事件 + 结算 effect（xpSettled 防重复）。',
      ' * 骨架阶段由阶段到期结算直接终局——玩法填空时把触发点挂到本函数上',
      ' * （engine.test.ts 已钉住本接缝的结算形状，填空后不许改形状）。',
    ].join('\n'),
  },
  {
    file: 'packages/web/src/games/demo/room/demoGuidanceMatrix.ts',
    body: [
      '/**',
      ' * Demo（生成器样例游戏）（阶段 × 观看者）底部提示矩阵声明：逐格事实以',
      ' * demoGuidanceMatrix.test.ts 用真实引擎流驱动 createDemoRoomShellModel',
      ' * 对账为准。模板生成的游戏以本表为起点声明各自矩阵。',
      ' */',
    ].join('\n'),
    generated: [
      '/**',
      ' * Demo（阶段 × 观看者）底部提示矩阵声明：本表是新游戏的起点声明——',
      ' * 每格要么承诺该阶段入口态底部有一句提示，要么登记豁免理由（指出由哪个',
      ' * 表面承载引导）。生成器已把本表登记进 packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts',
      ' * 的注册表，并生成 demoGuidanceMatrix.test.ts 用真实引擎流驱动本游戏的',
      ' * shell model 逐格对账；玩法阶段落地时两者同步改。',
      ' */',
    ].join('\n'),
  },
  {
    file: 'packages/web/src/games/demo/room/demoGuidanceMatrix.ts',
    body: '玩法阶段界面在 stage 区（模板占位面）',
    generated: '玩法阶段界面在 stage 区',
    occurrences: 3,
  },
  {
    file: 'packages/game-engine/src/games/registry.ts',
    body: [
      '    // Reference game for template regression (plan §7.1 / D8): fully',
      '    // registered through the real path, never shipped to players — the',
      '    // client lobby/create surfaces filter on this flag.',
      '',
    ].join('\n'),
    generated: '',
  },
];

/** Files that live in the shipped demo but are never generator products. */
const DEMO_BODY_ONLY_FILES = [
  'packages/api-worker/src/games/demo/__tests__/effects.test.ts',
  'packages/game-engine/src/games/demo/__tests__/fullChain.test.ts',
  'packages/game-engine/src/games/demo/__tests__/roomCommands.contract.test.ts',
];

function applyDemoCompareExceptions(file, bodyText, consumed) {
  let text = bodyText;
  for (const exception of DEMO_COMPARE_EXCEPTIONS) {
    if (exception.file !== file) continue;
    const occurrences = text.split(exception.body).length - 1;
    assert.equal(
      occurrences,
      exception.occurrences ?? 1,
      `${file}: pinned compare exception must match the shipped text exactly ${exception.occurrences ?? 1} time(s)`,
    );
    text = text.split(exception.body).join(exception.generated);
    consumed.add(exception);
  }
  return text;
}

test('regenerating demo with the demo-hybrid pack reproduces the shipped demo', (t) => {
  // Same tooling requirement as the format/lint case above: the
  // comparison is byte-exact, so the prettier/eslint shaping passes
  // must really run inside the copy.
  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules', 'prettier'))) {
    t.skip('requires installed dependencies (node_modules)');
    return;
  }
  const root = makeRealRepoCopy();
  try {
    stripShippedDemo(root);
    const summary = generateNewGame({
      rootDir: root,
      gameId: 'demo',
      preset: 'demo-hybrid',
      displayName: 'Demo',
      subtitle: '模板参照游戏',
      iconName: 'game-controller-outline',
      tier: 'mini',
      businessStats: false,
    });
    const consumed = new Set();
    for (const file of [...summary.createdFiles, ...summary.editedFiles]) {
      const generated = readFixture(root, file);
      const body = applyDemoCompareExceptions(file, readFixture(REPO_ROOT, file), consumed);
      assert.equal(body, generated, `${file} drifted from the demo-hybrid regeneration`);
    }
    assert.equal(
      consumed.size,
      DEMO_COMPARE_EXCEPTIONS.length,
      'every pinned demo compare exception must be consumed; an unconsumed exception means the drift is gone and the whitelist must shrink',
    );
    const created = new Set(summary.createdFiles);
    const bodyOnly = [];
    const collectBodyOnly = (dir, relative) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = `${relative}/${entry.name}`;
        if (entry.isDirectory()) collectBodyOnly(path.join(dir, entry.name), rel);
        else if (!created.has(rel)) bodyOnly.push(rel);
      }
    };
    for (const dir of [
      'packages/game-engine/src/games/demo',
      'packages/api-worker/src/games/demo',
      'packages/web/src/games/demo',
    ]) {
      collectBodyOnly(path.join(REPO_ROOT, dir), dir);
    }
    assert.deepEqual(bodyOnly.sort(), DEMO_BODY_ONLY_FILES);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refuses to generate the same game id twice', () => {
  const root = makeFixtureRepo();
  generateNewGame({ rootDir: root, gameId: 'demoproto', preset: 'identity' });
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demoproto', preset: 'stage' }),
    /already registered/,
  );
});

test('refuses an existing game id from the shipped catalog', () => {
  const root = makeFixtureRepo();
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'avalon', preset: 'identity' }),
    /already/,
  );
});

test('rejects invalid game ids and presets before writing anything', () => {
  const root = makeFixtureRepo();
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'Demo', preset: 'identity' }),
    /Invalid game id/,
  );
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demo', preset: 'weird' }),
    /Invalid preset/,
  );
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/demo')));
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/Demo')));
});

test('orders contracts.test.ts imports by module specifier, not binding name', () => {
  // Regression: shipped engines bind names that differ from their paths
  // (drawGuessEngine at ./drawguess, fibEngine at ./fibking). Sorting
  // whole lines would park a new import after the wrong neighbour for
  // ids like storya/drawa/fiba; specifier order is what the repo's
  // simple-import-sort expects.
  const source = readFixture(
    REPO_ROOT,
    'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
  );
  for (const gameId of ['storya', 'drawa', 'fiba']) {
    const edited = editEngineContractsTest(source, { gameId, camel: gameId });
    const specifiers = [
      ...edited.matchAll(/from '(\.\.\/\.\.\/\.\.\/games\/[a-z0-9]+\/engine)'/g),
    ].map((match) => match[1]);
    assert.deepEqual(specifiers, [...specifiers].sort(), `import order for ${gameId}`);
    assert.ok(specifiers.some((specifier) => specifier.endsWith(`/games/${gameId}/engine`)));
  }
});

test('refuses to overwrite a pre-existing target file', () => {
  const root = makeFixtureRepo();
  const target = path.join(root, 'docs/demoproto-game-design.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'hand-written, do not clobber');
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demoproto', preset: 'identity' }),
    /Refusing to overwrite existing file/,
  );
  assert.equal(readFixture(root, 'docs/demoproto-game-design.md'), 'hand-written, do not clobber');
});

test('rejects display strings that would break out of generated literals', () => {
  const root = makeFixtureRepo();
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demoproto',
        preset: 'identity',
        displayName: "坏'名字",
      }),
    /Invalid --name/,
  );
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demoproto',
        preset: 'identity',
        iconName: 'GameController',
      }),
    /Invalid --icon/,
  );
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/demoproto')));
});
