/**
 * New-game generator orchestration.
 *
 * One run: validate → render every template and compute every shared-
 * file edit in memory → only then write. Any failure (bad id, duplicate
 * registration, missing anchor, unrendered token) aborts before the
 * first write, so a failed run never leaves a half-registered game.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  editClientCatalog,
  editCompletionRewards,
  editDispatchDiscipline,
  editEngineCatalog,
  editEngineContractsTest,
  editEnginePackageJson,
  editEngineSkeletonContract,
  editExpectedCapabilities,
  editExpectedPackageExports,
  editGameTypes,
  editRegistry,
  editTestClientCatalog,
  editWorkerCatalog,
} from './edits.mjs';
import {
  buildRegistrationMigration,
  findLatestRegistrationMigration,
  nextMigrationName,
} from './migration.mjs';
import { deriveGameNames, renderTemplateFile } from './render.mjs';
import { buildIntegrationReport } from './report.mjs';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');

/**
 * Capability declarations written for a fresh skeleton, per preset
 * pack. Every value matches the wiring the skeleton actually ships:
 * the capabilities contract welds each declaration to a source
 * marker, so a switch the skeleton does not wire must be declared
 * off (gallery and word library are hooked up per game after
 * generation; the audio wiring ships as capability segments plus a
 * gated binding file and renders in full for a pack that declares
 * it on — all three packs keep it off because narration is a
 * per-game design choice, not an archetype trait; the bot scaffold
 * presupposes identity-viewing records, so the stage preset — like
 * every shipped stage game — declares it off). The demo-hybrid pack
 * is the union the shipped demo game was
 * hand-built to: identity viewing plus a stage deadline on the
 * playing phase, and its row mirrors demo's verified declaration.
 */
export const PRESET_CAPABILITIES = {
  identity: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
  stage: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: false,
  },
  'demo-hybrid': {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
};

/**
 * Pack-level template segment switches: they steer `//#cap` blocks
 * while rendering, and nothing else. Unlike PRESET_CAPABILITIES they
 * are NOT game capabilities — never written into generated code,
 * never welded by the capabilities contract. They exist for skeleton
 * assembly choices no single capability key expresses: the stage
 * pack ships the dual-channel expiry assembly (a public
 * `phase.expire` command next to the internal settle channel),
 * while demo-hybrid ships the internal settle channel only, exactly
 * like the shipped demo game; and a pack with both identity viewing
 * and a stage deadline arms the deadline when play begins (after
 * the viewing checkpoint), not when identities are dealt.
 */
export const PACK_SEGMENT_SWITCHES = {
  identity: { publicExpire: false, internalSettleOnly: false, armDeadlineAtBegin: false },
  stage: { publicExpire: true, internalSettleOnly: false, armDeadlineAtBegin: false },
  'demo-hybrid': { publicExpire: false, internalSettleOnly: true, armDeadlineAtBegin: true },
};

/**
 * Whole-file capability gates for the single game template tree:
 * a gated file is collected only when the pack enables the key.
 * The first three are the identity-viewing chain's whole-file
 * products (identity card adapter/modal and the viewing-protocol
 * contract); the last is the audio chain's client binding hook —
 * the engine/client wiring inside shared files rides `//#cap`
 * segments, but the binding itself is a file only audio games have.
 */
export const FILE_CAPABILITY_GATES = {
  'packages/game-engine/src/games/__GAME_ID__/__tests__/identityViewingProtocol.contract.test.ts':
    'identityViewing',
  'src/games/__GAME_ID__/components/__GAME_PASCAL__RoleCardAdapter.ts': 'identityViewing',
  'src/games/__GAME_ID__/room/components/__GAME_PASCAL__RoleCardModal.tsx': 'identityViewing',
  'src/games/__GAME_ID__/room/hooks/use__GAME_PASCAL__AudioOrchestration.ts': 'audioOrchestration',
};

export const DEFAULT_REWARDS = { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 };

const SHARED_EDITS = [
  {
    file: 'packages/game-engine/src/platform/protocol/gameTypes.ts',
    apply: (content, ctx) => editGameTypes(content, ctx),
  },
  {
    file: 'packages/game-engine/src/games/registry.ts',
    apply: (content, ctx) => editRegistry(content, ctx),
  },
  {
    file: 'packages/game-engine/src/product/rewards/earnings.ts',
    apply: (content, ctx) => editCompletionRewards(content, ctx),
  },
  {
    file: 'packages/game-engine/package.json',
    apply: (content, ctx) => editEnginePackageJson(content, ctx),
  },
  {
    file: 'packages/game-engine/src/platform/__tests__/architecture.contract.test.ts',
    apply: (content, ctx) => editExpectedPackageExports(content, ctx),
  },
  {
    file: 'packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts',
    apply: (content, ctx) => editEngineSkeletonContract(content, ctx),
  },
  {
    file: 'packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts',
    apply: (content, ctx) => editExpectedCapabilities(content, ctx),
  },
  {
    file: 'packages/game-engine/src/platform/engine/__tests__/contracts.test.ts',
    apply: (content, ctx) => editEngineContractsTest(content, ctx),
  },
  {
    file: 'packages/game-engine/src/games/catalog.ts',
    apply: (content, ctx) => editEngineCatalog(content, ctx),
  },
  {
    file: 'packages/api-worker/src/games/catalog.ts',
    apply: (content, ctx) => editWorkerCatalog(content, ctx),
  },
  {
    file: 'src/games/catalog.ts',
    apply: (content, ctx) => editClientCatalog(content, ctx),
  },
  {
    file: 'src/test-utils/clientGameCatalog.tsx',
    apply: (content, ctx) => editTestClientCatalog(content, ctx),
  },
  {
    file: 'src/__tests__/botDispatchDiscipline.contract.test.ts',
    apply: (content, ctx) => editDispatchDiscipline(content, ctx),
  },
];

