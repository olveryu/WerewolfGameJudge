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
 * Capability declarations written for a fresh skeleton, per preset.
 * Every value matches the wiring the skeleton actually ships: the
 * capabilities contract welds each declaration to a source marker, so
 * a switch the skeleton does not wire must be declared off (audio,
 * gallery, word library are hooked up per game after generation; the
 * bot scaffold presupposes identity-viewing records, so the stage
 * preset — like every shipped stage game — declares it off).
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
      `new-game: prettier failed on the generated files. The game itself is fully generated and registered; fix the formatting (pnpm format:write) instead of re-running new-game, which would now refuse the duplicate id:\n${stderr}`,
    );
  }
  return true;
}

const LINTABLE_FILE = /\.(?:ts|tsx|js|mjs)$/;

/** Locate the target repository's eslint bin, or null when unavailable. */
function resolveEslintBin(repoRoot) {
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'));
    // The eslint package's exports map does not expose ./bin/eslint.js;
    // locate the bin through the exported package.json instead.
    return path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
  } catch {
    return null;
  }
}

function lintTargets(files) {
  return files.filter((file) => LINTABLE_FILE.test(file) && !file.endsWith('.tmpl'));
}

/**
 * Autofix everything the generator wrote with the repository's own
 * eslint (import/export sorting is the recurring fix). Runs before
 * prettier on purpose: eslint's sorted output is not always
 * prettier-formatted, while prettier never disturbs sort order, so
 * formatting last leaves both tools satisfied. The exit code is
 * ignored here — problems eslint cannot fix are reported by the
 * verification pass after formatting. Fixture repositories without
 * node_modules skip silently, like formatting. Returns whether
 * eslint was available.
 */
function autofixGeneratedFiles(repoRoot, files) {
  const targets = lintTargets(files);
  if (targets.length === 0) return false;
  const eslintBin = resolveEslintBin(repoRoot);
  if (eslintBin === null) return false;
  try {
    execFileSync(process.execPath, [eslintBin, '--fix', ...targets], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch {
    // Unfixable problems are reported by the verification pass.
  }
  return true;
}

/**
 * Verify the final generated bytes are eslint-clean with zero
 * tolerated warnings. Template output that is not lint-clean must
 * never ship silently — the next developer would have to hand-fix
 * the scaffold before their first PR — so a finding aborts with the
 * eslint output attached.
 */
function verifyGeneratedFilesLintClean(repoRoot, files) {
  const targets = lintTargets(files);
  if (targets.length === 0) return false;
  const eslintBin = resolveEslintBin(repoRoot);
  if (eslintBin === null) return false;
  try {
    execFileSync(process.execPath, [eslintBin, '--max-warnings', '0', ...targets], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout) : '';
    const stderr = error.stderr ? String(error.stderr) : String(error);
    throw new Error(
      `new-game: eslint did not come back clean on the generated files (unfixable problems in them, or a broken eslint config/environment — see the output below). The game itself is fully generated and registered; fix the lint findings (or the templates under scripts/lib/new-game/templates) instead of re-running new-game, which would now refuse the duplicate id:\n${stdout}${stderr}`,
    );
  }
  return true;
}

function collectTemplateFiles(layer) {
  const collected = new Map();
  const layerDir = path.join(TEMPLATES_DIR, layer);
  if (!fs.existsSync(layerDir)) return collected;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else if (entry.name.endsWith('.tmpl')) {
        const relative = path.relative(layerDir, entryPath).slice(0, -'.tmpl'.length);
        collected.set(relative, entryPath);
      }
    }
  };
  walk(layerDir);
  return collected;
}

/** Render the destination path of a template (path segments carry name tokens too). */
function renderDestination(relativeTemplatePath, names, preset, extraTokens) {
  return renderTemplateFile(relativeTemplatePath.split(path.sep).join('/'), {
    names,
    preset,
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
  } = options;
  if (preset !== 'identity' && preset !== 'stage') {
    throw new Error(`Invalid preset "${String(preset)}": expected "identity" or "stage".`);
  }
  if (tier !== 'main' && tier !== 'mini') {
    throw new Error(`Invalid tier "${String(tier)}": expected "main" or "mini".`);
  }
  assertSafeDisplayValue('--name', displayName);
  assertSafeDisplayValue('--subtitle', subtitle);
  assertSafeDisplayValue('--icon', iconName);
  const names = deriveGameNames(gameId);
  const capabilities = PRESET_CAPABILITIES[preset];
  const home = { displayName, subtitle, iconName, tier };
  const extraTokens = {
    __GAME_DISPLAY_NAME__: displayName,
    __GAME_SUBTITLE__: subtitle,
    __GAME_ICON_NAME__: iconName,
    __GAME_TIER__: tier,
    __GAME_PRESET__: preset,
  };
  const ctx = { gameId, camel: names.camel, pascal: names.pascal, rewards, capabilities, home };

  // Phase 1: compute everything in memory. Nothing below writes until
  // every render and every edit has succeeded.
  const templates = new Map([...collectTemplateFiles('shared'), ...collectTemplateFiles(preset)]);
  const created = new Map();
  for (const [relative, sourcePath] of templates) {
    const destination = renderDestination(relative, names, preset, extraTokens);
    const body = fs.readFileSync(sourcePath, 'utf8');
    created.set(destination, renderTemplateFile(body, { names, preset, extraTokens }));
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
  const writtenFiles = [...createdFiles, ...editedFiles, reportPath];
  const eslintAvailable = autofixGeneratedFiles(rootDir, writtenFiles);
  const formatted = formatGeneratedFiles(rootDir, writtenFiles);
  const linted = eslintAvailable && verifyGeneratedFilesLintClean(rootDir, writtenFiles);

  return { createdFiles, editedFiles, migrationName, reportPath, formatted, linted };
}
