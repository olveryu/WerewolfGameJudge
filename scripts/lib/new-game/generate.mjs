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
  editClientModuleLoaders,
  editCompletionRewards,
  editDesignDocIndex,
  editDispatchDiscipline,
  editEngineCatalog,
  editEngineContractsTest,
  editEnginePackageJson,
  editEngineSkeletonContract,
  editExpectedCapabilities,
  editExpectedPackageExports,
  editExpectedPhaseDeadlineVariants,
  editGameTypes,
  editGuidanceMatrixRegistry,
  editMigrationManifest,
  editNightCatalogueRegistry,
  editNightCatalogueIndex,
  editPreviewGames,
  editProductionGameTypes,
  editRegistry,
  editReviewContractRegistry,
  editWorkerCatalog,
  editStatsTableOwner,
} from './edits.mjs';
import {
  BASE_TEST_REQUIREMENTS,
  DERIVED_CAPABILITY_KEYS,
  deriveCapabilities,
  FEATURE_KEYS,
  FEATURE_TEST_REQUIREMENTS,
  formatFeatureDeclarations,
  formatFeatureSummary,
  formatFeatureValue,
  normalizeFeatureProfile,
  resolveFeatureTestRequirements,
} from './features.mjs';
import {
  MIGRATIONS_RELATIVE_DIR,
  nextMigrationName,
  planRegistrationMigration,
} from './migration.mjs';
import { deriveGameNames, renderTemplateFile } from './render.mjs';
import { buildIntegrationReport } from './report.mjs';

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates');

/**
 * Whole-file gates for game capabilities and the always-on statistics
 * assembly. In-file wiring uses the same switches through `//#cap` segments.
 */
export const FILE_CAPABILITY_GATES = {
  'packages/game-engine/src/games/__GAME_ID__/domain/nightSteps.ts': 'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/state/nightCodec.ts': 'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/nightDriver.ts': 'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/nightSteps.contract.test.ts': 'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/nightScenarios.ts': 'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/nightCatalogue.integration.test.ts':
    'sharedSteps',
  'packages/game-engine/src/games/__GAME_ID__/publicStats.ts': 'businessStats',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/publicStats.test.ts': 'businessStats',
  'packages/api-worker/src/games/__GAME_ID__/dbSchema.ts': 'businessStats',
  'packages/api-worker/src/games/__GAME_ID__/publicUserStats.ts': 'businessStats',
  'packages/api-worker/src/games/__GAME_ID__/__tests__/publicUserStats.test.ts': 'businessStats',
  'packages/web/src/games/__GAME_ID__/components/__GAME_PASCAL__StatsPanel.tsx': 'businessStats',
  'packages/web/src/games/__GAME_ID__/components/__tests__/__GAME_PASCAL__StatsPanel.test.tsx':
    'businessStats',
  'packages/web/src/games/__GAME_ID__/services/__GAME_CAMEL__Stats.ts': 'businessStats',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/phaseDeadlineProtocol.contract.test.ts':
    'stageDeadline',
  'packages/game-engine/src/games/__GAME_ID__/__tests__/identityViewingProtocol.contract.test.ts':
    'identityViewing',
  'packages/game-engine/src/games/__GAME_ID__/wordCategories.ts': 'wordLibrary',
  'packages/web/src/games/__GAME_ID__/components/__GAME_PASCAL__RoleCardAdapter.ts':
    'identityViewing',
  'packages/web/src/games/__GAME_ID__/room/hooks/use__GAME_PASCAL__AudioOrchestration.ts':
    'audioOrchestration',
  'packages/web/src/games/__GAME_ID__/audio/__GAME_CAMEL__AudioRegistry.ts': 'audioOrchestration',
  'packages/web/src/games/__GAME_ID__/audio/__GAME_CAMEL__AudioRuntime.ts': 'audioOrchestration',
  'packages/web/src/games/__GAME_ID__/audio/__tests__/__GAME_CAMEL__AudioRuntime.test.ts':
    'audioOrchestration',
};

export const DEFAULT_REWARDS = { xpEarned: 5, normalDrawsEarned: 1, dailyCompletionTarget: 5 };