const FORMATTABLE_FILE = /\.(?:ts|tsx|js|mjs|json|md)$/;

/**
 * Format everything the generator wrote with the repository's own
 * prettier, so a generated game passes the repo format gate as-is.
 * Fixture repositories without node_modules skip formatting silently;
 * a real prettier failure aborts with its output attached.
 */
function formatGeneratedFiles(repoRoot, files) {
  const targets = files.filter((file) => FORMATTABLE_FILE.test(file) && !file.endsWith('.tmpl'));
  if (targets.length === 0) return false;
  let prettierBin;
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'));
    prettierBin = require.resolve('prettier/bin/prettier.cjs');
  } catch {
    return false;
  }
  try {
    execFileSync(process.execPath, [prettierBin, '--write', ...targets], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr) : String(error);
    throw new Error(
      `prettier failed on the generated files. The game itself is fully generated and registered; fix the formatting (pnpm format:write) instead of re-running new-game, which would now refuse the duplicate id:\n${stderr}`,
    );
  }
  return true;
}

const LINTABLE_FILE = /\.(?:ts|tsx)$/;

/**
 * Run the repository's own eslint --fix over the created sources.
 * simple-import-sort compares the rendered identifiers, so member
 * order inside an import depends on the game id itself (an id whose
 * PascalCase name sorts before a fixed prefix like `commit` flips the
 * order) — no static template text can be pre-sorted for every id.
 * This pass plays the same role for the lint gate as the prettier
 * pass above plays for the format gate. Only created files are
 * targeted: the shared files the generator edits already receive
 * sort-correct inserts from edits.mjs. Fixture repositories without
 * node_modules skip silently; a problem eslint cannot autofix (or
 * any warning left over) aborts with its output attached.
 */
function autofixGeneratedImports(repoRoot, createdFiles) {
  const targets = createdFiles.filter(
    (file) => LINTABLE_FILE.test(file) && !file.endsWith('.tmpl'),
  );
  if (targets.length === 0) return;
  let eslintBin;
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'));
    eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
  } catch {
    return;
  }
  try {
    execFileSync(process.execPath, [eslintBin, '--fix', '--max-warnings', '0', ...targets], {
      cwd: repoRoot,
      stdio: 'pipe',
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=4096']
          .filter(Boolean)
          .join(' '),
      },
    });
  } catch (error) {
    const output = [error.stdout, error.stderr]
      .filter((chunk) => chunk && String(chunk).length > 0)
      .map((chunk) => String(chunk))
      .join('\n');
    throw new Error(
      `eslint --fix left problems in the generated files. The game itself is fully generated and registered; fix the lint output (pnpm lint) instead of re-running new-game, which would now refuse the duplicate id:\n${output}`,
    );
  }
}

function collectTemplateFiles(layer, capabilities = null) {
  const collected = new Map();
  const layerDir = path.join(TEMPLATES_DIR, layer);
  if (!fs.existsSync(layerDir)) return collected;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else if (entry.name.endsWith('.tmpl')) {
        const relative = path.relative(layerDir, entryPath).slice(0, -'.tmpl'.length);
        const gate = FILE_CAPABILITY_GATES[relative];
        if (gate !== undefined) {
          if (capabilities === null || !Object.hasOwn(capabilities, gate)) {
            throw new Error(`Unknown file capability gate "${gate}" for template ${relative}.`);
          }
          if (capabilities[gate] !== true) continue;
        }
        collected.set(relative, entryPath);
      }
    }
  };
  walk(layerDir);
  return collected;
}

/** Render the destination path of a template (path segments carry name tokens too). */
function renderDestination(relativeTemplatePath, names, capabilities, extraTokens) {
  return renderTemplateFile(relativeTemplatePath.split(path.sep).join('/'), {
    names,
    capabilities,
    extraTokens,
  });
}

/**
 * Display strings land inside single-quoted TS literals, JSX attributes
 * and template literals across the skeleton; reject characters that
 * would break out of those contexts instead of emitting broken code.
 */
