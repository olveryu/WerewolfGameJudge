/**
 * architecture.contract — Layer boundary guard
 *
 * Enforces the project's unidirectional dependency rules across the engine, the Worker and the
 * web client (packages/web/src):
 *   UI → shared room or game-owned runtime → platform protocols
 *   UI → Application → Infrastructure (services/infra, services/cloudflare)
 *
 * Forbidden directions:
 *   - services/ → routes/ or games/  (infra must not know about UI)
 *   - game-engine → client code  (domain is leaf)
 *   - routes/ → services/ with runtime (non-type) imports
 */

import fs from 'node:fs';
import path from 'node:path';

import { GAME_ENGINE_CATALOG } from '@game-judge/game-engine/games/catalog';
import {
  GAME_REGISTRY,
  type GameWorkerWorkflowRegistration,
} from '@game-judge/game-engine/games/registry';
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import ts from 'typescript';
import { parse } from 'yaml';
import { z } from 'zod';

import {
  getModuleSpecifiers,
  getRuntimeModuleSpecifiers,
} from '../packages/game-engine/src/platform/__tests__/moduleSpecifiers';

const GAME_ENGINE_PACKAGE = '@game-judge/game-engine';

function isSharedGameEngineSpecifier(specifier: string): boolean {
  return [`${GAME_ENGINE_PACKAGE}/platform/`, `${GAME_ENGINE_PACKAGE}/product/`].some((prefix) =>
    specifier.startsWith(prefix),
  );
}

// ─── Shared file walker ─────────────────────────────────────────────────────

function getAllProductionFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['__tests__', '__mocks__', 'node_modules'].includes(entry.name)) continue;
      results.push(...getAllProductionFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.') &&
      !entry.name.includes('.stories.')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function getTopLevelProductionDirectories(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && getAllProductionFiles(path.join(dir, entry.name)).length > 0,
    )
    .map((entry) => entry.name)
    .sort();
}

function getTopLevelProductionFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.'),
    )
    .map((entry) => entry.name)
    .sort();
}

function isPathWithin(directory: string, candidate: string): boolean {
  return candidate === directory || candidate.startsWith(`${directory}${path.sep}`);
}

function hasPathSegment(specifier: string, segment: string): boolean {
  return specifier.split('/').includes(segment);
}

function parseStringRecord(value: unknown, source: string): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${source} must contain an object`);
  }

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      throw new Error(`${source}.${key} must contain a string`);
    }
    result[key] = entry;
  }
  return result;
}

function parseWranglerWorkflows(source: string): {
  readonly workflowName: string;
  readonly binding: string;
  readonly exportName: string;
}[] {
  const blocks = source
    .split(/(?=^\[\[workflows\]\]\s*$)/m)
    .filter((block) => block.startsWith('[[workflows]]'));
  return blocks.map((block) => {
    const readField = (field: string): string => {
      const value = new RegExp(`^${field}\\s*=\\s*"([^"]+)"$`, 'm').exec(block)?.[1];
      if (value === undefined) throw new Error(`Workflow binding is missing ${field}`);
      return value;
    };
    return {
      workflowName: readField('name'),
      binding: readField('binding'),
      exportName: readField('class_name'),
    };
  });
}

function getSqliteTableNames(filePath: string): readonly string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const tableNames: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'sqliteTable'
    ) {
      const tableName = node.arguments[0];
      if (tableName === undefined || !ts.isStringLiteralLike(tableName)) {
        throw new Error(
          `[FAIL-FAST] ${path.relative(process.cwd(), filePath)} declares a non-literal SQLite table`,
        );
      }
      tableNames.push(tableName.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return tableNames;
}

function hasZodObjectCall(filePath: string): boolean {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let found = false;

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'z' &&
      node.expression.name.text === 'object'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function hasPropertyAccess(filePath: string, propertyName: string): boolean {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let found = false;

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && node.name.text === propertyName) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function getOrdinaryTypeAssertions(filePath: string, source?: string): readonly string[] {
  const content = source ?? fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isTypeAssertionExpression(node) ||
      (ts.isAsExpression(node) && node.type.getText(sourceFile) !== 'const')
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      violations.push(`${path.relative(process.cwd(), filePath)}:${line}`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function getIdentifierNames(filePath: string): readonly string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...names];
}

function isGameDomainSpecifier(specifier: string): boolean {
  return GAME_TYPES.some((gameType) => {
    const domainPath = `/games/${gameType}/domain`;
    return specifier.endsWith(domainPath) || specifier.includes(`${domainPath}/`);
  });
}

function isGameTestingSpecifier(specifier: string): boolean {
  return GAME_TYPES.some((gameType) => {
    const testingPath = `/games/${gameType}/testing`;
    return specifier.endsWith(testingPath) || specifier.includes(`${testingPath}/`);
  });
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const webDir = path.join(process.cwd(), 'packages', 'web');
const srcDir = path.join(webDir, 'src');
const routesDir = path.join(srcDir, 'routes');
const productComponentsDir = path.join(srcDir, 'components');
const sharedRoomDir = path.join(srcDir, 'features', 'room');
const gamesDir = path.join(srcDir, 'games');
const servicesDir = path.join(srcDir, 'services');
const gameEngineDir = path.join(process.cwd(), 'packages', 'game-engine', 'src');
const engineGamesDir = path.join(gameEngineDir, 'games');
const workerDir = path.join(process.cwd(), 'packages', 'api-worker');
const workerSrcDir = path.join(workerDir, 'src');
const workerPlatformDir = path.join(workerSrcDir, 'platform');
const workerGamesDir = path.join(workerSrcDir, 'games');
const pagesFunctionsDir = path.join(process.cwd(), 'functions');

const routesFiles = getAllProductionFiles(routesDir);
const productComponentFiles = getAllProductionFiles(productComponentsDir);
const sharedRoomFiles = getAllProductionFiles(sharedRoomDir);
const servicesFiles = getAllProductionFiles(servicesDir);
const srcFiles = getAllProductionFiles(srcDir);
const gameEngineFiles = getAllProductionFiles(gameEngineDir);
const workerPlatformFiles = getAllProductionFiles(workerPlatformDir);
const workerFiles = getAllProductionFiles(workerSrcDir);
const workerFileSet = new Set(workerFiles);

/** Repo-relative path, the form every expected file list uses. */
function repoPath(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

/** The module factory map in `games/clientModules.tsx`, which statically imports every game. */
const clientModulesSource = fs.readFileSync(path.join(gamesDir, 'clientModules.tsx'), 'utf-8');

function resolveWorkerRelativeModule(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ];
  const resolved = candidates.find((candidate) => workerFileSet.has(candidate));
  if (resolved === undefined) {
    throw new Error(
      `[FAIL-FAST] Worker architecture test cannot resolve ${specifier} from ${path.relative(process.cwd(), importer)}`,
    );
  }
  return resolved;
}

// ─── Rule 1: services/ must NOT import UI ownership roots ───────────────────

describe('Layer boundary: services → UI (forbidden)', () => {
  it('should find services files to check', () => {
    expect(servicesFiles.length).toBeGreaterThan(0);
  });

  it.each(servicesFiles)('%s must not import routes/ or games/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter(
      (specifier) => hasPathSegment(specifier, 'routes') || specifier.startsWith('@/games/'),
    );
    expect(violations).toEqual([]);
  });
});

// ─── Rule 2: game-engine must NOT import client code ─────────────────────────

describe('Layer boundary: game-engine → client (forbidden)', () => {
  it('should find game-engine files to check', () => {
    expect(gameEngineFiles.length).toBeGreaterThan(0);
  });

  it.each(gameEngineFiles)('%s must not import client code', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter((specifier) => {
      if (specifier.startsWith('@/')) return true;
      if (!specifier.startsWith('.')) return false;
      return isPathWithin(srcDir, path.resolve(path.dirname(filePath), specifier));
    });
    expect(violations).toEqual([]);
  });
});

