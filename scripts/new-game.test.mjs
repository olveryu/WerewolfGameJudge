/**
 * Generator tests: run the real generator against a fixture repository
 * assembled from the real shared files it edits, for both presets.
 * One case generates in a copy of the real tree instead, so the
 * prettier/eslint shaping passes actually run (they skip silently in
 * the dependency-free fixture). Run with
 * `node --test scripts/new-game.test.mjs` (also wrapped by
 * src/__tests__/newGameGenerator.contract.test.ts in the jest suite).
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
import { generateNewGame, PRESET_CAPABILITIES } from './lib/new-game/generate.mjs';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every shared file the generator edits; the fixture copies the real ones. */
const SHARED_FILES = [
  'packages/game-engine/src/platform/protocol/gameTypes.ts',
  'packages/game-engine/src/games/registry.ts',
  'packages/game-engine/src/product/rewards/earnings.ts',
  'packages/game-engine/package.json',
  'packages/game-engine/src/platform/__tests__/architecture.contract.test.ts',
  'packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts',
  'packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts',
  'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
  'packages/game-engine/src/games/catalog.ts',
  'packages/api-worker/src/games/catalog.ts',
  'src/games/catalog.ts',
  'src/test-utils/clientGameCatalog.tsx',
  'src/__tests__/botDispatchDiscipline.contract.test.ts',
];

function makeFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'new-game-fixture-'));
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
 * to run under the parallel jest suite.
 */
function makeRealRepoCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'new-game-real-repo-'));
  fs.cpSync(REPO_ROOT, root, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(REPO_ROOT, source);
      if (relative === '') return true;
      const segments = relative.split(path.sep);
      return (
        segments[0] !== '.git' && segments[0] !== 'assets' && !segments.includes('node_modules')
      );
    },
  });
  for (const linked of [
    'assets',
    'node_modules',
    'packages/game-engine/node_modules',
    'packages/api-worker/node_modules',
  ]) {
    const real = path.join(REPO_ROOT, linked);
    if (fs.existsSync(real)) fs.symlinkSync(real, path.join(root, linked), 'dir');
  }
  return root;
}

function expectedCreatedFiles(gameId, preset) {
  const pascal = gameId.charAt(0).toUpperCase() + gameId.slice(1);
  const engine = `packages/game-engine/src/games/${gameId}`;
  const worker = `packages/api-worker/src/games/${gameId}`;
  const client = `src/games/${gameId}`;
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
    `${client}/module.ts`,
    `${client}/home/index.ts`,
    `${client}/navigation/${gameId}GameNavigation.ts`,
    `${client}/model/${pascal}RoomSession.ts`,
    `${client}/screens/${pascal}ConfigScreen.tsx`,
    `${client}/screens/${pascal}RulesScreen.tsx`,
    `${client}/room/${pascal}RoomScreen.tsx`,
    `${client}/room/${gameId}RoomAdapter.ts`,
    `${client}/room/${gameId}RoomCommandFailureMessage.ts`,
    `${client}/room/hooks/use${pascal}RoomState.ts`,
    `${client}/room/hooks/use${pascal}SeatCommands.ts`,
    `${client}/room/__tests__/${gameId}ShellModel.test.ts`,
    `${client}/room/__tests__/${gameId}RoomCommandFailureMessage.test.ts`,
    `${client}/__tests__/build${pascal}TestState.ts`,
    `${client}/__tests__/build${pascal}TestState.test.ts`,
    `docs/${gameId}-game-design.md`,
    `e2e/specs/${gameId}.spec.ts.tmpl`,
  ];
  if (preset === 'identity') {
    files.push(
      `${engine}/__tests__/identityViewingProtocol.contract.test.ts`,
      `${client}/room/components/${pascal}RoleCardModal.tsx`,
      `${client}/components/${pascal}RoleCardAdapter.ts`,
    );
  }
  return files.sort();
}

function readFixture(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

for (const preset of ['identity', 'stage']) {
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
    assert.ok(registry.includes('isProduction: true'));
    assert.ok(
      registry.includes(
        "rewards: { policy: 'flat', xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 }",
      ),
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
    const clientCatalog = readFixture(root, 'src/games/catalog.ts');
    assert.ok(clientCatalog.includes('demoproto: {'));
    assert.ok(clientCatalog.includes('createDemoprotoUiModule'));
    assert.ok(
      clientCatalog.includes(
        `import { demoprotoGameNavigation } from '@/games/demoproto/navigation/demoprotoGameNavigation';`,
      ),
    );
    assert.ok(
      clientCatalog.includes(
        'registerClientGameModule(CLIENT_GAME_PLUGIN_CATALOG.demoproto.createModule(dependencies))',
      ),
    );
    assert.ok(
      readFixture(root, 'src/test-utils/clientGameCatalog.tsx').includes("gameType: 'demoproto'"),
    );
    const dispatch = readFixture(root, 'src/__tests__/botDispatchDiscipline.contract.test.ts');
    assert.ok(dispatch.includes('demoproto: ['));
    assert.ok(
      dispatch.includes(
        `{ file: 'games/demoproto/room/hooks/useDemoprotoRoomState.ts', form: 'parameterized-submit' },`,
      ),
    );

    // Integration report: parameters, migration and the manual steps
    // that must not be automated away (migration review, e2e approval).
    const report = readFixture(root, summary.reportPath);
    assert.ok(report.includes('还差的人工步骤'));
    assert.ok(report.includes(summary.migrationName));
    assert.ok(report.includes('审 migration'));
    assert.ok(report.includes('e2e 启用需用户批准'));

    // Migration: both game_type CHECK lists extended, manual step marked.
    const migration = readFixture(root, `packages/api-worker/migrations/${summary.migrationName}`);
    const lists = [...migration.matchAll(/game_type IN \(([^)]*)\)/g)];
    assert.ok(lists.length >= 2, 'expected both game_type CHECK lists');
    for (const list of lists) assert.ok(list[1].includes(`'demoproto'`));
    assert.ok(migration.includes('TODO(gameplay)'));

    // Preset wiring markers the capability welds depend on.
    const engineGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/game-engine/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    const clientGameDir = summary.createdFiles
      .filter((file) => file.startsWith('src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    if (preset === 'identity') {
      assert.ok(engineGameDir.includes('demoproto.bots.markAllBotsViewed'));
      assert.ok(!engineGameDir.includes('deadlineAt'));
      assert.ok(clientGameDir.includes('RevealAnimationGate'));
    } else {
      assert.ok(engineGameDir.includes('deadlineAt'));
      assert.ok(!clientGameDir.includes('RevealAnimationGate'));
    }
  });
}

test('generated output passes the format and lint gates with tooling present', (t) => {
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
  const root = makeRealRepoCopy();
  try {
    const summary = generateNewGame({ rootDir: root, gameId: 'aaprobe', preset: 'identity' });
    assert.equal(summary.formatted, true, 'prettier pass must run, not skip');
    const require = createRequire(path.join(root, 'package.json'));
    const prettierBin = require.resolve('prettier/bin/prettier.cjs');
    // Same scope the generator's format pass claims: formattable
    // extensions, templates excluded (their rendered outputs are the
    // other entries in the list).
    const formatTargets = summary.createdFiles.filter(
      (file) => /\.(?:ts|tsx|js|mjs|json|md)$/.test(file) && !file.endsWith('.tmpl'),
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
  assert.ok(!fs.existsSync(path.join(root, 'src/games/demo')));
  assert.ok(!fs.existsSync(path.join(root, 'src/games/Demo')));
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
  assert.ok(!fs.existsSync(path.join(root, 'src/games/demoproto')));
});