const UNSAFE_DISPLAY_CHARACTER = /['"`\\<>]|\$\{|[\u0000-\u001f]/;

function assertSafeDisplayValue(label, value) {
  if (typeof value !== 'string' || value.length === 0 || UNSAFE_DISPLAY_CHARACTER.test(value)) {
    throw new Error(
      `Invalid ${label} "${String(value)}": display strings must be non-empty and cannot contain quotes, backticks, angle brackets, backslashes, "\${" or control characters.`,
    );
  }
}

export function generateNewGame(options) {
  const {
    rootDir,
    gameId,
    preset,
    displayName = gameId,
    subtitle = 'TODO(gameplay):一句话玩法',
    iconName = 'game-controller-outline',
    tier = 'mini',
    rewards = DEFAULT_REWARDS,
    production = false,
  } = options;
  if (!Object.hasOwn(PRESET_CAPABILITIES, preset)) {
    throw new Error(
      `Invalid preset "${String(preset)}": expected "identity", "stage" or "demo-hybrid".`,
    );
  }
  if (tier !== 'main' && tier !== 'mini') {
    throw new Error(`Invalid tier "${String(tier)}": expected "main" or "mini".`);
  }
  assertSafeDisplayValue('--name', displayName);
  assertSafeDisplayValue('--subtitle', subtitle);
  assertSafeDisplayValue('--icon', iconName);
  const names = deriveGameNames(gameId);
  const capabilities = PRESET_CAPABILITIES[preset];
  // Rendering sees the capability row plus the pack's segment
  // switches; edits and the report keep the pure capability row.
  const renderCapabilities = { ...capabilities, ...PACK_SEGMENT_SWITCHES[preset] };
  const home = { displayName, subtitle, iconName, tier };
  const extraTokens = {
    __GAME_DISPLAY_NAME__: displayName,
    __GAME_SUBTITLE__: subtitle,
    __GAME_ICON_NAME__: iconName,
    __GAME_TIER__: tier,
    __GAME_PRESET__: preset,
  };
  const ctx = {
    gameId,
    camel: names.camel,
    pascal: names.pascal,
    rewards,
    capabilities,
    home,
    production,
  };

  // Phase 1: compute everything in memory. Nothing below writes until
  // every render and every edit has succeeded.
  const templates = new Map([
    ...collectTemplateFiles('shared'),
    ...collectTemplateFiles('game', capabilities),
  ]);
  const created = new Map();
  for (const [relative, sourcePath] of templates) {
    const destination = renderDestination(relative, names, renderCapabilities, extraTokens);
    const body = fs.readFileSync(sourcePath, 'utf8');
    created.set(
      destination,
      renderTemplateFile(body, { names, capabilities: renderCapabilities, extraTokens }),
    );
  }

  const edited = new Map();
  for (const edit of SHARED_EDITS) {
    const fullPath = path.join(rootDir, edit.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    edited.set(edit.file, edit.apply(content, ctx));
  }

  const migrationsDir = path.join(rootDir, 'packages/api-worker/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, content: fs.readFileSync(path.join(migrationsDir, name), 'utf8') }));
  const source = findLatestRegistrationMigration(migrationFiles);
  const migrationName = nextMigrationName(
    migrationFiles.map((file) => file.name),
    gameId,
  );
  const migrationContent = buildRegistrationMigration({
    sourceName: source.name,
    sourceContent: source.content,
    gameId,
    displayName,
  });
  created.set(`packages/api-worker/migrations/${migrationName}`, migrationContent);

  const createdFiles = [...created.keys()].sort();
  const editedFiles = [...edited.keys()];
  const reportPath = `new-game-${gameId}-report.md`;
  const report = buildIntegrationReport({
    gameId,
    preset,
    names,
    home,
    rewards,
    capabilities,
    createdFiles,
    editedFiles,
    migrationName,
    production,
  });

  // Phase 2: duplicate guard — no target may already exist, including
  // the integration report (a stale report means this id ran before).
  for (const destination of [...createdFiles, reportPath]) {
    if (fs.existsSync(path.join(rootDir, destination))) {
      throw new Error(`Refusing to overwrite existing file: ${destination}`);
    }
  }

  // Phase 3: write.
  for (const [destination, body] of created) {
    const fullPath = path.join(rootDir, destination);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, body);
  }
  for (const [file, body] of edited) {
    fs.writeFileSync(path.join(rootDir, file), body);
  }
  fs.writeFileSync(path.join(rootDir, reportPath), report);
  const formatted = formatGeneratedFiles(rootDir, [...createdFiles, ...editedFiles, reportPath]);
  autofixGeneratedImports(rootDir, createdFiles);
  // eslint --fix reorders import/export members in place, and a swap
  // can leave text prettier would never emit (`import { a,handleB }`)
  // in files whose member order depends on the game id. Close the
  // pipeline with a second format pass over the created files so the
  // output ends both lint-clean and formatted; the two tools converge
  // (prettier never reorders members, eslint does not re-break the
  // formatting of members it just sorted).
  formatGeneratedFiles(rootDir, createdFiles);

  return { createdFiles, editedFiles, migrationName, reportPath, formatted };
}
