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
import {
  FILE_CAPABILITY_GATES,
  generateNewGame,
  PACK_SEGMENT_SWITCHES,
  PRESET_CAPABILITIES,
} from './lib/new-game/generate.mjs';
import {
  applyCapabilityBlocks,
  deriveGameNames,
  renderTemplateFile,
} from './lib/new-game/render.mjs';

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

/**
 * Whole-file products a capability adds on top of the base skeleton,
 * keyed by capability: the expectation side of the generator's
 * FILE_CAPABILITY_GATES. A new gated template file joins this table
 * under its capability, or the file-list assertion below fails for
 * the packs that enable the capability.
 */
const CAPABILITY_FILE_ADDITIONS = [
  {
    capability: 'identityViewing',
    files: ({ engine, client, pascal }) => [
      `${engine}/__tests__/identityViewingProtocol.contract.test.ts`,
      `${client}/room/components/${pascal}RoleCardModal.tsx`,
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
    `${client}/room/${gameId}GuidanceMatrix.ts`,
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

    // Preset wiring markers the capability welds depend on.
    const engineGameDir = summary.createdFiles
      .filter((file) => file.startsWith('packages/game-engine/src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    const clientGameDir = summary.createdFiles
      .filter((file) => file.startsWith('src/games/demoproto/'))
      .map((file) => readFixture(root, file))
      .join('\n');
    if (capabilities.botTestScaffold) {
      assert.ok(engineGameDir.includes('demoproto.bots.markAllBotsViewed'));
    }
    if (capabilities.identityViewing) {
      assert.ok(clientGameDir.includes('RevealAnimationGate'));
    } else {
      assert.ok(!clientGameDir.includes('RevealAnimationGate'));
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
    } else {
      assert.ok(!engineGameDir.includes('deadlineAt'));
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
    if (preset === 'demo-hybrid') {
      // The hybrid pack settles through the system channel only: the
      // public expire command (and its phase.expired event) must not
      // exist anywhere in the generated engine, and the client carries
      // no countdown surface.
      assert.ok(!engineSource.includes(`'demoproto.phase.expire'`), 'no public expire command');
      assert.ok(!engineSource.includes('phase.expired'), 'no phase.expired event');
      assert.ok(!clientGameDir.includes('useStageDeadline'), 'client has no countdown hook');
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
    __GAME_TIER__: 'mini',
    __GAME_PRESET__: 'identity',
  };
  const baseRecord = { ...PRESET_CAPABILITIES.identity, ...PACK_SEGMENT_SWITCHES.identity };
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
            if (layer === 'game' && gate !== undefined && capabilities[gate] !== true) continue;
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

  const hookFile = 'src/games/demoproto/room/hooks/useDemoprotoAudioOrchestration.ts';
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
    'isAudioPlaying',
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

/**
 * Strip the shipped demo out of a real-repo copy so the generator
 * accepts the id again: its product files, its registration migration
 * and every shared-file registration entry. Migrations are history
 * and stay; only demo's own registration migration goes, so the
 * regenerated one lands on the same number and must reproduce it.
 */
function stripShippedDemo(root) {
  for (const dir of [
    'packages/game-engine/src/games/demo',
    'packages/api-worker/src/games/demo',
    'src/games/demo',
  ]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
  }
  for (const file of [
    'docs/demo-game-design.md',
    'e2e/specs/demo.spec.ts.tmpl',
    'packages/api-worker/migrations/0065_demo.sql',
  ]) {
    fs.rmSync(path.join(root, file), { force: true });
  }
  removeExactText(root, 'packages/game-engine/src/platform/protocol/gameTypes.ts', "  'demo',\n");
  removeEntryBlock(root, 'packages/game-engine/src/games/registry.ts', '  demo: {', '  },');
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
    'src/games/catalog.ts',
    "import { createDemoUiModule } from '@/games/demo/module';\n",
  );
  removeExactText(
    root,
    'src/games/catalog.ts',
    "import { demoGameNavigation } from '@/games/demo/navigation/demoGameNavigation';\n",
  );
  removeEntryBlock(root, 'src/games/catalog.ts', '  demo: {', '  },');
  removeExactText(
    root,
    'src/games/catalog.ts',
    '    demo: registerClientGameModule(CLIENT_GAME_PLUGIN_CATALOG.demo.createModule(dependencies)),\n',
  );
  removeEntryBlock(root, 'src/test-utils/clientGameCatalog.tsx', '    demo: {', '    },');
  removeExactText(
    root,
    'src/__tests__/botDispatchDiscipline.contract.test.ts',
    "  demo: [{ file: 'games/demo/room/hooks/useDemoRoomState.ts', form: 'parameterized-submit' }],\n",
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
    file: 'src/games/demo/room/demoGuidanceMatrix.ts',
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
      ' * 表面承载引导）。生成后必须：①在 src/__tests__/roomGuidanceMatrix.contract.test.ts',
      ' * 的注册表里登记本表；②写一个矩阵测试，用真实引擎流驱动本游戏的',
      ' * shell model 逐格对账（参考 demo 的 demoGuidanceMatrix.test.ts）。',
      ' */',
    ].join('\n'),
  },
  {
    file: 'src/games/demo/room/demoGuidanceMatrix.ts',
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
  {
    file: 'src/test-utils/clientGameCatalog.tsx',
    body: '          gradient: [lighten(colors.primary, 0.45), colors.primary],\n',
    generated: '',
  },
];

/** Files that live in the shipped demo but are never generator products. */
const DEMO_BODY_ONLY_FILES = [
  'packages/api-worker/src/games/demo/__tests__/effects.test.ts',
  'packages/game-engine/src/games/demo/__tests__/fullChain.test.ts',
  'packages/game-engine/src/games/demo/__tests__/phaseDeadlineProtocol.contract.test.ts',
  'packages/game-engine/src/games/demo/__tests__/roomCommands.contract.test.ts',
  'src/games/demo/room/__tests__/demoGuidanceMatrix.test.ts',
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
      'src/games/demo',
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
