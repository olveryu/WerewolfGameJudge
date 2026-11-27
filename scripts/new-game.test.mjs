/**
 * Generator tests: run the real generator against a fixture repository
 * assembled from the real shared files it edits, across representative feature
 * profiles. A real-tree copy validates representative selections with the
 * generated output's formatting, lint (including the UI gate's rules), types and package tests. Run with
 * `corepack pnpm run test scripts/new-game.test.mjs`.
 */

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, it } from 'vitest';

import {
  editEngineContractsTest,
  editNightCatalogueIndex,
  editNightCatalogueRegistry,
} from './lib/new-game/edits.mjs';
import {
  FILE_CAPABILITY_GATES,
  generateNewGame as generateNewGameWithProfile,
  generatorFacts,
  SHARED_EDITS,
} from './lib/new-game/generate.mjs';
import {
  BASE_TEST_REQUIREMENTS,
  DERIVED_CAPABILITY_KEYS,
  deriveCapabilities,
  FEATURE_KEYS,
  FEATURE_TEST_REQUIREMENTS,
  FEATURE_VALUES,
  normalizeFeatureProfile,
  parseFeatureDeclarations,
  resolveFeatureTestRequirements,
} from './lib/new-game/features.mjs';
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
it('requires narrated-night registration anchors and leaves non-night registrations unchanged', () => {
  const context = { gameId: 'example', capabilities: { nightPhase: true } };
  assert.throws(() => editNightCatalogueRegistry('no registry anchor', context), /anchor/);
  assert.throws(() => editNightCatalogueIndex('no index anchor', context), /anchor/);
  const withoutNight = { ...context, capabilities: { nightPhase: false } };
  assert.equal(
    editNightCatalogueRegistry('no registry anchor', withoutNight),
    'no registry anchor',
  );
  assert.equal(editNightCatalogueIndex('no index anchor', withoutNight), 'no index anchor');
});
const DEFAULT_FEATURE_PROFILE = Object.freeze(
  Object.fromEntries(FEATURE_KEYS.map((key) => [key, FEATURE_VALUES[key][0]])),
);
afterAll(() => {
  for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true });
});

function makeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'wgj-new-game-fixture-'));
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

function generateNewGame(options) {
  return generateNewGameWithProfile({
    ...options,
    features: options.features ?? DEFAULT_FEATURE_PROFILE,
  });
}

/**
 * A private copy of the real repository tree with the heavy read-only
 * trees (dependencies, media assets) symlinked back in instead of
 * copied. Generation inside the copy sees the real prettier/eslint
 * environment without ever mutating the shared tree, so this is safe
 * to run in parallel with other suites.
 */
function makeRealRepoCopy() {
  // Beside the repository, on its file system, so the assets below hard-link (a tmpfs /tmp
  // cannot hold a copy of them), and outside it, so no repository walk sees the copy.
  const root = fs.mkdtempSync(path.join(path.dirname(REPO_ROOT), '.wgj-new-game-real-repo-'));
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
  // Assets are files the web bundle graph reaches, and the UI gate rejects a graph file reached
  // through a symbolic link: hard-link them (copy them where hard links are not allowed).
  const assets = path.join(REPO_ROOT, 'assets');
  if (fs.existsSync(assets)) {
    try {
      execFileSync('cp', ['-al', assets, path.join(root, 'assets')], { stdio: 'pipe' });
    } catch {
      fs.rmSync(path.join(root, 'assets'), { recursive: true, force: true });
      fs.cpSync(assets, path.join(root, 'assets'), { recursive: true });
    }
  }
  for (const linked of [
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
    capability: 'nightPhase',
    files: ({ engine }) => [
      `${engine}/domain/nightSteps.ts`,
      `${engine}/state/nightCodec.ts`,
      `${engine}/__tests__/nightDriver.ts`,
      `${engine}/__tests__/scaffoldNightSession.ts`,
      `${engine}/__tests__/nightScenarios.ts`,
      `${engine}/__tests__/nightSteps.contract.test.ts`,
      `${engine}/__tests__/nightCatalogue.integration.test.ts`,
    ],
  },
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
    files: ({ client, pascal }) => [
      `${client}/room/hooks/use${pascal}AudioOrchestration.ts`,
      `${client}/audio/${pascal.charAt(0).toLowerCase() + pascal.slice(1)}AudioRegistry.ts`,
      `${client}/audio/${pascal.charAt(0).toLowerCase() + pascal.slice(1)}AudioRuntime.ts`,
      `${client}/audio/__tests__/${pascal.charAt(0).toLowerCase() + pascal.slice(1)}AudioRuntime.test.ts`,
    ],
  },
];