export const SHARED_EDITS = [
  { file: 'scripts/lib/catalogues/registry.mjs', apply: editNightCatalogueRegistry },
  { file: 'docs/catalogues/README.md', apply: editNightCatalogueIndex },
  {
    file: 'packages/game-engine/src/platform/protocol/gameTypes.ts',
    apply: (content, ctx) => editGameTypes(content, ctx),
  },
  {
    file: 'packages/game-engine/src/games/registry.ts',
    apply: (content, ctx) => editRegistry(content, ctx),
  },
  {
    file: 'packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts',
    apply: (content, ctx) => editProductionGameTypes(content, ctx),
  },
  {
    file: 'docs/README.md',
    apply: (content, ctx) => editDesignDocIndex(content, ctx),
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
    file: 'packages/game-engine/src/platform/__tests__/phaseDeadlineVariants.contract.test.ts',
    apply: (content, ctx) => editExpectedPhaseDeadlineVariants(content, ctx),
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
    file: 'packages/web/src/games/catalog.ts',
    apply: (content, ctx) => editClientCatalog(content, ctx),
  },
  {
    file: 'packages/web/src/games/clientModules.tsx',
    apply: (content, ctx) => editClientModuleLoaders(content, ctx),
  },
  {
    file: 'packages/web/src/__tests__/botDispatchDiscipline.contract.test.ts',
    apply: (content, ctx) => editDispatchDiscipline(content, ctx),
  },
  {
    file: 'packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts',
    apply: (content, ctx) => editGuidanceMatrixRegistry(content, ctx),
  },
  {
    file: 'packages/web/src/__tests__/roomReview.contract.test.ts',
    apply: (content, ctx) => editReviewContractRegistry(content, ctx),
  },
  {
    file: 'contracts/architecture.contract.test.ts',
    apply: (content, ctx) => editStatsTableOwner(content, ctx),
  },
  {
    file: 'packages/web/preview/previewGames.ts',
    apply: (content, ctx) => editPreviewGames(content, ctx),
  },
  { file: 'contracts/d1MigrationManifest.json', apply: editMigrationManifest },
];

const FORMATTABLE_FILE = /\.(?:ts|tsx|js|mjs|json|md|css)$/;

/**
 * Format everything the generator wrote with the repository's own
 * prettier, so a generated game passes the repo format gate as-is.
 * Fixture repositories without node_modules skip formatting silently;
 * a real prettier failure aborts with its output attached.
 */