describe('Game-engine package boundary: consumers use explicit public APIs', () => {
  const consumerFiles = [...srcFiles, ...workerFiles];
  const removedOwnershipPrefixes = [
    '@game-judge/game-engine/growth',
    '@game-judge/game-engine/utils',
  ] as const;

  it.each(consumerFiles)('%s must use explicit game-engine public APIs', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));

    const expectNoImports = (violations: string[], diagnostic: string) => {
      expect.soft(violations, `${filePath} ${diagnostic}`).toEqual([]);
    };

    expectNoImports(
      imports.filter((specifier) => specifier === GAME_ENGINE_PACKAGE),
      'must not import the aggregate package root',
    );
    expectNoImports(
      imports.filter(isGameDomainSpecifier),
      'must not import a game-owned domain deep path',
    );
    expectNoImports(
      imports.filter(isGameTestingSpecifier),
      'must not import a game testing API in production',
    );
    expectNoImports(
      imports.filter((specifier) =>
        removedOwnershipPrefixes.some(
          (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
        ),
      ),
      'must not import a removed engine ownership path',
    );
  });
});

describe('Layer boundary: Worker platform → game composition (forbidden)', () => {
  it('should find Worker platform files to check', () => {
    expect(workerPlatformFiles.length).toBeGreaterThan(0);
  });

  it.each(workerPlatformFiles)(
    '%s must receive game modules through platform ports',
    (filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const violations = getModuleSpecifiers(filePath, content).filter((specifier) =>
        hasPathSegment(specifier, 'games'),
      );
      expect(violations).toEqual([]);
    },
  );

  it.each(workerPlatformFiles)('%s must not reach a game implementation transitively', (entry) => {
    const visited = new Set<string>();
    const pending = [entry];
    const violations: string[] = [];

    while (pending.length > 0) {
      const filePath = pending.pop();
      if (filePath === undefined || visited.has(filePath)) continue;
      visited.add(filePath);

      const specifiers = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      for (const specifier of specifiers) {
        const dependency = resolveWorkerRelativeModule(filePath, specifier);
        if (dependency === null) continue;
        if (isPathWithin(workerGamesDir, dependency)) {
          violations.push(path.relative(process.cwd(), dependency));
          continue;
        }
        pending.push(dependency);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('Worker ownership: game-specific persistence and HTTP stay game-owned', () => {
  const removedWorkerPaths = [
    'packages/api-worker/src/__tests__/fibGameRoom.test.ts',
    'packages/api-worker/src/__tests__/fibWordProvider.test.ts',
    'packages/api-worker/src/__tests__/settleGameResults.test.ts',
    'packages/api-worker/src/__tests__/werewolfPublicStats.test.ts',
    'packages/api-worker/src/db/schema.ts',
    'packages/api-worker/src/growth/settleGameResults.ts',
    'packages/api-worker/src/handlers/geminiProxy.ts',
    'packages/api-worker/src/schemas/gemini.ts',
    'packages/api-worker/src/features/auth/WeChatAuthProxy.ts',
    'packages/api-worker/src/features/auth/weChatAuthStub.ts',
    'packages/api-worker/src/features/auth/userProfile.ts',
  ];

  it.each(removedWorkerPaths)('%s must not exist', (relativePath) => {
    expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(false);
  });

  it('keeps the runtime Drizzle driver schema-free', () => {
    const dbIndex = fs.readFileSync(path.join(workerSrcDir, 'db', 'index.ts'), 'utf-8');
    const imports = getModuleSpecifiers(path.join(workerSrcDir, 'db', 'index.ts'), dbIndex);

    expect(imports.filter((specifier) => hasPathSegment(specifier, 'games'))).toEqual([]);
    expect(dbIndex).toContain('return drizzle(d1);');
  });

  it('declares every physical D1 table exactly once in its owner module', () => {
    const expectedOwners = new Map<string, string>([
      ['admin_reward_grants', 'packages/api-worker/src/features/admin/dbSchema.ts'],
      ['avalon_user_stats', 'packages/api-worker/src/games/avalon/dbSchema.ts'],
      ['camp_settlements', 'packages/api-worker/src/games/werewolf/dbSchema.ts'],
      ['decrypto_round_word_selections', 'packages/api-worker/src/games/decrypto/dbSchema.ts'],
      ['decrypto_user_stats', 'packages/api-worker/src/games/decrypto/dbSchema.ts'],
      ['decrypto_word_packs', 'packages/api-worker/src/games/decrypto/dbSchema.ts'],
      ['decrypto_words', 'packages/api-worker/src/games/decrypto/dbSchema.ts'],
      ['draw_history', 'packages/api-worker/src/features/gacha/dbSchema.ts'],
      ['drawguess_user_stats', 'packages/api-worker/src/games/drawguess/dbSchema.ts'],
      ['editorial_model_requests', 'packages/api-worker/src/platform/ai/dbSchema.ts'],
      ['feedback_deliveries', 'packages/api-worker/src/features/feedback/dbSchema.ts'],
      ['feedback_replies', 'packages/api-worker/src/features/feedback/dbSchema.ts'],
      ['feedbacks', 'packages/api-worker/src/features/feedback/dbSchema.ts'],
      ['fib_round_word_selections', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fib_word_generation_cycles', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fib_word_sequence', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fib_word_supply_state', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fib_word_usages', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fib_words', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['fibking_user_stats', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['game_settlement_results', 'packages/api-worker/src/games/werewolf/dbSchema.ts'],
      ['idempotency_keys', 'packages/api-worker/src/features/gacha/dbSchema.ts'],
      ['login_attempts', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['password_reset_tokens', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['pictionary_user_stats', 'packages/api-worker/src/games/pictionary/dbSchema.ts'],
      ['refresh_token_rotations', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['refresh_tokens', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['room_game_starts', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['room_participants', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['rooms', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['secrethitler_user_stats', 'packages/api-worker/src/games/secrethitler/dbSchema.ts'],
      ['spotmatch_user_stats', 'packages/api-worker/src/games/spotmatch/dbSchema.ts'],
      ['storyrelay_user_stats', 'packages/api-worker/src/games/storyrelay/dbSchema.ts'],
      ['toolbox_identity_presets', 'packages/api-worker/src/games/toolbox/dbSchema.ts'],
      ['undercover_round_word_selections', 'packages/api-worker/src/games/undercover/dbSchema.ts'],
      ['undercover_user_stats', 'packages/api-worker/src/games/undercover/dbSchema.ts'],
      ['undercover_word_packs', 'packages/api-worker/src/games/undercover/dbSchema.ts'],
      ['undercover_word_pairs', 'packages/api-worker/src/games/undercover/dbSchema.ts'],
      ['user_event_inbox', 'packages/api-worker/src/platform/userInbox/dbSchema.ts'],
      ['user_stats', 'packages/api-worker/src/features/account/dbSchema.ts'],
      ['users', 'packages/api-worker/src/features/account/dbSchema.ts'],
      ['werewolf_user_camp_stats', 'packages/api-worker/src/games/werewolf/dbSchema.ts'],
      ['wx_claims', 'packages/api-worker/src/features/auth/dbSchema.ts'],
    ]);
    const actualOwners = workerFiles
      .flatMap((filePath) =>
        getSqliteTableNames(filePath).map(
          (tableName) =>
            [tableName, path.relative(process.cwd(), filePath)] satisfies [string, string],
        ),
      )
      .sort(([left], [right]) => left.localeCompare(right));

    expect(actualOwners).toEqual([...expectedOwners.entries()]);
  });

  it('keeps game-owned DB schemas independent from the runtime driver and removed aggregate', () => {
    const gameSchemaFiles = GAME_TYPES.map((gameType) =>
      path.join(workerGamesDir, gameType, 'dbSchema.ts'),
    ).filter((filePath) => fs.existsSync(filePath));

    expect(gameSchemaFiles.length).toBeGreaterThan(0);
    for (const filePath of gameSchemaFiles) {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      expect(imports.filter((specifier) => /\/db(?:\/index|\/schema)?$/.test(specifier))).toEqual(
        [],
      );
    }
  });

  it('defines each game-owned physical table only in its owner schema', () => {
    const fibSchema = fs.readFileSync(path.join(workerGamesDir, 'fibking', 'dbSchema.ts'), 'utf-8');
    const werewolfSchema = fs.readFileSync(
      path.join(workerGamesDir, 'werewolf', 'dbSchema.ts'),
      'utf-8',
    );

    expect(fibSchema).toMatch(/'fib_words'[\s\S]*'fib_word_usages'/);
    expect(fibSchema).not.toMatch(/camp_settlements|game_settlement_results/);
    expect(werewolfSchema).toMatch(/'camp_settlements'[\s\S]*'game_settlement_results'/);
    expect(werewolfSchema).not.toMatch(/fib_words|fib_word_usages/);
  });

  it('composes multiple concrete Worker games only in the catalog, admin word supply, and Workflow entrypoint', () => {
    const multiGameConsumers = workerFiles.filter((filePath) => {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      const importedGames = GAME_TYPES.filter((gameType) =>
        imports.some((specifier) => specifier.split('/').includes(gameType)),
      );
      return importedGames.length > 1;
    });

    expect(multiGameConsumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'packages/api-worker/src/features/admin/gameWords.ts',
      'packages/api-worker/src/games/catalog.ts',
      'packages/api-worker/src/index.ts',
    ]);
  });

  it('registers game HTTP routes through the Worker catalog only', () => {
    const workerEntryPath = path.join(workerSrcDir, 'index.ts');
    const workerEntry = fs.readFileSync(workerEntryPath, 'utf-8');
    const entryImports = getModuleSpecifiers(workerEntryPath, workerEntry);
    const concreteGameImports = entryImports.filter((specifier) =>
      GAME_TYPES.some((gameType) => specifier.split('/').includes(gameType)),
    );
    const providerNamedRouteOwners = workerFiles.filter((filePath) =>
      fs.readFileSync(filePath, 'utf-8').includes('/gemini-proxy'),
    );

    const declaredWorkflows = GAME_TYPES.flatMap(
      (gameType): readonly GameWorkerWorkflowRegistration[] =>
        GAME_REGISTRY[gameType].workerWorkflows,
    );

    expect(entryImports).toContain('./games/catalog');
    // Export order belongs to simple-import-sort; the contract is the exact set of workflows.
    expect([...concreteGameImports].sort()).toEqual(
      declaredWorkflows.map((workflow) => workflow.modulePath).sort(),
    );
    for (const workflow of declaredWorkflows) {
      expect(workerEntry).toContain(
        `export { ${workflow.exportName} } from '${workflow.modulePath}';`,
      );
    }
    expect(providerNamedRouteOwners).toEqual([]);
  });

  it('welds registry and platform workflows to Wrangler and generated Worker bindings', () => {
    const registeredWorkflows = GAME_TYPES.flatMap((gameType) =>
      GAME_REGISTRY[gameType].workerWorkflows.map((workflow) => ({
        workflowName: workflow.workflowName,
        binding: workflow.binding,
        exportName: workflow.exportName,
      })),
    );
    const platformWorkflows = [
      {
        workflowName: 'word-submission-review',
        binding: 'WORD_SUBMISSION_REVIEW',
        exportName: 'WordSubmissionReviewWorkflow',
      },
    ];
    const expectedWorkflows = [...registeredWorkflows, ...platformWorkflows];
    const wranglerSource = fs.readFileSync(
      path.join(process.cwd(), 'packages/api-worker/wrangler.toml'),
      'utf8',
    );
    const generatedBindings = fs.readFileSync(
      path.join(process.cwd(), 'packages/api-worker/worker-configuration.d.ts'),
      'utf8',
    );

    expect(
      parseWranglerWorkflows(wranglerSource).sort((left, right) =>
        left.binding.localeCompare(right.binding),
      ),
    ).toEqual(
      [...expectedWorkflows].sort((left, right) => left.binding.localeCompare(right.binding)),
    );
    for (const workflow of expectedWorkflows) {
      expect(generatedBindings).toContain(
        `${workflow.binding}: Workflow<Parameters<import("./src/index").${workflow.exportName}['run']>[0]['payload']>;`,
      );
    }
  });
});

describe('Game registry: declared cross-package facts resolve', () => {
  it('keeps only the benchmark behind dynamic imports', () => {
    const dynamicImports: string[] = [];
    for (const file of srcFiles) {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node: ts.Node): void {
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          dynamicImports.push(
            `${path.relative(srcDir, file)}:${node.arguments[0]?.getText(source)}`,
          );
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(dynamicImports.sort()).toEqual(["routes/bench/SceneBenchPage.tsx:'./SceneBench'"]);
  });

  it('points every game at its existing, statically imported client entry module', () => {
    for (const gameType of GAME_TYPES) {
      const clientModulePath = GAME_REGISTRY[gameType].clientModulePath;
      expect(fs.existsSync(path.join(process.cwd(), clientModulePath))).toBe(true);
      expect(clientModulesSource).toContain(`from '@/games/${gameType}/module'`);
    }
  });

  it('points every levelRoll game at an existing Worker settlement entry point', () => {
    for (const gameType of GAME_TYPES) {
      const rewards = GAME_REGISTRY[gameType].rewards;
      if (rewards.policy !== 'levelRoll') continue;

      const settlementModuleFile = path.join(workerSrcDir, `${rewards.settlementModulePath}.ts`);
      expect(fs.existsSync(settlementModuleFile)).toBe(true);

      const settlementModuleSource = fs.readFileSync(settlementModuleFile, 'utf-8');
      const exportPattern = new RegExp(
        `export\\s+(?:async\\s+)?(?:function|const|class)\\s+${rewards.settlementExportName}\\b`,
      );
      expect(settlementModuleSource).toMatch(exportPattern);
    }
  });
});

// ─── Game capabilities: client wiring matches the engine declaration ──────

describe('Game capabilities: client wiring matches the engine declaration', () => {
  it('welds revealAnimation to RevealAnimationGate consumption in every game client', () => {
    for (const gameType of GAME_TYPES) {
      const declared = GAME_ENGINE_CATALOG[gameType].capabilities.revealAnimation;
      const clientSource = getAllProductionFiles(path.join(gamesDir, gameType))
        .map((filePath) => fs.readFileSync(filePath, 'utf-8'))
        .join('\n');
      // The marker is the consumption side: the shared gate every
      // role-card reveal routes through, consumed either directly or
      // through the shared RevealRoleCardModal assembly (whose only
      // render path goes through the gate). The declaration key itself
      // never appears in client source, so this cannot self-prove.
      const wired =
        clientSource.includes('RevealAnimationGate') ||
        clientSource.includes('RevealRoleCardModal');
      expect(declared).toBe(wired);
    }
  });
});

describe('Worker ownership: source tree is exact', () => {
  it('allows only declared top-level production ownership roots', () => {
    expect(getTopLevelProductionDirectories(workerSrcDir)).toEqual([
      'app',
      'db',
      'e2e',
      'features',
      'games',
      'platform',
    ]);
    expect(getTopLevelProductionFiles(workerSrcDir)).toEqual(['env.ts', 'index.ts']);
  });

  it('derives Worker bindings from the committed Wrangler declaration', () => {
    const envPath = path.join(workerSrcDir, 'env.ts');
    const envSource = fs.readFileSync(envPath, 'utf-8');
    const envSourceFile = ts.createSourceFile(
      envPath,
      envSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const envAliases = envSourceFile.statements.filter(
      (statement): statement is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Env',
    );
    const handwrittenEnvInterfaces = envSourceFile.statements.filter(
      (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === 'Env',
    );

    expect(envAliases).toHaveLength(1);
    expect(envAliases[0]?.type.getText(envSourceFile)).toBe('WorkerBindings');
    expect(handwrittenEnvInterfaces).toEqual([]);
    expect(fs.existsSync(path.join(workerDir, 'worker-configuration.d.ts'))).toBe(true);

    const packageJson: unknown = JSON.parse(
      fs.readFileSync(path.join(workerDir, 'package.json'), 'utf-8'),
    );
    if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
      throw new Error('api-worker package.json must contain an object');
    }
    if (
      !('scripts' in packageJson) ||
      typeof packageJson.scripts !== 'object' ||
      packageJson.scripts === null ||
      Array.isArray(packageJson.scripts)
    ) {
      throw new Error('api-worker package.json must define scripts');
    }
    if (
      !('devDependencies' in packageJson) ||
      typeof packageJson.devDependencies !== 'object' ||
      packageJson.devDependencies === null ||
      Array.isArray(packageJson.devDependencies)
    ) {
      throw new Error('api-worker package.json must define devDependencies');
    }
    const workerScripts = parseStringRecord(packageJson.scripts, 'api-worker package.json scripts');
    const workerDevDependencies = parseStringRecord(
      packageJson.devDependencies,
      'api-worker package.json devDependencies',
    );
    expect(workerScripts.dev).not.toContain('FIB_WORD_PROVIDER');
    expect(workerScripts.types).toContain('--env-interface WorkerBindings');
    expect(workerScripts['types:check']).toContain('--check');
    expect(workerScripts.typecheck).toContain('types:check');
    expect(workerDevDependencies).not.toHaveProperty('@cloudflare/workers-types');
  });

  it('binds the local seed subprocess to the Worker Wrangler config', () => {
    const seedPath = path.join(process.cwd(), 'scripts', 'seed-local.mjs');
    const seedSource = fs.readFileSync(seedPath, 'utf-8');
    const seedSourceFile = ts.createSourceFile(
      seedPath,
      seedSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const wranglerCalls: ts.CallExpression[] = [];

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'execFileSync'
      ) {
        wranglerCalls.push(node);
      }
      ts.forEachChild(node, visit);
    }

    visit(seedSourceFile);
    expect(wranglerCalls).toHaveLength(1);

    const commandArguments = wranglerCalls[0]?.arguments[1];
    if (!commandArguments || !ts.isArrayLiteralExpression(commandArguments)) {
      throw new Error('seed-local.mjs must pass a literal argument array to execFileSync');
    }
    const literalArguments = commandArguments.elements
      .filter(ts.isStringLiteralLike)
      .map((argument) => argument.text);
    expect(literalArguments).toEqual([
      'exec',
      'wrangler',
      'd1',
      'execute',
      'werewolf-db',
      '--local',
      '--config=wrangler.toml',
    ]);
  });

  it('derives Pages runtime types from the committed Wrangler declaration', () => {
    const rootPackageJson: unknown = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
    );
    if (
      typeof rootPackageJson !== 'object' ||
      rootPackageJson === null ||
      Array.isArray(rootPackageJson)
    ) {
      throw new Error('root package.json must contain an object');
    }
    if (
      !('scripts' in rootPackageJson) ||
      typeof rootPackageJson.scripts !== 'object' ||
      rootPackageJson.scripts === null ||
      Array.isArray(rootPackageJson.scripts)
    ) {
      throw new Error('root package.json must define scripts');
    }
    if (
      !('devDependencies' in rootPackageJson) ||
      typeof rootPackageJson.devDependencies !== 'object' ||
      rootPackageJson.devDependencies === null ||
      Array.isArray(rootPackageJson.devDependencies)
    ) {
      throw new Error('root package.json must define devDependencies');
    }

    const pagesTsconfig: unknown = JSON.parse(
      fs.readFileSync(path.join(pagesFunctionsDir, 'tsconfig.json'), 'utf-8'),
    );
    if (
      typeof pagesTsconfig !== 'object' ||
      pagesTsconfig === null ||
      Array.isArray(pagesTsconfig) ||
      !('compilerOptions' in pagesTsconfig) ||
      typeof pagesTsconfig.compilerOptions !== 'object' ||
      pagesTsconfig.compilerOptions === null ||
      Array.isArray(pagesTsconfig.compilerOptions) ||
      !('include' in pagesTsconfig) ||
      !Array.isArray(pagesTsconfig.include)
    ) {
      throw new Error('functions/tsconfig.json must define compilerOptions');
    }

    const pagesConfigPath = path.join(process.cwd(), 'wrangler.jsonc');
    const pagesConfigResult = ts.parseConfigFileTextToJson(
      pagesConfigPath,
      fs.readFileSync(pagesConfigPath, 'utf-8'),
    );
    if (pagesConfigResult.error) {
      throw new Error(ts.flattenDiagnosticMessageText(pagesConfigResult.error.messageText, '\n'));
    }
    const pagesConfig: unknown = pagesConfigResult.config;
    expect(pagesConfig).toMatchObject({
      name: 'werewolfgamejudge',
      pages_build_output_dir: './dist',
      compatibility_date: '2026-04-03',
    });
    expect(pagesConfig).not.toHaveProperty('vars');
    expect(fs.existsSync(path.join(pagesFunctionsDir, 'types.d.ts'))).toBe(true);
    expect(pagesTsconfig.compilerOptions).toMatchObject({ lib: ['ES2022'] });
    expect(pagesTsconfig.compilerOptions).not.toHaveProperty('types');
    expect(pagesTsconfig.include).toContain('types.d.ts');
    const rootScripts = parseStringRecord(rootPackageJson.scripts, 'root package.json scripts');
    const rootDevDependencies = parseStringRecord(
      rootPackageJson.devDependencies,
      'root package.json devDependencies',
    );
    expect(rootScripts['types:pages']).toContain('--env-file env/pages-types.env');
    expect(rootScripts['types:pages:check']).toContain('--check');
    expect(rootScripts.typecheck).toContain('tsc -p functions/tsconfig.json --noEmit');
    expect(rootDevDependencies).toHaveProperty('wrangler');
    expect(rootDevDependencies).not.toHaveProperty('@cloudflare/workers-types');
  });

  it('defines the exact non-game feature ownership roots', () => {
    expect(getTopLevelProductionDirectories(path.join(workerSrcDir, 'features'))).toEqual([
      'account',
      'admin',
      'auth',
      'feedback',
      'gacha',
      'sharing',
      'wordSubmissions',
    ]);
  });

  it('keeps account, auth, feedback, and game composition files owner-local', () => {
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'account'))).toEqual([
      'authRoutes.ts',
      'avatarRoutes.ts',
      'dbSchema.ts',
      'gameStats.ts',
      'maintenance.ts',
      'profile.ts',
      'routes.ts',
      'schemas.ts',
      'settleGameRewards.ts',
      'settlementLedger.ts',
    ]);
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'auth'))).toEqual([
      'dbSchema.ts',
      'maintenance.ts',
      'passwordAttemptBudget.ts',
      'passwordHash.ts',
      'passwordResetEmail.ts',
      'routes.ts',
      'schemas.ts',
      'tokenAuth.ts',
    ]);
    expect(getTopLevelProductionDirectories(path.join(workerSrcDir, 'features', 'auth'))).toEqual([
      'wechat',
    ]);
    expect(
      getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'auth', 'wechat')),
    ).toEqual(['WeChatAuthProxy.ts', 'weChatAuthStub.ts']);
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'feedback'))).toEqual([
      'dbSchema.ts',
      'delivery.ts',
      'githubWebhookSchemas.ts',
      'history.ts',
      'routes.ts',
      'schemas.ts',
    ]);
    expect(getTopLevelProductionFiles(workerGamesDir)).toEqual([
      'catalog.ts',
      'publicStatsRoutes.ts',
    ]);
  });

  it('defines the exact shared platform ownership roots', () => {
    expect(getTopLevelProductionDirectories(workerPlatformDir)).toEqual([
      'ai',
      'commands',
      'crypto',
      'gameModules',
      'http',
      'observability',
      'realtime',
      'room',
      'storage',
      'telemetry',
      'time',
      'userInbox',
      'wordSupply',
    ]);
    expect(getTopLevelProductionFiles(path.join(workerPlatformDir, 'time'))).toEqual([
      'canonicalIsoTimestamp.ts',
    ]);
  });

  it('keeps application composition and the schema-free DB driver exact', () => {
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'app'))).toEqual([
      'GameRoom.ts',
      'scheduled.ts',
    ]);
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'db'))).toEqual(['index.ts']);
  });

  it('keeps generic Worker game-module infrastructure platform-owned', () => {
    expect(getTopLevelProductionFiles(path.join(workerPlatformDir, 'gameModules'))).toEqual([
      'effectCommandId.ts',
      'effectDispatch.ts',
      'runtimeGameModule.ts',
      'settleDue.ts',
      'workerModule.ts',
    ]);
  });

  it.each(['__tests__', 'durableObjects', 'handlers', 'lib', 'schemas'])(
    'keeps removed horizontal root %s empty',
    (removedRoot) => {
      expect(getAllProductionFiles(path.join(workerSrcDir, removedRoot))).toEqual([]);
    },
  );
});