function expectedCreatedFiles(gameId, features) {
  const capabilities = deriveCapabilities(features);
  const pascal = gameId.charAt(0).toUpperCase() + gameId.slice(1);
  const engine = `packages/game-engine/src/games/${gameId}`;
  const worker = `packages/api-worker/src/games/${gameId}`;
  const client = `packages/web/src/games/${gameId}`;
  const files = [
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
    `${engine}/__tests__/stateParsing.test.ts`,
    `${worker}/schemas.ts`,
    `${worker}/effects.ts`,
    `${worker}/module.ts`,
    `${worker}/__tests__/schemas.test.ts`,
    `${client}/assets/roleAvatars.ts`,
    `packages/web/preview/${gameId}Preview.tsx`,
    `${client}/module.ts`,
    `${client}/home.ts`,
    `${client}/navigation/${gameId}GameNavigation.ts`,
    `${client}/model/${pascal}RoomSession.ts`,
    `${client}/screens/${pascal}RulesScreen.tsx`,
    `${client}/room/${pascal}RoomScreen.tsx`,
    `${client}/room/__tests__/${pascal}RoomScreen.test.tsx`,
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
  if (features.stats === 'enabled') {
    files.push(
      `${engine}/publicStats.ts`,
      `${engine}/__tests__/publicStats.test.ts`,
      `${worker}/dbSchema.ts`,
      `${worker}/publicUserStats.ts`,
      `${worker}/__tests__/publicUserStats.test.ts`,
      `${client}/components/${pascal}StatsPanel.tsx`,
      `${client}/components/__tests__/${pascal}StatsPanel.test.tsx`,
      `${client}/services/${gameId}Stats.ts`,
    );
  }
  return files.sort();
}

function readFixture(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

it('capability blocks keep lines only for enabled capabilities and fail fast on bad markers', () => {
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

const featureProfile = (overrides = {}) =>
  Object.freeze({ ...DEFAULT_FEATURE_PROFILE, ...overrides });

const FEATURE_SCENARIOS = [
  { name: 'no optional features', features: featureProfile() },
  { name: 'private identities', features: featureProfile({ identity: 'private' }) },
  { name: 'narrated night actions', features: featureProfile({ night: 'narrated' }) },
  {
    name: 'non-night guided narration',
    features: featureProfile({ guidedNarration: 'narrated' }),
  },
  { name: 'stage deadlines', features: featureProfile({ stageDeadline: 'enabled' }) },
  { name: 'in-game word supply', features: featureProfile({ wordSupply: 'in-game' }) },
  {
    name: 'all declared features',
    features: featureProfile({
      identity: 'private',
      night: 'narrated',
      guidedNarration: 'narrated',
      stageDeadline: 'enabled',
      wordSupply: 'both',
    }),
  },
  {
    name: 'rewards without statistics',
    features: featureProfile({ stats: 'none' }),
  },
  {
    name: 'no bots, statistics or rewards',
    features: featureProfile({ bots: 'none', stats: 'none', rewards: 'none' }),
  },
  {
    name: 'identities and deadlines without bots, statistics or rewards',
    features: featureProfile({
      identity: 'private',
      stageDeadline: 'enabled',
      bots: 'none',
      stats: 'none',
      rewards: 'none',
    }),
  },
];

const FULL_TOOLCHAIN_SCENARIOS = [
  { name: 'no optional features', features: featureProfile() },
  { name: 'private identities', features: featureProfile({ identity: 'private' }) },
  { name: 'narrated night actions', features: featureProfile({ night: 'narrated' }) },
  { name: 'non-night guided narration', features: featureProfile({ guidedNarration: 'narrated' }) },
  { name: 'stage deadlines', features: featureProfile({ stageDeadline: 'enabled' }) },
  {
    name: 'all declared features',
    features: FEATURE_SCENARIOS.find((scenario) => scenario.name === 'all declared features')
      .features,
  },
  ...FEATURE_SCENARIOS.filter(
    (scenario) => scenario.features.stats === 'none' || scenario.features.bots === 'none',
  ),
];

it('keeps one game template tree beside the shared template tree', () => {
  const templatesDir = path.join(REPO_ROOT, 'scripts/lib/new-game/templates');
  assert.deepEqual(fs.readdirSync(templatesDir).sort(), ['game', 'shared']);
});

it('requires a complete feature declaration and derives required capabilities from the game', () => {
  const identityAndNight = parseFeatureDeclarations([
    'identity=private',
    'night=narrated',
    'guidedNarration=none',
    'stageDeadline=enabled',
    'wordSupply=none',
    'bots=enabled',
    'stats=enabled',
    'rewards=flat',
  ]);
  assert.deepEqual(identityAndNight, {
    identity: 'private',
    night: 'narrated',
    guidedNarration: 'none',
    stageDeadline: 'enabled',
    wordSupply: 'none',
    bots: 'enabled',
    stats: 'enabled',
    rewards: 'flat',
  });
  assert.deepEqual(deriveCapabilities(identityAndNight), {
    nightPhase: true,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: true,
    audioOrchestration: true,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botBulkViewing: true,
  });

  const baseline = deriveCapabilities(DEFAULT_FEATURE_PROFILE);
  assert.equal(baseline.botsAndTakeover, true, 'bots=enabled wires host-controlled bot seats');
  const withoutBots = deriveCapabilities(featureProfile({ identity: 'private', bots: 'none' }));
  assert.equal(withoutBots.botsAndTakeover, false);
  assert.equal(withoutBots.identityViewing, true);
  assert.equal(withoutBots.botBulkViewing, false, 'bulk bot viewing needs bots');
  assert.equal(baseline.botBulkViewing, false, 'games without identities need no identity helper');
  assert.equal(baseline.nightPhase, false, 'games without night actions have no night phase');
  assert.equal(
    deriveCapabilities(featureProfile({ guidedNarration: 'narrated' })).nightPhase,
    false,
    'guided narration does not imply a night phase',
  );
  assert.equal(baseline.audioOrchestration, false);
  assert.equal(deriveCapabilities(featureProfile({ wordSupply: 'background' })).wordLibrary, true);
  assert.deepEqual(DERIVED_CAPABILITY_KEYS, [
    'botsAndTakeover',
    'nightPhase',
    'identityViewing',
    'botBulkViewing',
    'stageDeadline',
    'audioOrchestration',
    'wordLibrary',
  ]);
  assert.deepEqual(Object.keys(FEATURE_TEST_REQUIREMENTS).sort(), [
    'bots',
    'guidedNarration',
    'identity',
    'night',
    'stageDeadline',
  ]);

  assert.throws(() => parseFeatureDeclarations([]), /missing:/);
  assert.throws(
    () =>
      parseFeatureDeclarations([...FEATURE_KEYS.map((key) => `${key}=none`), 'identity=private']),
    /declared more than once/,
  );
  assert.throws(
    () => parseFeatureDeclarations([...FEATURE_KEYS.map((key) => `${key}=none`), 'robots=yes']),
    /Unknown feature "robots"/,
  );
  assert.throws(
    () => normalizeFeatureProfile({ ...DEFAULT_FEATURE_PROFILE, robots: 'enabled' }),
    /unknown: robots/,
  );
  assert.throws(
    () => normalizeFeatureProfile(featureProfile({ rewards: 'none' })),
    /"stats=enabled" requires "rewards=flat"/,
  );
});

it('rejects reward amounts for a game without rewards', () => {
  const root = makeFixtureRepo();
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'norewards',
        features: featureProfile({ stats: 'none', rewards: 'none' }),
        rewards: { xpEarned: 1, normalDrawsEarned: 1, dailyCompletionTarget: 1 },
      }),
    /rewards=none/,
  );
  const cliPath = path.join(REPO_ROOT, 'scripts/new-game.mjs');
  const features = featureProfile({ stats: 'none', rewards: 'none' });
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          cliPath,
          'norewards',
          ...FEATURE_KEYS.flatMap((key) => ['--feature', `${key}=${features[key]}`]),
          '--xp',
          '3',
        ],
        { cwd: root, encoding: 'utf8' },
      ),
    /--xp, --draws and --daily-target need --feature rewards=flat/,
  );
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/norewards')), false);
});