function formatGeneratedFiles(repoRoot, files) {
  const targets = files.filter((file) => FORMATTABLE_FILE.test(file) && !file.endsWith('.tmpl'));
  if (targets.length === 0) return false;
  if (!fs.existsSync(path.join(repoRoot, 'node_modules', 'prettier'))) return false;
  let prettierBin;
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'));
    prettierBin = require.resolve('prettier/bin/prettier.cjs');
  } catch (error) {
    throw new Error(
      `node_modules/prettier exists in ${repoRoot} but prettier/bin/prettier.cjs does not resolve; reinstall dependencies.`,
      { cause: error },
    );
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
      { cause: error },
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
  if (!fs.existsSync(path.join(repoRoot, 'node_modules', 'eslint'))) return;
  let eslintBin;
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'));
    eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
  } catch (error) {
    throw new Error(
      `node_modules/eslint exists in ${repoRoot} but eslint/package.json does not resolve; reinstall dependencies.`,
      { cause: error },
    );
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
      { cause: error },
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

/** Read-only counts use the same gates and file list as generation. */
export function generatorFacts() {
  const allSwitches = Object.fromEntries(
    Object.values(FILE_CAPABILITY_GATES).map((gate) => [gate, true]),
  );
  const templateCount =
    collectTemplateFiles('shared', allSwitches).size +
    collectTemplateFiles('game', allSwitches).size;
  return {
    sharedFiles: SHARED_EDITS.map(({ file }) => file),
    templateCount,
    featureKeys: FEATURE_KEYS,
    baseTestRequirements: BASE_TEST_REQUIREMENTS,
    featureTestRequirements: FEATURE_TEST_REQUIREMENTS,
  };
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

const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The Home card imports its Ionicon as `~icons/ion/<name>`; the binding
 * is `Icon` plus the PascalCase name. Whether the icon exists is checked
 * by the typecheck: the lobby summary types its icon as `IoniconName`.
 */
function iconComponentName(iconName) {
  if (typeof iconName !== 'string' || !ICON_NAME_PATTERN.test(iconName)) {
    throw new Error(
      `Invalid --icon "${String(iconName)}": expected a kebab-case Ionicons name (e.g. "game-controller-outline").`,
    );
  }
  return `Icon${iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

function createGenerationContext(options) {
  const {
    rootDir,
    gameId,
    features: requestedFeatures,
    displayName = gameId,
    subtitle = 'TODO(gameplay):一句话玩法',
    iconName = 'game-controller-outline',
    tier = 'mini',
    rewards: requestedRewards,
    production = false,
    wordCategories = null,
  } = options;
  if (tier !== 'main' && tier !== 'mini') {
    throw new Error(`Invalid tier "${String(tier)}": expected "main" or "mini".`);
  }
  assertSafeDisplayValue('--name', displayName);
  assertSafeDisplayValue('--subtitle', subtitle);
  const iconComponent = iconComponentName(iconName);
  const names = deriveGameNames(gameId);
  const features = normalizeFeatureProfile(requestedFeatures);
  if (features.rewards === 'none' && requestedRewards !== undefined) {
    throw new Error(
      'Reward amounts need --feature rewards=flat; rewards=none has no completion settlement.',
    );
  }
  const rewards = features.rewards === 'none' ? null : (requestedRewards ?? DEFAULT_REWARDS);
  const capabilities = deriveCapabilities(features);
  if (capabilities.wordLibrary && wordCategories === null) {
    throw new Error(
      `wordSupply=${features.wordSupply} gives the game a word library: pass its approved category list (--word-category <id>=<name>, repeatable, in display order). The generator never invents categories.`,
    );
  }
  if (!capabilities.wordLibrary && wordCategories !== null) {
    throw new Error(
      'Word categories need a word library: declare --feature wordSupply other than none.',
    );
  }
  const selectedCapabilities = DERIVED_CAPABILITY_KEYS.filter((key) => capabilities[key]);
  // Statistics ride the completion settlement, so they exist only with
  // rewards. Deadline arming is delayed until play begins only when
  // identity viewing precedes it.
  const renderCapabilities = {
    ...capabilities,
    sharedSteps: capabilities.nightPhase,
    armDeadlineAtBegin: capabilities.identityViewing && capabilities.stageDeadline,
    stageDeadlineAtStart: !capabilities.identityViewing && capabilities.stageDeadline,
    completion: features.rewards !== 'none',
    businessStats: features.stats === 'enabled',
  };
  const home = { displayName, subtitle, iconName, tier };
  const extraTokens = {
    __GAME_DISPLAY_NAME__: displayName,
    __GAME_SUBTITLE__: subtitle,
    __GAME_ICON_NAME__: iconName,
    __GAME_ICON_COMPONENT__: iconComponent,
    __GAME_TIER__: tier,
    __GAME_FEATURE_ARGS__: formatFeatureDeclarations(features),
    __GAME_FEATURES__: formatFeatureSummary(features),
    __GAME_CAPABILITIES__:
      selectedCapabilities.length === 0 ? '无（基础接线）' : selectedCapabilities.join('、'),
    __GAME_FEATURE_IDENTITY__: formatFeatureValue(features.identity),
    __GAME_FEATURE_NIGHT__: formatFeatureValue(features.night),
    __GAME_FEATURE_GUIDED_NARRATION__: formatFeatureValue(features.guidedNarration),
    __GAME_FEATURE_STAGE_DEADLINE__: formatFeatureValue(features.stageDeadline),
    __GAME_FEATURE_WORD_SUPPLY__: formatFeatureValue(features.wordSupply),
    __GAME_FEATURE_BOTS__: formatFeatureValue(features.bots),
    __GAME_FEATURE_STATS__: formatFeatureValue(features.stats),
    __GAME_FEATURE_REWARDS__: formatFeatureValue(features.rewards),
    __GAME_COMPLETION_TYPE__:
      features.stats === 'enabled' ? `${names.pascal}CompletionPayload | ` : '',
    __GAME_REQUIREMENT_COUNT__: '11',
    __GAME_WORD_CATEGORIES__:
      wordCategories === null
        ? ''
        : wordCategories
            .map(
              (entry) =>
                `  { id: ${JSON.stringify(entry.id)}, name: ${JSON.stringify(entry.name)} },`,
            )
            .join('\n'),
    __GAME_TEST_BEGIN__: [
      capabilities.identityViewing
        ? 'viewAllAndBegin(session);'
        : `session.send({ type: '${gameId}.game.begin' });`,
      ...(capabilities.nightPhase && !capabilities.identityViewing
        ? ['finishScaffoldNight(session.session);']
        : []),
    ].join('\n'),
  };
  const ctx = {
    gameId,
    camel: names.camel,
    pascal: names.pascal,
    rewards,
    capabilities,
    features,
    home,
    production,
  };

  return {
    rootDir,
    gameId,
    displayName,
    names,
    capabilities,
    features,
    renderCapabilities,
    home,
    extraTokens,
    ctx,
    rewards,
    production,
    wordCategories,
  };
}

/** The code's GAME_TYPES, in order, before this run appends to it — the authority game_types projects. */
function readCodeGameTypes(rootDir) {
  const file = 'packages/game-engine/src/platform/protocol/gameTypes.ts';
  const match = /export const GAME_TYPES = \[([\s\S]*?)\] as const;/.exec(
    fs.readFileSync(path.join(rootDir, file), 'utf8'),
  );
  if (match === null) throw new Error(`${file}: GAME_TYPES list not found.`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function buildGenerationPlan(context) {
  const {
    rootDir,
    gameId,
    displayName,
    names,
    capabilities,
    features,
    renderCapabilities,
    home,
    extraTokens,
    ctx,
    rewards,
    production,
    wordCategories,
  } = context;
  const templates = new Map([
    ...collectTemplateFiles('shared', renderCapabilities),
    ...collectTemplateFiles('game', renderCapabilities),
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

  for (const requirement of resolveFeatureTestRequirements(features, {
    gameId,
    gameName: names.camel,
  })) {
    const generatedTest = created.get(requirement.file);
    if (generatedTest === undefined) {
      throw new Error(`Feature profile requires a generated behavior test: ${requirement.file}`);
    }
    for (const testCase of requirement.testCases) {
      if (!generatedTest.includes(`it('${testCase}'`)) {
        throw new Error(
          `Feature profile requires an active test case "${testCase}" in generated behavior test: ${requirement.file}`,
        );
      }
    }
  }

  // Judge the schema the current migrations actually produce (never an
  // earlier migration's text), against the code's GAME_TYPES before this
  // game is appended to it.
  const migrationsDir = path.join(rootDir, MIGRATIONS_RELATIVE_DIR);
  const migrationName = nextMigrationName(fs.readdirSync(migrationsDir), gameId);
  const migrationContent = planRegistrationMigration({
    migrationsDir,
    gameId,
    displayName,
    codeGameTypes: readCodeGameTypes(rootDir),
    includeStatsTable: features.stats === 'enabled',
    wordCategories,
  });
  const editContext = { ...ctx, migration: { name: migrationName, content: migrationContent } };

  const edited = new Map();
  for (const edit of SHARED_EDITS) {
    const fullPath = path.join(rootDir, edit.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    edited.set(edit.file, edit.apply(content, editContext));
  }

  created.set(`packages/api-worker/migrations/${migrationName}`, migrationContent);

  const createdFiles = [...created.keys()].sort();
  const editedFiles = [...edited.keys()];
  const reportPath = `new-game-${gameId}-report.md`;
  const report = buildIntegrationReport({
    gameId,
    names,
    home,
    rewards,
    capabilities,
    features,
    createdFiles,
    editedFiles,
    migrationName,
    production,
  });

  return { created, edited, createdFiles, editedFiles, migrationName, reportPath, report };
}

function writeGenerationPlan(rootDir, plan) {
  const { created, edited, createdFiles, editedFiles, migrationName, reportPath, report } = plan;
  for (const destination of [...createdFiles, reportPath]) {
    if (fs.existsSync(path.join(rootDir, destination))) {
      throw new Error(`Refusing to overwrite existing file: ${destination}`);
    }
  }
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

export function generateNewGame(options) {
  const context = createGenerationContext(options);
  const plan = buildGenerationPlan(context);
  return writeGenerationPlan(context.rootDir, plan);
}