describe('Worker request boundary: client objects are strict', () => {
  it('owns Cloudflare request metadata in one platform parser', () => {
    const metadataReaders = workerFiles
      .filter((filePath) => hasPropertyAccess(filePath, 'cf'))
      .map((filePath) => path.relative(process.cwd(), filePath));

    expect(metadataReaders).toEqual(['packages/api-worker/src/platform/http/requestMetadata.ts']);
    expect(getTopLevelProductionFiles(path.join(workerPlatformDir, 'http'))).toEqual([
      'callDurableObject.ts',
      'jsonBody.ts',
      'rateLimit.ts',
      'requestMetadata.ts',
    ]);
  });

  it('uses permissive Zod objects only for external provider payloads', () => {
    const permissiveSchemaFiles = workerFiles
      .filter(hasZodObjectCall)
      .map((filePath) => path.relative(process.cwd(), filePath))
      .sort();

    expect(permissiveSchemaFiles).toEqual([
      'packages/api-worker/src/features/admin/providers/analyticsEngine.ts',
      'packages/api-worker/src/features/admin/providers/workerAnalytics.ts',
      'packages/api-worker/src/features/auth/wechat/WeChatAuthProxy.ts',
      'packages/api-worker/src/features/feedback/githubWebhookSchemas.ts',
      'packages/api-worker/src/features/feedback/providers/github.ts',
      'packages/api-worker/src/games/fibking/wordProviders/gemini.ts',
      'packages/api-worker/src/games/fibking/wordProviders/tavily.ts',
      'packages/api-worker/src/platform/ai/structuredOutput.ts',
    ]);
  });

  const accountFiles = getAllProductionFiles(path.join(workerSrcDir, 'features', 'account'));
  it.each(accountFiles)('%s must not import game composition', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
    expect(imports.filter((specifier) => hasPathSegment(specifier, 'games'))).toEqual([]);
  });
});