it('CLI rejects missing feature declarations and generates from explicit feature values', () => {
  const root = makeFixtureRepo();
  const cliPath = path.join(REPO_ROOT, 'scripts/new-game.mjs');
  assert.throws(
    () =>
      execFileSync(process.execPath, [cliPath, 'cliprobe'], {
        cwd: root,
        encoding: 'utf8',
      }),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /new-game: Feature profile must declare exactly/);
      return true;
    },
  );
  assert.equal(
    fs.existsSync(path.join(root, 'packages/game-engine/src/games/cliprobe')),
    false,
    'a missing feature declaration fails before writing generated files',
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [cliPath, 'cliprobe', '--capability', 'identityViewing'], {
        cwd: root,
        encoding: 'utf8',
      }),
    /Unknown option: --capability/,
  );

  const features = featureProfile({ identity: 'private', night: 'narrated' });
  const featureArguments = FEATURE_KEYS.flatMap((key) => ['--feature', `${key}=${features[key]}`]);
  execFileSync(process.execPath, [cliPath, 'cliprobe', ...featureArguments], {
    cwd: root,
    encoding: 'utf8',
  });
  const engine = readFixture(root, 'packages/game-engine/src/games/cliprobe/engine.ts');
  assert.ok(engine.includes('nightPhase: true'));
  assert.ok(engine.includes('identityViewing: true'));
  assert.ok(engine.includes('audioOrchestration: true'));
  assert.ok(
    readFixture(root, 'new-game-cliprobe-report.md').includes(
      'corepack pnpm new-game cliprobe --feature identity=private',
    ),
  );
});

