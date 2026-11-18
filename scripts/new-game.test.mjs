/**
 * Generator tests: run the real generator against a fixture repository
 * assembled from the real shared files it edits, across capability selections.
 * A real-tree copy validates formatting, lint, web/engine/Worker types,
 * generated game tests and registration contracts across every valid
 * capability selection. Run with
 * `node --test scripts/new-game.test.mjs` (also wrapped by
 * contracts/newGameGenerator.contract.test.ts in the root vitest suite).
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { editEngineContractsTest } from './lib/new-game/edits.mjs';
import {
  CAPABILITY_KEYS,
  FILE_CAPABILITY_GATES,
  generateNewGame,
  generatorFacts,
  selectCapabilities,
  SHARED_EDITS,
} from './lib/new-game/generate.mjs';
import {
  assertRegistrationGameTypes,
  buildRegistrationMigration,
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
  const root = fs.mkdtempSync(path.join(REPO_ROOT, '.new-game-fixture-'));
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
  const root = fs.mkdtempSync(path.join(REPO_ROOT, '.new-game-real-repo-'));
  fixtureRoots.add(root);
  for (const name of fs.readdirSync(REPO_ROOT)) {
    if (
      name === '.git' ||
      name === 'assets' ||
      name.startsWith('.new-game-') ||
      name === 'node_modules'
    ) {
      continue;
    }
    const sourcePath = path.join(REPO_ROOT, name);
    fs.cpSync(sourcePath, path.join(root, name), {
      recursive: true,
      filter: (source) =>
        !path.relative(REPO_ROOT, source).split(path.sep).includes('node_modules'),
    });
  }
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
 * the selections that enable the capability.
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

function expectedCreatedFiles(gameId, selectedCapabilities) {
  const capabilities = selectCapabilities(selectedCapabilities);
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
    `${client}/assets/roleAvatars.ts`,
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
    if (capabilities[addition.capability]) {
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
  assert.equal(
    applyCapabilityBlocks(
      '//#cap identityViewing\nview\n//#cap stageDeadline\nboth\n//#end\n//#end',
      capabilities,
    ),
    'view',
  );
  assert.equal(
    applyCapabilityBlocks(
      '//#cap identityViewing\nview\n//#cap stageDeadline\nboth\n//#end\n//#end',
      { identityViewing: true, stageDeadline: true },
    ),
    'view\nboth',
  );
  assert.throws(() => applyCapabilityBlocks('//#end', capabilities), /without a start marker/);
  assert.throws(
    () => applyCapabilityBlocks('//#cap identityViewing\nx', capabilities),
    /Unterminated capability block/,
  );
});

const CAPABILITY_SCENARIOS = Array.from(
  { length: 2 ** CAPABILITY_KEYS.length },
  (_, selectionMask) => CAPABILITY_KEYS.filter((_, index) => (selectionMask & (1 << index)) !== 0),
)
  .filter(
    (selected) => !selected.includes('botBulkViewing') || selected.includes('identityViewing'),
  )
  .map((selected) => ({
    name:
      selected.length === 0
        ? 'all capabilities off'
        : selected.length === CAPABILITY_KEYS.length
          ? 'all capabilities on'
          : selected.join(' + '),
    selected,
  }));

test('capability selection defaults off and requires identity viewing for bot bulk viewing', () => {
  assert.deepEqual(selectCapabilities([]), {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botBulkViewing: false,
  });
  for (const key of CAPABILITY_KEYS.filter((candidate) => candidate !== 'botBulkViewing')) {
    const selected = selectCapabilities([key]);
    assert.equal(selected[key], true, `${key} can be selected independently`);
    for (const other of CAPABILITY_KEYS.filter((candidate) => candidate !== key)) {
      assert.equal(selected[other], false, `${other} remains off when selecting ${key}`);
    }
  }
  assert.equal(selectCapabilities(['identityViewing', 'botBulkViewing']).botBulkViewing, true);
  assert.throws(() => selectCapabilities(['botBulkViewing']), /requires "identityViewing"/);
  assert.throws(() => selectCapabilities(['unknownCapability']), /Invalid capability/);
});

for (const scenario of CAPABILITY_SCENARIOS) {
  test(`generates the complete skeleton with ${scenario.name} and wires every registration point`, () => {
    const root = makeFixtureRepo();
    const summary = generateNewGame({
      rootDir: root,
      gameId: 'demoproto',
      capabilities: scenario.selected,
      displayName: '演示原型',
      subtitle: '生成器自证用临时游戏',
    });

    // File-list completeness (the plan §4 checklist).
    assert.deepEqual(
      summary.createdFiles.filter((file) => !file.includes('/migrations/')),
      expectedCreatedFiles('demoproto', scenario.selected),
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
    const designDoc = readFixture(root, 'docs/demoproto-game-design.md');
    assert.ok(!designDoc.includes('--preset'), 'generated design doc uses the capability API');
    assert.ok(!designDoc.includes('原型预设'), 'generated design doc has no preset label');
    assert.ok(designDoc.includes('启用能力：'));
    for (const key of new Set(scenario.selected)) {
      assert.ok(designDoc.includes(`--capability ${key}`), `design command includes ${key}`);
    }
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

    // The contract expectation row and engine declaration must carry
    // exactly the independently selected capability values.
    const capabilities = selectCapabilities(scenario.selected);
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
    // The TODO_IDENTITY follow-up note rides on the identityViewing capability.
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

    // Wiring markers the capability welds depend on.
    const engineGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/game-engine/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    const clientGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/web/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    if (capabilities.botBulkViewing) {
      assert.ok(engineGameDir.includes('demoproto.bots.markAllBotsViewed'));
      assert.ok(clientGameDir.includes('demoproto.bots.markAllBotsViewed'));
    } else {
      assert.ok(!engineGameDir.includes('demoproto.bots.markAllBotsViewed'));
      assert.ok(!clientGameDir.includes('demoproto.bots.markAllBotsViewed'));
    }
    // Every generated game wires the review end to end: the module declares the
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
      const screenSource = readFixture(
        root,
        'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx',
      );
      assert.ok(
        screenSource.includes('<BoardInfoCard'),
        'identity games use the shared board card',
      );
      assert.ok(
        screenSource.includes('collapsed={!isLobby}'),
        'board defaults collapse after dealing',
      );
      assert.ok(screenSource.includes('<RoleCardDialog'), 'public board roles remain previewable');
      assert.ok(!screenSource.includes("kind: 'workspace'"), 'identity games keep the seat board');
      assert.ok(!screenSource.includes('StageArea'), 'no parallel identity-stage action surface');
      assert.ok(
        !screenSource.includes('resolveViewIdentityAction'),
        'identity actions stay in the bottom model',
      );
    } else {
      assert.ok(!clientGameDir.includes('RevealRoleCardModal'));
      const screenSource = readFixture(
        root,
        'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx',
      );
      assert.ok(
        screenSource.includes("kind: 'workspace'"),
        'non-identity games retain their workspace',
      );
      assert.ok(
        !screenSource.includes('<BoardInfoCard'),
        'no invented role board for non-identity games',
      );
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
      // generated hook is countdown-only: it calls
      // useStageDeadline with the deadline alone and exposes
      // remainingSeconds for display. If the countdown block were
      // silently dropped from the assembled hook, these assertions
      // fail with it. Identity viewing keeps the countdown available
      // after the host begins play.
      const roomHook = readFixture(
        root,
        'packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts',
      );
      assert.ok(roomHook.includes('useStageDeadline({'), 'rendered hook calls useStageDeadline');
      assert.ok(!roomHook.includes('shouldExpire'), 'rendered hook has no expire gate');
      assert.ok(!roomHook.includes('onExpire'), 'rendered hook has no expire dispatch');
      assert.ok(!roomHook.includes('attemptKey'), 'rendered hook has no single-shot key');
      assert.ok(!roomHook.includes('phase.expire'), 'rendered hook never dispatches expire');
      assert.ok(roomHook.includes('remainingSeconds'), 'rendered hook exposes the countdown');
      // The public expire command and unused phase.expired event are
      // absent; internal settlement runs through the terminal seam.
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
      // schema, gated host-first in decide; the room
      // hook exposes isOverdue and the stage area renders the shared
      // rescue UI independently of identity viewing.
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
      assert.ok(!engineSource.includes('guardPhaseExpiry'));
      assert.ok(!engineSource.includes('settleExpired'));
      assert.ok(
        !engineSource.includes(`'demoproto.phase.retrySettle'`),
        'no-deadline engine has no retry command',
      );
    }
    if (capabilities.audioOrchestration) {
      assert.ok(engineGameDir.includes('demoproto.audio.ack'));
    } else {
      // The audio wiring is segment-gated end to end: a selection that
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
  // Narration is a per-game choice, so the on-state is proved at the
  // segment at the layer it lives in instead: render the whole
  // template tree with every capability off, once with the
  // capability flipped on and once off, applying the same whole-file
  // gates and destination rendering the generator uses.
  const names = deriveGameNames('demoproto');
  const extraTokens = {
    __GAME_DISPLAY_NAME__: '演示原型',
    __GAME_SUBTITLE__: '生成器自证用临时游戏',
    __GAME_ICON_NAME__: 'game-controller-outline',
    __GAME_ICON_COMPONENT__: 'IconGameControllerOutline',
    __GAME_TIER__: 'mini',
    __GAME_CAPABILITY_ARGS__: '',
    __GAME_CAPABILITIES__: '无（全部关闭）',
    __GAME_COMPLETION_TYPE__: 'DemoprotoCompletionPayload | ',
    __GAME_REQUIREMENT_COUNT__: '11',
    __GAME_TEST_BEGIN__: "session.send({ type: 'demoproto.game.begin' });",
  };
  const baseRecord = {
    ...selectCapabilities([]),
    armDeadlineAtBegin: false,
    stageDeadlineAtStart: false,
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
    generateNewGame({ rootDir: root, gameId: 'demoproto' });
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

test('generator facts track capability keys and migration numbering uses physical migrations', () => {
  const facts = generatorFacts();
  assert.deepEqual(facts.sharedFiles, SHARED_FILES);
  const files = fs
    .readdirSync(path.join(REPO_ROOT, 'packages/api-worker/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({
      name,
      content: readFixture(REPO_ROOT, `packages/api-worker/migrations/${name}`),
    }));
  const gameTypes = readFixture(
    REPO_ROOT,
    'packages/game-engine/src/platform/protocol/gameTypes.ts',
  );
  const currentTypes = [...gameTypes.matchAll(/^\s*'([a-z][a-z0-9]*)',$/gm)].map(
    (match) => match[1],
  );
  const latestRegistration = findLatestRegistrationMigration(files);
  for (const [, list] of latestRegistration.content.matchAll(/game_type IN \(([^)]*)\)/g)) {
    assert.deepEqual(
      [...list.matchAll(/'([a-z][a-z0-9]*)'/g)].map((match) => match[1]).sort(),
      [...currentTypes].sort(),
    );
  }
  assert.equal(
    nextMigrationName(['0075_physical.sql', '0065_demo.sql', '0070_physical.sql'], 'probe'),
    '0076_probe.sql',
  );
  assert.deepEqual(facts.capabilityKeys, CAPABILITY_KEYS);
  assert.equal(facts.templateCount, 51);
});

test('new registration migrations do not repeat the one-time demo cleanup', () => {
  const sourceName = '0088_remove_demo_game.sql';
  const sourceContent = readFixture(REPO_ROOT, `packages/api-worker/migrations/${sourceName}`);
  const migration = buildRegistrationMigration({
    sourceName,
    sourceContent,
    gameId: 'probe',
    displayName: 'Probe',
  });

  assert.ok(sourceContent.includes("DELETE FROM rooms WHERE game_type = 'demo';"));
  assert.ok(!migration.includes("DELETE FROM rooms WHERE game_type = 'demo';"));
  assert.ok(
    !migration.includes("DELETE FROM product_game_reward_results WHERE game_type = 'demo';"),
  );
  assert.ok(!migration.includes("json_extract(input_json, '$.gameType') = 'demo';"));
  assert.ok(migration.includes('CREATE TABLE rooms_next'));
  assert.ok(migration.includes('INSERT INTO rooms_next SELECT * FROM rooms;'));
});

test('consecutive registrations copy rebuilds but never the preceding game owned stats table', () => {
  const root = makeFixtureRepo();
  const first = generateNewGame({
    rootDir: root,
    gameId: 'firstprobe',
    capabilities: ['stageDeadline'],
  });
  const second = generateNewGame({
    rootDir: root,
    gameId: 'secondprobe',
    capabilities: ['identityViewing'],
  });
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
  const migrationsDir = path.join(root, 'packages/api-worker/migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).map((name) => ({
    name,
    content: readFixture(root, `packages/api-worker/migrations/${name}`),
  }));
  const sourceName = findLatestRegistrationMigration(migrationFiles).name;
  const file = path.join(migrationsDir, sourceName);
  const staleContent = fs
    .readFileSync(file, 'utf8')
    .replace(/game_type IN \(([^)]*)\)/g, (_match, list) => {
      const values = [...list.matchAll(/'([a-z][a-z0-9]*)'/g)].map((match) => match[1]);
      values.pop();
      return `game_type IN (${values.map((value) => `'${value}'`).join(', ')})`;
    });
  fs.writeFileSync(file, staleContent);
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'probe', capabilities: ['stageDeadline'] }),
    /does not match the canonical game set/,
  );
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/probe')), false);
});

test('production: true registers the new game as production and reports the list-only go-live step', () => {
  const root = makeFixtureRepo();
  const summary = generateNewGame({
    rootDir: root,
    gameId: 'demoproto',
    capabilities: ['identityViewing'],
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
  // Generate every valid selection into one isolated copy. This exercises
  // the combination matrix through real formatting/lint/typechecks and then
  // runs all generated game tests together with the shared registration tests.
  const root = makeRealRepoCopy();
  try {
    const generatedGames = CAPABILITY_SCENARIOS.map((scenario, index) => {
      const gameId = `aaprobe${index}`;
      const summary = generateNewGame({
        rootDir: root,
        gameId,
        capabilities: scenario.selected,
      });
      assert.equal(summary.formatted, true, `prettier must run for ${scenario.name}`);
      return { gameId, summary };
    });
    const require = createRequire(path.join(root, 'package.json'));
    const createdFiles = generatedGames.flatMap(({ summary }) => summary.createdFiles);
    const prettierBin = require.resolve('prettier/bin/prettier.cjs');
    // Same scope the generator's format pass claims: formattable
    // extensions, templates excluded (their rendered outputs are the
    // other entries in the list).
    const formatTargets = createdFiles.filter(
      (file) => /\.(?:ts|tsx|js|mjs|json|md|css)$/.test(file) && !file.endsWith('.tmpl'),
    );
    execFileSync(process.execPath, [prettierBin, '--check', ...formatTargets], {
      cwd: root,
      stdio: 'pipe',
    });
    for (const project of [
      'packages/web/tsconfig.json',
      'packages/game-engine/tsconfig.test.json',
      'packages/api-worker/tsconfig.json',
    ]) {
      typecheckFixture(root, project);
    }
    const eslintBin = path.join(
      path.dirname(require.resolve('eslint/package.json')),
      'bin',
      'eslint.js',
    );
    const lintTargets = createdFiles.filter((file) => /\.(?:ts|tsx)$/.test(file));
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

    const webTestPaths = [
      ...generatedGames.map(({ gameId }) => `src/games/${gameId}`),
      'src/__tests__',
    ];
    execFileSync(
      process.execPath,
      [resolveVitestBin(root, 'packages/web'), 'run', ...webTestPaths],
      { cwd: path.join(root, 'packages/web'), stdio: 'pipe', encoding: 'utf8' },
    );
    const engineTestPaths = [
      ...generatedGames.map(({ gameId }) => `src/games/${gameId}`),
      'src/platform/__tests__/phaseDeadlineVariants.contract.test.ts',
      'src/platform/__tests__/gameRegistry.contract.test.ts',
    ];
    execFileSync(
      process.execPath,
      [resolveVitestBin(root, 'packages/game-engine'), 'run', ...engineTestPaths],
      { cwd: path.join(root, 'packages/game-engine'), stdio: 'pipe', encoding: 'utf8' },
    );
    const workerTestPaths = generatedGames.map(({ gameId }) => `src/games/${gameId}`);
    execFileSync(
      process.execPath,
      [resolveVitestBin(root, 'packages/api-worker'), 'run', ...workerTestPaths],
      { cwd: path.join(root, 'packages/api-worker'), stdio: 'pipe', encoding: 'utf8' },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refuses to generate the same game id twice', () => {
  const root = makeFixtureRepo();
  generateNewGame({ rootDir: root, gameId: 'demoproto' });
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demoproto', capabilities: ['stageDeadline'] }),
    /already registered/,
  );
});

test('refuses an existing game id from the shipped catalog', () => {
  const root = makeFixtureRepo();
  assert.throws(() => generateNewGame({ rootDir: root, gameId: 'avalon' }), /already/);
});

test('rejects invalid game ids and capability selections before writing anything', () => {
  const root = makeFixtureRepo();
  assert.throws(() => generateNewGame({ rootDir: root, gameId: 'Demo' }), /Invalid game id/);
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demo', capabilities: ['weird'] }),
    /Invalid capability/,
  );
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demo', capabilities: ['botBulkViewing'] }),
    /requires "identityViewing"/,
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
    () => generateNewGame({ rootDir: root, gameId: 'demoproto' }),
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
        displayName: "坏'名字",
      }),
    /Invalid --name/,
  );
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demoproto',
        iconName: 'GameController',
      }),
    /Invalid --icon/,
  );
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/demoproto')));
});