describe('Layer boundary: shared room → game-specific code (forbidden)', () => {
  it('should find shared room files to check', () => {
    expect(sharedRoomFiles.length).toBeGreaterThan(0);
  });

  it.each(sharedRoomFiles)('%s must not import a game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter((specifier) => {
      if (specifier.startsWith('@/games/')) return true;
      if (specifier === GAME_ENGINE_PACKAGE) return true;
      if (!specifier.startsWith(`${GAME_ENGINE_PACKAGE}/`)) return false;
      return !isSharedGameEngineSpecifier(specifier);
    });
    expect(violations).toEqual([]);
  });

  const forbiddenGameSemanticIdentifiers =
    /\b(?:ActionResult|RoomCommandOutcome|RoomOperationResult|GameState|GameStatus|LocalGameState|RoleId|GameStore|campStats|roleRevealEffect|playerRoleRevealEffect|wolfVoteBadge|wolfRing|NightProgressIndicator|currentRoleName)\b/;

  it.each(sharedRoomFiles)('%s must use game-neutral room contracts', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content.match(forbiddenGameSemanticIdentifiers)).toBeNull();
  });
});

describe('Layer boundary: product components → game-specific code (forbidden)', () => {
  it('should find product component files to check', () => {
    expect(productComponentFiles.length).toBeGreaterThan(0);
  });

  it.each(productComponentFiles)('%s must not import a game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter((specifier) => {
      if (specifier.startsWith('@/games/')) return true;
      if (specifier === GAME_ENGINE_PACKAGE) return true;
      if (!specifier.startsWith(`${GAME_ENGINE_PACKAGE}/`)) return false;
      return !isSharedGameEngineSpecifier(specifier);
    });
    expect(violations).toEqual([]);
  });
});