for (const scenario of FEATURE_SCENARIOS) {
  it(`generates the complete skeleton for ${scenario.name} and wires every registration point`, () => {
    const root = makeFixtureRepo();
    const summary = generateNewGame({
      rootDir: root,
      gameId: 'demoproto',
      features: scenario.features,
      displayName: '演示原型',
      subtitle: '生成器自证用临时游戏',
    });

    // File-list completeness (the plan §4 checklist).
    assert.deepEqual(
      summary.createdFiles.filter((file) => !file.includes('/migrations/')),
      expectedCreatedFiles('demoproto', scenario.features),
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
    for (const requirement of resolveFeatureTestRequirements(scenario.features, {
      gameId: 'demoproto',
      gameName: 'demoproto',
    })) {
      assert.ok(reportText.includes(requirement.file), `${requirement.file} is listed in report`);
      for (const testCase of requirement.testCases) {
        assert.ok(reportText.includes(testCase), `${testCase} is listed in report`);
      }
    }
    const designDoc = readFixture(root, 'docs/demoproto-game-design.md');
    assert.match(
      readFixture(root, 'docs/README.md'),
      /\[demoproto-game-design\.md\]\(demoproto-game-design\.md\)/,
    );
    assert.equal(
      readFixture(root, 'packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts'),
      fs.readFileSync(
        path.join(
          REPO_ROOT,
          'packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts',
        ),
        'utf8',
      ),
      'default hidden registration leaves the explicit production set unchanged',
    );
    assert.ok(designDoc.includes('规则来源与用户确认'));
    assert.ok(designDoc.includes('奖励/战绩门槛不等于开局门槛'));
    assert.ok(!designDoc.includes('--preset'), 'generated design doc has no preset label');
    assert.ok(!designDoc.includes('原型预设'), 'generated design doc has no preset label');
    assert.ok(designDoc.includes('机器校验的游戏特征'));
    for (const key of FEATURE_KEYS) {
      assert.ok(
        designDoc.includes(`--feature ${key}=${scenario.features[key]}`),
        `design command includes ${key}`,
      );
    }
    assert.ok(reportText.includes('上线（翻生产）'), 'default report carries the go-live step');
    assert.ok(reportText.includes('homeProductionFilter'), 'go-live step names the tripwire list');
    const earnings = readFixture(root, 'packages/game-engine/src/product/rewards/earnings.ts');
    if (scenario.features.rewards === 'flat') {
      assert.ok(
        demoprotoEntry.includes(
          "rewards: { policy: 'flat', ...GAME_COMPLETION_REWARDS.demoproto }",
        ),
      );
      assert.ok(
        earnings.includes(
          'demoproto: { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 }',
        ),
      );
    } else {
      assert.ok(demoprotoEntry.includes("rewards: { policy: 'none' },"));
      assert.ok(!earnings.includes('demoproto:'), 'rewards=none adds no reward row');
    }

    // The contract expectation row and engine declaration must carry
    // exactly the capabilities derived from the declared feature profile.
    const capabilities = deriveCapabilities(scenario.features);
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
        scenario.features.stats === 'enabled'
          ? '  demoproto: { home: demoprotoHome, AccountStats: DemoprotoStatsPanel },'
          : '  demoproto: { home: demoprotoHome },',
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
    const previewRegistry = readFixture(root, 'packages/web/preview/previewGames.ts');
    assert.ok(previewRegistry.includes(`import { demoprotoPreview } from './demoprotoPreview';`));
    assert.match(
      previewRegistry,
      /previewGames: readonly PreviewGame\[\] = \[[^\]]*demoprotoPreview\];/,
    );
    assert.ok(fs.existsSync(path.join(root, 'packages/web/preview/demoprotoPreview.tsx')));

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
    assert.ok(report.includes('__tests__/engine.test.ts'));
    assert.ok(report.includes('notImplemented'));
    assert.equal(
      report.includes('__tests__/publicUserStats.test.ts'),
      scenario.features.stats === 'enabled',
      'the report asks for statistics semantics only when the game has statistics',
    );
    assert.ok(report.includes('观战者内容'));
    // The review step names the skeleton document and contribution a
    // game fills, and the closed block vocabulary it fills them with.
    assert.ok(report.includes('本局复盘填空'));
    assert.ok(
      report.includes('packages/web/src/games/demoproto/review/toDemoprotoReviewDocument.ts'),
    );
    assert.ok(report.includes('packages/web/src/games/demoproto/review/demoprotoReview.ts'));
    assert.ok(report.includes('packages/web/src/features/room/review/types.ts'));
    if (scenario.features.wordSupply === 'none') {
      assert.ok(report.includes('词库：不适用'));
      assert.ok(report.includes('wordSupply=none'));
    } else {
      // The word-supply step names every deployment registration required
      // by the declared supply mode.
      assert.ok(report.includes('workerWorkflows'));
      assert.ok(report.includes(`workflowName: 'demoproto-word-supply'`));
      assert.ok(report.includes(`binding: 'DEMOPROTO_WORD_SUPPLY'`));
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
    }
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
    const statsEnabled = scenario.features.stats === 'enabled';
    assert.equal(migration.includes('CREATE TABLE demoproto_user_stats'), statsEnabled);
    assert.equal(migration.includes("typeof(games_played) = 'integer'"), statsEnabled);
    if (statsEnabled) assert.ok(migration.includes('ON DELETE CASCADE'));
    const statsOwnerContract = readFixture(root, 'contracts/architecture.contract.test.ts');
    assert.equal(
      statsOwnerContract.includes(
        "['demoproto_user_stats', 'packages/api-worker/src/games/demoproto/dbSchema.ts']",
      ),
      statsEnabled,
    );
    const statsModule = readFixture(root, 'packages/api-worker/src/games/demoproto/module.ts');
    assert.equal(
      statsModule.includes('parsePublicUserStats: parseDemoprotoPublicStats'),
      statsEnabled,
    );
    assert.equal(
      statsModule.includes('getPublicUserStats: getDemoprotoPublicUserStats'),
      statsEnabled,
    );
    const statsEffects = readFixture(root, 'packages/api-worker/src/games/demoproto/effects.ts');
    assert.equal(
      statsEffects.includes(
        'z.union([gameCompletionPayloadSchema, demoprotoCompletionPayloadSchema])',
      ),
      statsEnabled,
    );
    assert.equal(
      statsEffects.includes(
        "'stats' in effect.payload ? demoprotoStatsSettlement(effect.payload.stats) : undefined",
      ),
      statsEnabled,
    );
    const roomHook = readFixture(
      root,
      'packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts',
    );
    assert.equal(
      roomHook.includes("useGameProfileDetails(profile.selection, '演示原型战绩', '本游戏局数')"),
      statsEnabled,
    );
    assert.equal(roomHook.includes('    gameDetails,'), statsEnabled);
    assert.equal(
      readFixture(root, 'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx').includes(
        'profileDetailsRenderer=',
      ),
      statsEnabled,
    );
    assert.equal(
      readFixture(root, 'packages/web/src/games/demoproto/room/demoprotoRoomAdapter.ts').includes(
        'gameDetails: input.gameDetails',
      ),
      statsEnabled,
    );
    assert.equal(report.includes('不需要额外指标也必须记录批准理由'), statsEnabled);
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
    // shared entry among player and host actions without
    // referencing removed terminal actions from the ended task.
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
    assert.ok(adapterSource.includes(`buildViewerReviewBottomButtons(input.review, input.viewer)`));
    assert.ok(adapterSource.includes('buildReviewHostAction(input.review)'));
    assert.ok(!adapterSource.includes('hostReviewClosingTask()'));
    if (capabilities.identityViewing) {
      assert.ok(adapterSource.includes("task: { kind: 'choice', actionKeys:"));
      assert.ok(adapterSource.includes('pendingActionKeys: input.review.isPending'));
      assert.ok(
        adapterSource.includes('resolveHighlight 返回 danger'),
        'identity skeleton directs private recognition to shared avatar color highlights',
      );
      // The generated room screen consumes the shared RevealRoleCardModal.
      assert.ok(clientGameDir.includes('RevealRoleCardModal'));
      const screenSource = readFixture(
        root,
        'packages/web/src/games/demoproto/room/DemoprotoRoomScreen.tsx',
      );
      assert.ok(
        screenSource.includes('<BoardInfoContent'),
        'identity games use shared public role content inside the game card',
      );
      assert.ok(
        screenSource.includes('{isPreGame && ('),
        'public board remains visible before play',
      );
      assert.ok(screenSource.includes('<RoleCardDialog'), 'public board roles remain previewable');
      assert.ok(screenSource.includes('shouldPlay={screen.roleViewing.shouldPlayAnimation}'));
      assert.ok(screenSource.includes('allRoles={screen.roleCardAllRoles}'));
      assert.ok(
        !reviewHook.includes('Object.values(state.identities)'),
        'animation candidates come from public board configuration',
      );
      assert.ok(
        readFixture(
          root,
          'packages/web/src/games/demoproto/components/DemoprotoRoleCardAdapter.ts',
        ).includes('imageUrl: getRoleAvatar(identity)'),
        'identity cards use the preloaded portrait registry',
      );
      assert.ok(!screenSource.includes("kind: 'workspace'"), 'identity games keep the seat board');
      assert.ok(!screenSource.includes('StageArea'), 'no parallel identity-stage action surface');
      assert.ok(
        !screenSource.includes('resolveViewIdentityAction'),
        'identity actions stay in the bottom model',
      );
    } else {
      assert.ok(adapterSource.includes('task: null,'));
      assert.ok(adapterSource.includes('pendingActionKeys: [],'));
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
        !screenSource.includes('<BoardInfoContent'),
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

it('night narration derives audio orchestration and renders its full wiring', () => {
  // Render the complete template tree from feature profiles so both
  // derived audio states use the generator's whole-file gates and
  // destination rendering.
  const names = deriveGameNames('demoproto');
  const extraTokens = {
    __GAME_DISPLAY_NAME__: '演示原型',
    __GAME_SUBTITLE__: '生成器自证用临时游戏',
    __GAME_ICON_NAME__: 'game-controller-outline',
    __GAME_ICON_COMPONENT__: 'IconGameControllerOutline',
    __GAME_TIER__: 'mini',
    __GAME_FEATURE_ARGS__: FEATURE_KEYS.map(
      (key) => ` --feature ${key}=${DEFAULT_FEATURE_PROFILE[key]}`,
    ).join(''),
    __GAME_FEATURES__: FEATURE_KEYS.map((key) => `${key}=${DEFAULT_FEATURE_PROFILE[key]}`).join(
      '、',
    ),
    __GAME_CAPABILITIES__: '无（基础接线）',
    __GAME_FEATURE_IDENTITY__: '无',
    __GAME_FEATURE_NIGHT__: '无',
    __GAME_FEATURE_GUIDED_NARRATION__: '无',
    __GAME_FEATURE_STAGE_DEADLINE__: '无',
    __GAME_FEATURE_WORD_SUPPLY__: '无',
    __GAME_FEATURE_BOTS__: 'enabled',
    __GAME_FEATURE_STATS__: 'enabled',
    __GAME_FEATURE_REWARDS__: 'flat',
    __GAME_COMPLETION_TYPE__: 'DemoprotoCompletionPayload | ',
    __GAME_REQUIREMENT_COUNT__: '11',
    __GAME_TEST_BEGIN__: "session.send({ type: 'demoproto.game.begin' });",
  };
  const withDerivedCapabilities = (features) => ({
    ...deriveCapabilities(features),
    sharedSteps: features.night === 'narrated',
    armDeadlineAtBegin: false,
    stageDeadlineAtStart: false,
    completion: features.rewards !== 'none',
    businessStats: features.stats === 'enabled',
  });
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
  const onFeatures = featureProfile({ night: 'narrated' });
  const on = renderTree(withDerivedCapabilities(onFeatures));
  const off = renderTree(withDerivedCapabilities(DEFAULT_FEATURE_PROFILE));

  const audioFiles = CAPABILITY_FILE_ADDITIONS.find(
    (addition) => addition.capability === 'audioOrchestration',
  ).files({ client: 'packages/web/src/games/demoproto', pascal: 'Demoproto' });
  assert.ok(on.has(hookFile), 'audio-on render includes the binding hook file');
  assert.ok(!off.has(hookFile), 'audio-off render excludes the binding hook file');
  const nightFiles = CAPABILITY_FILE_ADDITIONS.find(
    (addition) => addition.capability === 'nightPhase',
  ).files({ engine: 'packages/game-engine/src/games/demoproto' });
  assert.deepEqual(
    [...on.keys()].filter((file) => !off.has(file)).sort(),
    [...audioFiles, ...nightFiles].sort(),
  );
  assert.deepEqual(
    [...off.keys()].filter((file) => !on.has(file)),
    [],
  );

  const onUnion = [...on.values()].join('\n');
  assert.ok(
    onUnion.includes(
      'Count player actions/confirmations, not opening, closing or dawn audio clips.',
    ),
  );
  assert.ok(![...off.values()].join('\n').includes('Count player actions/confirmations'));
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
    // The platform gate guard at the restart wiring point.
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
    'new DemoprotoAudioPlayer(audioService)',
    'getDemoprotoPreloadAudio',
    'resolveDemoprotoAudio',
    'useRoomAudioOrchestration(',
    'useRoomAudioResume(',
    'RoomAudioResumeDialog',
    'useRoomBgmControl(',
    'RoomBgmToggle',
    'isResumeRequired: orchestration.isResumeRequired',
    // The generated engine test segment for the queue/ack/gate chain.
    `describe('Demoproto audio queue and ack'`,
  ];
  for (const marker of wiringMarkers) {
    assert.ok(onUnion.includes(marker), `audio-on render is missing wiring marker: ${marker}`);
  }
  assert.ok(!onUnion.includes('audio: null'), 'selected audio must have a real injected runtime');
  assert.ok(
    !on.get(hookFile).includes('new RoomAudioOrchestrator'),
    'audio binding must reuse the shared hook lifecycle',
  );
  assert.ok(
    !on.get(hookFile).includes('isNarratedPhase') &&
      !on.get(hookFile).includes('resolveReplayEffects') &&
      !on.get(hookFile).includes('stopOnPlaybackError'),
    'games supply ports, not phase predicates, replay overrides or failure-skipping policies',
  );
  assert.ok(
    on
      .get('packages/web/src/games/demoproto/room/hooks/useDemoprotoRoomState.ts')
      .includes('isResumeRequired: orchestration.isResumeRequired,'),
    'the resume dialog follows the shared reactive recovery signal',
  );
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
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it('generator facts track feature test obligations and migration numbering uses physical migrations', () => {
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
  assert.deepEqual(facts.featureKeys, FEATURE_KEYS);
  assert.deepEqual(facts.baseTestRequirements, BASE_TEST_REQUIREMENTS);
  assert.deepEqual(facts.featureTestRequirements, FEATURE_TEST_REQUIREMENTS);
  assert.equal(
    facts.templateCount,
    expectedCreatedFiles(
      'demoproto',
      FEATURE_SCENARIOS.find((scenario) => scenario.name === 'all declared features').features,
    ).length,
  );
});

it('new registration migrations do not repeat the one-time demo cleanup', () => {
  const sourceName = '0088_remove_demo_game.sql';
  const sourceContent = readFixture(REPO_ROOT, `packages/api-worker/migrations/${sourceName}`);
  const migration = buildRegistrationMigration({
    sourceName,
    sourceContent,
    gameId: 'probe',
    displayName: 'Probe',
    includeStatsTable: true,
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

it('consecutive registrations copy rebuilds but never the preceding game owned stats table', () => {
  const root = makeFixtureRepo();
  const first = generateNewGame({
    rootDir: root,
    gameId: 'firstprobe',
    features: featureProfile({ stageDeadline: 'enabled' }),
  });
  const second = generateNewGame({
    rootDir: root,
    gameId: 'secondprobe',
    features: featureProfile({ identity: 'private' }),
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

it('preserves populated D1 records and indexes through a generated registration migration', () => {
  const root = makeFixtureRepo();
  const summary = generateNewGame({ rootDir: root, gameId: 'dataprobe' });
  const migrationsDir = path.join(root, 'packages/api-worker/migrations');
  const database = new DatabaseSync(':memory:');

  try {
    database.exec('PRAGMA foreign_keys = ON');
    for (const name of fs
      .readdirSync(migrationsDir)
      .filter((entry) => entry.endsWith('.sql'))
      .sort()) {
      if (name === summary.migrationName) continue;
      database.exec(readFixture(root, `packages/api-worker/migrations/${name}`));
    }

    database.exec(`
      INSERT INTO users (id, email, password_hash, display_name, is_anonymous, created_at, updated_at)
      VALUES ('user-1', 'user@example.test', 'hash', 'Player', 0, '2026-01-01', '2026-01-01');
      INSERT INTO rooms
        (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at, games_started)
      VALUES
        ('room-1', '1234', 'avalon', 'user-1', 'create-1', '{}', 'active', '2026-01-01', '2026-01-01', 1);
      INSERT INTO room_game_starts (effect_id, room_id, started_revision, started_at)
      VALUES ('effect-1', 'room-1', 1, '2026-01-01');
      INSERT INTO room_participants (room_id, user_id, joined_at)
      VALUES ('room-1', 'user-1', '2026-01-01');
      INSERT INTO fib_round_word_selections
        (room_id, room_creation_id, effect_id, round_id, request_fingerprint, word, core_meaning, usage_note, source, selection_tier, selected_at)
      VALUES
        ('room-1', 'create-1', 'word-effect-1', 'round-1', 'fingerprint', 'word', 'meaning', 'note', 'local', 'local_fallback', '2026-01-01');
      INSERT INTO product_game_reward_claims (id, input_json, is_settled)
      VALUES ('settlement-1', '{"gameType":"avalon"}', 1);
      INSERT INTO product_game_reward_results
        (settlement_id, user_id, game_type, reward_kind, reward_date, previous_xp, xp_earned, new_xp, previous_level, new_level, normal_draws_earned, golden_draws_earned, stats_applied)
      VALUES
        ('settlement-1', 'user-1', 'avalon', 'completion', '2026-01-01', 0, 5, 5, 1, 1, 1, 0, 1);
    `);

    const tables = [
      'rooms',
      'room_game_starts',
      'room_participants',
      'fib_round_word_selections',
      'product_game_reward_claims',
      'product_game_reward_results',
    ];
    const readRows = (table) => database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
    const rowsBefore = new Map(tables.map((table) => [table, readRows(table)]));
    const rebuiltTables = [
      'rooms',
      'room_game_starts',
      'room_participants',
      'fib_round_word_selections',
      'undercover_round_word_selections',
      'product_game_reward_results',
    ];
    const indexesBefore = database
      .prepare(
        `SELECT name, tbl_name, sql FROM sqlite_master
         WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN (${rebuiltTables.map(() => '?').join(', ')})
         ORDER BY name`,
      )
      .all(...rebuiltTables);

    database.exec(readFixture(root, `packages/api-worker/migrations/${summary.migrationName}`));

    for (const table of tables) {
      assert.deepEqual(readRows(table), rowsBefore.get(table), `${table} rows survive rebuild`);
    }
    assert.deepEqual(
      database
        .prepare(
          `SELECT name, tbl_name, sql FROM sqlite_master
           WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN (${rebuiltTables.map(() => '?').join(', ')})
           ORDER BY name`,
        )
        .all(...rebuiltTables),
      indexesBefore,
      'explicit indexes on rebuilt tables are retained',
    );
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    assert.deepEqual(database.prepare('SELECT * FROM dataprobe_user_stats').all(), []);
    assert.doesNotThrow(() =>
      database
        .prepare(
          `INSERT INTO rooms
            (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
           VALUES ('room-2', '2345', 'dataprobe', 'user-1', 'create-2', '{}', 'active', '2026-01-02', '2026-01-02')`,
        )
        .run(),
    );
  } finally {
    database.close();
  }
});

it('stale registration CHECK lists fail before any generated file is written', () => {
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
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'probe',
        features: featureProfile({ stageDeadline: 'enabled' }),
      }),
    /does not match the canonical game set/,
  );
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/probe')), false);
});

it('production: true synchronizes the registry, Home contract and go-live report', () => {
  const root = makeFixtureRepo();
  const summary = generateNewGame({
    rootDir: root,
    gameId: 'demoproto',
    features: featureProfile({ identity: 'private' }),
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
    report.includes('上线（已同步目录名单）'),
    'production report confirms the explicit visibility selection',
  );
  assert.ok(report.includes('homeProductionFilter'));
  const homeContract = readFixture(
    root,
    'packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts',
  );
  assert.match(homeContract, /'demoproto',\n\] as const;/);
  assert.equal((homeContract.match(/'demoproto'/g) ?? []).length, 1);
});

it('missing documentation index anchors fail before registering or creating any game files', () => {
  const root = makeFixtureRepo();
  const index = path.join(root, 'docs/README.md');
  fs.writeFileSync(index, '# docs\n');
  const registry = readFixture(root, 'packages/game-engine/src/games/registry.ts');
  assert.throws(
    () => generateNewGame({ rootDir: root, gameId: 'demoproto' }),
    /edit failed for docs\/README.md/,
  );
  assert.equal(readFixture(root, 'packages/game-engine/src/games/registry.ts'), registry);
  assert.equal(fs.existsSync(path.join(root, 'packages/game-engine/src/games/demoproto')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs/demoproto-game-design.md')), false);
});

it.skipIf(!fs.existsSync(path.join(REPO_ROOT, 'node_modules', 'prettier')))(
  'generated output passes format, lint, typecheck, engine and client tests with tooling present',
  async () => {
    // The fixture-repo cases above structurally cannot catch shaping
    // defects: without node_modules both shaping passes skip silently.
    // This case generates in a copy of the real tree (dependencies
    // symlinked in; see makeRealRepoCopy) so prettier and eslint --fix
    // really run. The probe id's PascalCase name sorts ahead of fixed
    // identifier prefixes (Aaprobe before e.g. handle/commit), so
    // simple-import-sort must reorder import/export members — the exact
    // input that used to leave unformatted text behind when the lint
    // pass ran after the format pass with nothing re-formatting after.
    // Fixture cases cover each feature and its required generated files;
    // keep the full generated-project checks to representative profiles.
    const root = makeRealRepoCopy();
    try {
      const generatedGames = FULL_TOOLCHAIN_SCENARIOS.map((scenario, index) => {
        const gameId = `aaprobe${index}`;
        const summary = generateNewGame({
          rootDir: root,
          gameId,
          features: scenario.features,
          production: index === 0,
        });
        assert.equal(summary.formatted, true, `prettier must run for ${scenario.name}`);
        return { gameId, summary, features: scenario.features };
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

      // Generated files meet the UI gate with no recorded debt, judged by the gate itself: its
      // scope is the copy's bundle graph and its own configurations, so this test holds no
      // second definition of either. A generated source outside the graph is one Vite does not
      // bundle (a module of types only, or one only tests import, as in the shipped games): that
      // the graph holds every module Vite bundles is a property of `bundle.mjs`, checked against
      // Vite's own build in `scripts/ui-lint/gate.test.mjs` (P1 QA7 F1, QA8 should-fix 5).
      execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
      execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'pipe' });
      const { runGate } = await import(
        pathToFileURL(path.join(root, 'scripts/ui-lint/gate.mjs')).href
      );
      const webSources = createdFiles.filter(
        (file) =>
          file.startsWith('packages/web/src/') &&
          /\.(?:ts|tsx|css)$/.test(file) &&
          !/(?:^|\/)__tests__\/|\.test\.tsx?$/.test(file),
      );
      assert.ok(
        webSources.some((file) => file.endsWith('.css')),
        'the generator emits stylesheets',
      );
      const gate = await runGate({ root, only: new Set(webSources) });
      assert.deepEqual(gate.problems, []);
      const scope = new Set([...gate.graph.scripts, ...gate.graph.styles]);
      assert.ok(
        webSources.some((file) => scope.has(file) && file.endsWith('.tsx')),
        'the graph reaches the generated screens',
      );
      assert.deepEqual(gate.files, {});

      const webTestPaths = [
        ...generatedGames.map(({ gameId }) => `src/games/${gameId}`),
        'src/__tests__',
        'src/games/__tests__/homeProductionFilter.contract.test.ts',
      ];
      execFileSync(
        process.execPath,
        [resolveVitestBin(root, 'packages/web'), 'run', ...webTestPaths],
        { cwd: path.join(root, 'packages/web'), stdio: 'inherit' },
      );
      const engineTestPaths = [
        ...generatedGames.map(({ gameId }) => `src/games/${gameId}`),
        'src/platform/__tests__/phaseDeadlineVariants.contract.test.ts',
        'src/platform/__tests__/gameRegistry.contract.test.ts',
      ];
      const unimplementedCatalogues = generatedGames
        .filter(({ features }) => features.night === 'narrated')
        .map(({ gameId }) => `src/games/${gameId}/__tests__/nightCatalogue.integration.test.ts`);
      const incomplete = spawnSync(
        process.execPath,
        [
          resolveVitestBin(root, 'packages/game-engine'),
          'run',
          ...unimplementedCatalogues,
          '--reporter=json',
        ],
        { cwd: path.join(root, 'packages/game-engine'), encoding: 'utf8' },
      );
      if (incomplete.error !== undefined) throw incomplete.error;
      assert.equal(
        incomplete.status,
        1,
        `Unimplemented catalogues must fail:\n${incomplete.stdout}\n${incomplete.stderr}`,
      );
      const catalogueResults = JSON.parse(incomplete.stdout);
      assert.equal(catalogueResults.numFailedTests, unimplementedCatalogues.length * 2);
      for (const result of catalogueResults.testResults) {
        for (const assertion of result.assertionResults) {
          assert.equal(assertion.status, 'failed');
          assert.ok(assertion.failureMessages.join('\n').includes('[GAMEPLAY INCOMPLETE]'));
        }
      }
      execFileSync(
        process.execPath,
        [
          resolveVitestBin(root, 'packages/game-engine'),
          'run',
          ...engineTestPaths,
          ...unimplementedCatalogues.flatMap((file) => ['--exclude', file]),
        ],
        { cwd: path.join(root, 'packages/game-engine'), stdio: 'inherit' },
      );
      const workerTestPaths = generatedGames.map(({ gameId }) => `src/games/${gameId}`);
      execFileSync(
        process.execPath,
        [resolveVitestBin(root, 'packages/api-worker'), 'run', ...workerTestPaths],
        { cwd: path.join(root, 'packages/api-worker'), stdio: 'inherit' },
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
  900_000,
);

it('refuses to generate the same game id twice', () => {
  const root = makeFixtureRepo();
  generateNewGame({ rootDir: root, gameId: 'demoproto' });
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demoproto',
        features: featureProfile({ stageDeadline: 'enabled' }),
      }),
    /already registered/,
  );
});

it('refuses an existing game id from the shipped catalog', () => {
  const root = makeFixtureRepo();
  assert.throws(() => generateNewGame({ rootDir: root, gameId: 'avalon' }), /already/);
});

it('rejects invalid game ids and incomplete or invalid feature profiles before writing anything', () => {
  const root = makeFixtureRepo();
  assert.throws(() => generateNewGame({ rootDir: root, gameId: 'Demo' }), /Invalid game id/);
  assert.throws(
    () => generateNewGameWithProfile({ rootDir: root, gameId: 'demo' }),
    /complete game feature profile is required/,
  );
  assert.throws(
    () =>
      generateNewGame({
        rootDir: root,
        gameId: 'demo',
        features: featureProfile({ night: 'silent' }),
      }),
    /Invalid feature "night=silent"/,
  );
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/demo')));
  assert.ok(!fs.existsSync(path.join(root, 'packages/web/src/games/Demo')));
});

it('orders contracts.test.ts imports by module specifier, not binding name', () => {
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

it('refuses to overwrite a pre-existing target file', () => {
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

it('rejects display strings that would break out of generated literals', () => {
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