describe('Layer boundary: game modules are isolated', () => {
  const gameRoots = [
    {
      layer: 'client',
      root: gamesDir,
      compositionDirectories: ['__tests__', 'model'],
    },
    { layer: 'engine', root: engineGamesDir, compositionDirectories: [] },
    { layer: 'worker', root: workerGamesDir, compositionDirectories: ['__tests__'] },
  ];

  it.each(gameRoots)(
    '$layer defines exactly one concrete directory per canonical game',
    ({ root, compositionDirectories }) => {
      const compositionDirectorySet = new Set<string>(compositionDirectories);
      const concreteDirectories = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !compositionDirectorySet.has(entry.name))
        .map((entry) => entry.name)
        .sort();

      expect(concreteDirectories).toEqual([...GAME_TYPES].sort());

      for (const gameType of GAME_TYPES) {
        expect(getAllProductionFiles(path.join(root, gameType)).length).toBeGreaterThan(0);
      }
    },
  );

  for (const { layer, root } of gameRoots) {
    for (const gameType of GAME_TYPES) {
      const files = getAllProductionFiles(path.join(root, gameType));
      it.each(files)(`${layer} ${gameType}: %s must not import another game`, (filePath) => {
        const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
        const otherGameTypes = GAME_TYPES.filter((candidate) => candidate !== gameType);
        const offenders = imports.filter((specifier) =>
          otherGameTypes.some((otherGameType) => specifier.split('/').includes(otherGameType)),
        );
        expect(offenders).toEqual([]);
      });
    }
  }
});

describe('Client ownership: game-specific modules stay in game slices', () => {
  it('does not restore a game-owned facade abstraction', () => {
    const offenders = getAllProductionFiles(gamesDir).flatMap((filePath) => {
      const relativePath = repoPath(filePath);
      const identifiers = getIdentifierNames(filePath).filter((name) => /facade/i.test(name));
      const fileViolation = /facade/i.test(path.basename(filePath)) ? [relativePath] : [];
      return [...fileViolation, ...identifiers.map((name) => `${relativePath}:${name}`)];
    });

    expect(offenders).toEqual([]);
  });
});

describe('Client ownership: horizontal catch-all roots stay empty', () => {
  const removedCatchAllRoots = ['hooks', 'lib', 'services/feature'];

  it.each(removedCatchAllRoots)('%s must not own production modules', (relativePath) => {
    expect(getAllProductionFiles(path.join(srcDir, relativePath))).toEqual([]);
  });
});

describe('Client storage ownership', () => {
  it('touches Web Storage only from the infrastructure storage primitive', () => {
    const consumers = srcFiles.filter((filePath) =>
      /\b(?:localStorage|sessionStorage)\s*\./.test(fs.readFileSync(filePath, 'utf-8')),
    );

    // The mini-program claim nonce is read before any service exists, on the WeChat entry path.
    expect(consumers.map(repoPath).sort()).toEqual([
      'packages/web/src/services/infra/localStorage.ts',
      'packages/web/src/utils/miniProgram.ts',
    ]);
  });

  it('keeps direct local-storage access inside service or platform ownership', () => {
    const consumers = srcFiles.filter((filePath) =>
      getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8')).includes(
        '@/services/infra/localStorage',
      ),
    );
    const offenders = consumers.filter((filePath) => {
      const segments = path.relative(srcDir, filePath).split(path.sep);
      return segments[0] !== 'platform' && !segments.includes('services');
    });

    expect(offenders.map(repoPath)).toEqual([]);
  });
});

/**
 * The literal patterns of every Vite `import.meta.glob(...)` in a file: a glob imports modules
 * too, so the Ark/zag gate checks it like an import. A non-literal pattern fails fast.
 */
function viteGlobPatterns(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  if (!source.includes('import.meta.glob')) return [];
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const patterns: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === 'import.meta.glob') {
      const [pattern, options] = node.arguments;
      // `base` re-roots the patterns, `exhaustive` searches node_modules and `caseSensitive`
      // would let `NODE_MODULES` through; only options that cannot move the search are allowed.
      const GLOB_OPTIONS = ['eager', 'import', 'query'];
      if (
        options !== undefined &&
        (!ts.isObjectLiteralExpression(options) ||
          options.properties.some(
            (property) =>
              !ts.isPropertyAssignment(property) ||
              !GLOB_OPTIONS.includes(property.name.getText(sourceFile)),
          ))
      ) {
        throw new Error(
          `[FAIL-FAST] ${repoPath(filePath)}: import.meta.glob options may only set ${GLOB_OPTIONS.join(', ')}`,
        );
      }
      const literals =
        pattern !== undefined && ts.isArrayLiteralExpression(pattern)
          ? pattern.elements
          : [pattern];
      for (const literal of literals) {
        if (literal === undefined || !ts.isStringLiteralLike(literal)) {
          throw new Error(
            `[FAIL-FAST] ${repoPath(filePath)}: import.meta.glob needs literal patterns`,
          );
        }
        // Only the file-name segment may be a wildcard, never `**`, and never under node_modules:
        // a wildcard directory (`**`, `@ark-*`, `{a,b}`) could reach a package the gate cannot name.
        const segments = literal.text.split('/');
        if (
          segments.some(
            (segment) => segment.toLowerCase() === 'node_modules' || segment === '**',
          ) ||
          segments.slice(0, -1).some((segment) => /[*?{}[\]]/.test(segment))
        ) {
          throw new Error(
            `[FAIL-FAST] ${repoPath(filePath)}: import.meta.glob may only wildcard file names outside node_modules`,
          );
        }
        // A glob may only load asset files, so it can never reach a module, wherever it points.
        if (!/\.(?:webp|png|svg|mp3)$/.test(literal.text)) {
          throw new Error(
            `[FAIL-FAST] ${repoPath(filePath)}: import.meta.glob may only match asset files`,
          );
        }
        patterns.push(literal.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return patterns;
}

describe('Client dialogs: one Ark dialog root', () => {
  // zag closes every dismissable layer above a layer that is removed. AppDialog's root blocks
  // that cascade (see its file header), so it is the only module that may import Ark's dialog.
  // Other Ark/zag parts that open dismissable layers (drawer, popover, menu, select, hover card,
  // a non-inline color picker, the bare barrels, zag's own packages) would bring the cascade
  // back. Ark and zag are therefore imported only by their owning shared modules — AppDialog
  // for the dialog, InlineColorPicker (always inline) for the color picker — or for parts that
  // open no layer.
  const LAYERLESS_ARK_PARTS = [
    '@ark-ui/react/portal',
    '@ark-ui/react/qr-code',
    '@ark-ui/react/tabs',
  ];
  const OWNED_ARK_PARTS: Readonly<Record<string, string>> = {
    '@ark-ui/react/dialog': 'packages/web/src/components/AppDialog.tsx',
    '@ark-ui/react/color-picker': 'packages/web/src/components/InlineColorPicker.tsx',
  };

  it('imports Ark and zag only through their shared owners or parts that open no layer', () => {
    // The gate judges what an import resolves to, not how it is written: starting from every
    // script under packages/web (tests and stories included), it follows each import that
    // resolves to a repo file — inside packages/web or not — and fails any import that resolves
    // into Ark or zag unless it is an owner's part or a layerless one. Resolution uses the web
    // tsconfig, whose paths the next test pins to the same aliases Vite uses.
    const config: unknown = ts.readConfigFile(
      path.join(webDir, 'tsconfig.json'),
      ts.sys.readFile,
    ).config;
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, webDir);
    // allowJs: a script module resolves too, typed or not.
    const compilerOptions = { ...parsed.options, allowJs: true };
    const queue = fs
      .readdirSync(webDir, { recursive: true, encoding: 'utf-8' })
      .filter((file) => !/(?:^|\/)(?:node_modules|dist)\//.test(file))
      .filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file) && !file.endsWith('.d.ts'))
      .map((file) => path.join(webDir, file));
    const visited = new Set(queue);
    const offenders: string[] = [];
    // for…of also visits the files pushed while walking.
    for (const filePath of queue) {
      viteGlobPatterns(filePath);
      for (const specifier of getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'))) {
        const resolved = ts.resolveModuleName(specifier, filePath, compilerOptions, ts.sys)
          .resolvedModule?.resolvedFileName;
        // A relative or aliased script import that does not resolve would hide its target.
        if (
          resolved === undefined &&
          /^(?:\.|\/|@\/|@game-judge\/)/.test(specifier) &&
          // a script, or no extension at all; assets (`.css`, `.webp`, `?url`) are not modules
          /(?:^|\/)[^./]*$|\.[cm]?[jt]sx?$/.test(specifier.replace(/\?.*$/, ''))
        ) {
          throw new Error(`[FAIL-FAST] ${repoPath(filePath)}: cannot resolve ${specifier}`);
        }
        const target = resolved === undefined ? specifier : fs.realpathSync(resolved);
        if (/(?:^|\/)@(?:ark-ui|zag-js)\//i.test(target)) {
          if (
            !LAYERLESS_ARK_PARTS.includes(specifier) &&
            OWNED_ARK_PARTS[specifier] !== repoPath(filePath)
          ) {
            offenders.push(`${repoPath(filePath)}: ${specifier}`);
          }
        } else if (
          resolved !== undefined &&
          !target.includes(`${path.sep}node_modules${path.sep}`) &&
          !target.endsWith('.d.ts') &&
          !visited.has(target)
        ) {
          visited.add(target);
          queue.push(target);
        }
      }
    }

    expect(offenders).toEqual([]);
    // An inline module script in an HTML entry imports modules too.
    const htmlFiles = fs
      .readdirSync(webDir, { recursive: true, encoding: 'utf-8' })
      .filter((file) => !/(?:^|\/)(?:node_modules|dist)\//.test(file) && file.endsWith('.html'));
    expect(htmlFiles.length).toBeGreaterThan(0);
    expect(
      htmlFiles.filter((file) =>
        /@(?:ark-ui|zag-js)\//i.test(fs.readFileSync(path.join(webDir, file), 'utf-8')),
      ),
    ).toEqual([]);
  });

  it('resolves modules only through the two pinned aliases', () => {
    // An alias (Vite `resolve.alias`, tsconfig `paths`) or a plugin resolver could map an
    // innocent specifier onto Ark or zag, so the aliases are an allowlist and no build plugin
    // resolves or loads modules.
    const readJson = (file: string) =>
      z
        .object({ compilerOptions: z.object({ paths: z.unknown().optional() }) })
        .parse(ts.readConfigFile(path.join(process.cwd(), file), ts.sys.readFile).config)
        .compilerOptions.paths;
    expect(readJson('packages/web/tsconfig.json')).toEqual({
      '@/*': ['./src/*'],
      '@game-judge/game-engine/*': ['../game-engine/src/*'],
    });
    expect(readJson('tsconfig.json')).toEqual({
      '@game-judge/game-engine/*': ['./packages/game-engine/src/*'],
    });
    const viteConfig = fs.readFileSync(path.join(webDir, 'vite.config.ts'), 'utf-8');
    const aliasBlock = /alias: \[([\s\S]*?)\n {4}\],/.exec(viteConfig)?.[1] ?? '';
    expect(
      aliasBlock
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('//')),
    ).toEqual([
      '{ find: /^@\\//, replacement: `${sourceDirectory}/` },',
      '{ find: /^@game-judge\\/game-engine\\//, replacement: `${engineSourceDirectory}/` },',
    ]);
    expect(viteConfig.match(/\balias\b/g)).toHaveLength(1);
    const pluginBlock = /plugins: \[([\s\S]*?)\n {2}\],/.exec(viteConfig)?.[1] ?? '';
    expect(
      pluginBlock
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('//')),
    ).toEqual([
      'react(),',
      'babel({ presets: [reactCompilerPreset()] }),',
      "Icons({ compiler: 'jsx', jsx: 'react' }),",
      'bootSplash(),',
    ]);
    expect(viteConfig.match(/\bplugins: /g)).toHaveLength(1);
    const pluginSources = fs
      .readdirSync(path.join(webDir, 'build-plugins'))
      .map((file) => fs.readFileSync(path.join(webDir, 'build-plugins', file), 'utf-8'));
    expect(pluginSources.filter((source) => /\b(?:resolveId|load|alias)\b/.test(source))).toEqual(
      [],
    );
  });

  it('reaches zag only through Ark, which only the web package depends on by its own name', () => {
    // A library built on Ark or zag shares zag's layer stack and would bring the cascade back
    // under a package name the import gate does not know; so would an alias to either scope.
    // The lockfile records every dependency edge, aliased or not, so it is checked whole.
    const DEPENDENCY_KINDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
    const dependencyMap = z.record(
      z.string(),
      z.union([z.string(), z.object({ specifier: z.string(), version: z.string() })]),
    );
    const dependencyGroups = z
      .object(Object.fromEntries(DEPENDENCY_KINDS.map((kind) => [kind, dependencyMap.optional()])))
      .nullable();
    const lockfile = z
      .object({
        importers: z.record(z.string(), dependencyGroups),
        snapshots: z.record(z.string(), dependencyGroups),
      })
      .parse(parse(fs.readFileSync(path.join(process.cwd(), 'pnpm-lock.yaml'), 'utf-8')));
    const ARK_OR_ZAG = /(?:^|[/:])@(?:ark-ui|zag-js)\//i;
    const packageName = (key: string): string => key.slice(0, key.indexOf('@', 1));
    // `dependent -> name: resolution` for every edge whose name or resolution is Ark or zag.
    const edges = (
      entries: Record<string, z.infer<typeof dependencyGroups>>,
      dependentName: (key: string) => string,
    ): string[] =>
      Object.entries(entries).flatMap(([key, groups]) =>
        DEPENDENCY_KINDS.flatMap((kind) =>
          Object.entries(groups?.[kind] ?? {}).flatMap(([name, entry]) => {
            const resolution =
              typeof entry === 'string' ? entry : `${entry.specifier} ${entry.version}`;
            return ARK_OR_ZAG.test(name) || ARK_OR_ZAG.test(resolution)
              ? [`${dependentName(key)} -> ${name}: ${resolution}`]
              : [];
          }),
        ),
      );
    const importerEdges = edges(lockfile.importers, (key) => key);
    const snapshotEdges = edges(lockfile.snapshots, packageName).filter(
      // zag's packages depend on each other, and Ark on zag; nothing else may reach either.
      (edge) =>
        !edge.startsWith('@zag-js/') &&
        !(edge.startsWith('@ark-ui/react -> @zag-js/') && !edge.includes('npm:')),
    );

    // Only the web package, by Ark's own name and without an `npm:` alias.
    expect(importerEdges.map((edge) => edge.slice(0, edge.indexOf(':')))).toEqual([
      'packages/web -> @ark-ui/react',
    ]);
    expect(importerEdges.filter((edge) => edge.includes('npm:'))).toEqual([]);
    expect(snapshotEdges).toEqual([]);
    // Node subpath imports (`"imports": { "#x": "@ark-ui/..." }`) are aliases too.
    const manifestsImportingArkOrZag = [
      'package.json',
      ...['web', 'game-engine', 'api-worker'].map((name) => `packages/${name}/package.json`),
    ].filter((file) => {
      const manifest = z
        .object({ imports: z.unknown().optional() })
        .parse(JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf-8')));
      return /@(?:ark-ui|zag-js)\//.test(JSON.stringify(manifest.imports ?? {}));
    });
    expect(manifestsImportingArkOrZag).toEqual([]);
  });
});

describe('Client room creation ownership', () => {
  const concreteGameFiles = GAME_TYPES.flatMap((gameType) =>
    getAllProductionFiles(path.join(gamesDir, gameType)),
  );
  const applicationCreationModules = [
    '@/features/room/services/RoomCreationIntentStore',
    '@/features/room/services/RoomCreationService',
    '@/services/cloudflare/CFRoomDirectoryService',
  ];

  it.each(concreteGameFiles)(
    '%s must create rooms through the shared React controller',
    (filePath) => {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      const violations = imports.filter((specifier) =>
        applicationCreationModules.includes(specifier),
      );

      expect(violations).toEqual([]);
    },
  );

  it('composes the room creation application service only at the app root', () => {
    for (const moduleSpecifier of applicationCreationModules) {
      const consumers = srcFiles.filter((filePath) =>
        getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8')).includes(moduleSpecifier),
      );
      const expected =
        moduleSpecifier === '@/features/room/services/RoomCreationIntentStore'
          ? [
              'packages/web/src/app/services.ts',
              'packages/web/src/features/room/services/RoomCreationService.ts',
            ]
          : ['packages/web/src/app/services.ts'];

      expect(consumers.map((filePath) => path.relative(process.cwd(), filePath)).sort()).toEqual(
        expected,
      );
    }
  });

  it('keeps direct room-directory creation inside the application service', () => {
    const consumers = srcFiles.filter((filePath) =>
      /\broomDirectory\s*\.\s*createRoom\s*\(/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(consumers.map(repoPath)).toEqual([
      'packages/web/src/features/room/services/RoomCreationService.ts',
    ]);
  });
});

describe('Client ownership: Home and root navigation stay game-neutral', () => {
  const genericHostFiles = [
    ...getAllProductionFiles(path.join(routesDir, 'home')),
    ...getAllProductionFiles(path.join(routesDir, 'games')),
    ...getAllProductionFiles(path.join(routesDir, 'room')),
    ...getAllProductionFiles(path.join(routesDir, 'game')),
    ...getAllProductionFiles(path.join(srcDir, 'features', 'navigation')),
    ...getAllProductionFiles(path.join(srcDir, 'app')),
    ...getAllProductionFiles(path.join(gamesDir, 'model')),
  ];

  it.each(genericHostFiles)('%s must not import a concrete game implementation', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter(
      (specifier) =>
        GAME_TYPES.some(
          (gameType) =>
            specifier.startsWith(`@/games/${gameType}`) ||
            specifier.startsWith(`@game-judge/game-engine/games/${gameType}`),
        ) || specifier.startsWith('@game-judge/game-engine/models/'),
    );
    expect(violations).toEqual([]);
  });

  it.each(genericHostFiles)('%s must not branch on a literal game type', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const gameType of GAME_TYPES) {
      expect(content).not.toMatch(new RegExp(`['"]${gameType}['"]`));
    }
  });

  it('composes multiple concrete client games only in the two exhaustive catalogs', () => {
    const multiGameConsumers = srcFiles.filter((filePath) => {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      const importedGames = GAME_TYPES.filter((gameType) =>
        imports.some((specifier) => specifier.split('/').includes(gameType)),
      );
      return importedGames.length > 1;
    });

    // catalog.ts holds Home entries; clientModules.tsx holds the room module factories.
    const catalogs = [
      'packages/web/src/games/catalog.ts',
      'packages/web/src/games/clientModules.tsx',
    ];
    expect(multiGameConsumers.map(repoPath).filter((file) => !catalogs.includes(file))).toEqual([]);
  });
});

describe('Client ownership: generic audio stays game-neutral', () => {
  it('keeps Werewolf narration out of the platform AudioService', () => {
    const filePath = path.join(servicesDir, 'infra', 'AudioService.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    const gameEngineViolations = getModuleSpecifiers(filePath, content).filter(
      (specifier) =>
        specifier === GAME_ENGINE_PACKAGE ||
        (specifier.startsWith(`${GAME_ENGINE_PACKAGE}/`) &&
          !isSharedGameEngineSpecifier(specifier)),
    );

    expect(content).not.toMatch(/\bRoleId\b|playRole|playNight|preloadForRoles|AUDIO_REGISTRY/);
    expect(gameEngineViolations).toEqual([]);
  });
});

describe('Client ownership: RoomLink has one implementation', () => {
  it('defines exactly one RoomLink implementation in production client code', () => {
    const implementations = srcFiles.filter((filePath) =>
      /\bclass\s+RoomLinkImpl\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(implementations.map(repoPath)).toEqual([
      'packages/web/src/platform/realtime/RoomLink.ts',
    ]);
  });

  it('is instantiated only by the production room-link factory and its test harness', () => {
    const constructors = srcFiles.filter((filePath) =>
      /\bnew\s+RoomLinkImpl\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(constructors.map(repoPath).sort()).toEqual([
      'packages/web/src/platform/realtime/RoomLinkFactory.ts',
      'packages/web/src/test-utils/roomLink.ts',
    ]);
  });
});

describe('Production types: no ordinary assertions', () => {
  it('detects both assertion syntaxes while allowing const assertions', () => {
    const fixturePath = path.join(process.cwd(), 'ordinary-assertion-fixture.ts');
    const fixture = [
      'const first = value as string;',
      'const second = <string>value;',
      'const allowed = value as const;',
    ].join('\n');

    expect(getOrdinaryTypeAssertions(fixturePath, fixture)).toEqual([
      'ordinary-assertion-fixture.ts:1',
      'ordinary-assertion-fixture.ts:2',
    ]);
  });

  it('allows only const assertions across all runtime packages', () => {
    const violations = [...srcFiles, ...gameEngineFiles, ...workerFiles].flatMap((filePath) =>
      getOrdinaryTypeAssertions(filePath),
    );

    expect(violations).toEqual([]);
  });
});

describe('Client composition: one game-neutral catalog provider', () => {
  const compositionRootFiles = [
    path.join(srcDir, 'main.tsx'),
    ...getAllProductionFiles(path.join(srcDir, 'app')),
  ];

  it.each(compositionRootFiles)('%s must not import a concrete game module', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter(
      (specifier) =>
        specifier.startsWith('@/games/') &&
        specifier !== '@/games/catalog' &&
        specifier !== '@/games/clientModules' &&
        !specifier.startsWith('@/games/model/'),
    );
    expect(violations).toEqual([]);
  });

  it('does not define a provider or React context inside a concrete game slice', () => {
    const concreteGameFiles = getAllProductionFiles(gamesDir).filter((filePath) => {
      const relativePath = path.relative(gamesDir, filePath);
      return relativePath.split(path.sep).length > 1;
    });
    const offenders = concreteGameFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return /\bcreateContext\s*[<(]|\b[A-Z]\w*GameProvider\b/.test(content);
    });

    expect(offenders.map(repoPath)).toEqual([]);
  });
});

// ─── Rule 3: routes/ must call feature APIs instead of infrastructure ────────

describe('Layer boundary: routes → services runtime imports (forbidden)', () => {
  it('should find route files to check', () => {
    expect(routesFiles.length).toBeGreaterThan(0);
  });

  it.each(routesFiles)('%s must not runtime import services/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getRuntimeModuleSpecifiers(filePath, content).filter((specifier) =>
      specifier.startsWith('@/services/'),
    );

    expect(violations).toEqual([]);
  });
});

describe('Room seat taps: in-game adjudication is the shared resolveRoomInGameSeatTap', () => {
  const consumerPaths = ['features/room/controllers/createRoomSeatPressHandler.ts'];

  it.each(consumerPaths)(
    '%s routes in-game taps through the shared adjudicator',
    (relativePath) => {
      const source = fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
      expect(source).toContain('resolveRoomInGameSeatTap(');
    },
  );

  // Every game executes seat presses through the shared handler. Games whose
  // profiles are lobby-only sit on useRoomSetupController; games that keep
  // profiles open through play (werewolf baseline) own their capability set
  // over the shared roster controller and open profiles from inGameAction.
  const setupControllerGames: Partial<Record<GameType, string>> = {
    avalon: 'games/avalon/room/hooks/useAvalonRoomState.ts',
    storyrelay: 'games/storyrelay/room/hooks/useStoryRelayRoomState.ts',
    drawguess: 'games/drawguess/room/hooks/useDrawGuessRoomState.ts',
    decrypto: 'games/decrypto/room/hooks/useDecryptoRoomState.ts',
    pictionary: 'games/pictionary/room/hooks/usePictionaryRoomState.ts',
    spotmatch: 'games/spotmatch/room/hooks/useSpotmatchRoomState.ts',
    secrethitler: 'games/secrethitler/room/hooks/useSecrethitlerRoomState.ts',
  };
  const rosterControllerGames: Partial<Record<GameType, string>> = {
    fibking: 'games/fibking/room/hooks/useFibRoomState.ts',
    undercover: 'games/undercover/room/hooks/useUndercoverRoomState.ts',
    werewolf: 'games/werewolf/room/hooks/useWerewolfRoomState.ts',
  };

  // Games without numbered seats have no seat presses: participation is a seatless
  // join expressed by the game's own view, never through the shared seat handler.
  const seatlessGames: Partial<Record<GameType, string>> = {
    toolbox: 'games/toolbox/room/useToolboxRoomState.ts',
  };

  it('assigns every game exactly one seat-press composition', () => {
    expect(
      [
        ...Object.keys(setupControllerGames),
        ...Object.keys(rosterControllerGames),
        ...Object.keys(seatlessGames),
      ].sort(),
    ).toEqual([...GAME_TYPES].sort());
  });

  it('seatless games never route through the shared seat-press handler', () => {
    for (const relativePath of Object.values(seatlessGames)) {
      const source = fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
      expect(source).not.toContain('createRoomSeatPressHandler(');
    }
  });

  it('lobby-profile games delegate setup and seat presses to shared controllers', () => {
    for (const gameType of GAME_TYPES) {
      const relativePath = setupControllerGames[gameType];
      if (relativePath === undefined) continue;
      const source = fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
      expect(source).toContain('createRoomSeatPressHandler(');
      expect(source).toContain('useRoomSetupController(');
    }
  });

  it('in-play-profile games keep profiles open over the shared roster controller', () => {
    for (const gameType of GAME_TYPES) {
      const relativePath = rosterControllerGames[gameType];
      if (relativePath === undefined) continue;
      const source = fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
      expect(source).toContain('useRoomRosterController(');
      expect(source).toContain('createRoomSeatPressHandler(');
      expect(source).toMatch(/inGameAction/);
    }
  });

  it('the shared setup controller composes the shared roster controller', () => {
    const source = fs.readFileSync(
      path.join(srcDir, 'features/room/controllers/useRoomSetupController.ts'),
      'utf-8',
    );
    expect(source).toContain('useRoomRosterController(');
  });
});
