/**
 * architecture.contract — Layer boundary guard
 *
 * Enforces the project's unidirectional dependency rules:
 *   UI → shared room or game-owned runtime → platform protocols
 *   UI → Application → Infrastructure (services/infra, services/transport)
 *
 * Forbidden directions:
 *   - services/ → screens/  (infra must not know about UI)
 *   - game-engine → @/ or src/ client code  (domain is leaf)
 *   - screens/ → services/ with runtime (non-type) imports
 */

import fs from 'node:fs';
import path from 'node:path';

import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import ts from 'typescript';

import {
  getModuleSpecifiers,
  getRuntimeModuleSpecifiers,
} from '../../packages/game-engine/src/platform/__tests__/moduleSpecifiers';

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

function getUnsafeTypeAssertions(filePath: string): readonly string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const isEscapeType =
        node.type.kind === ts.SyntaxKind.AnyKeyword ||
        node.type.kind === ts.SyntaxKind.NeverKeyword;
      const isDoubleAssertion =
        ts.isAsExpression(node.expression) || ts.isTypeAssertionExpression(node.expression);

      if (isEscapeType || isDoubleAssertion) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        violations.push(`${path.relative(process.cwd(), filePath)}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function getUnvalidatedCloudflareCalls(filePath: string): readonly string[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const decoderIndexes = new Map([
    ['cfGet', 1],
    ['cfPost', 2],
    ['cfPut', 2],
    ['cfUpload', 2],
  ]);
  const violations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const decoderIndex = decoderIndexes.get(node.expression.text);
      if (decoderIndex !== undefined) {
        const decoder = node.arguments[decoderIndex];
        const identityParameter =
          decoder !== undefined && ts.isArrowFunction(decoder) ? decoder.parameters[0] : undefined;
        const isIdentityArrow =
          decoder !== undefined &&
          ts.isArrowFunction(decoder) &&
          decoder.parameters.length === 1 &&
          identityParameter !== undefined &&
          ts.isIdentifier(identityParameter.name) &&
          ts.isIdentifier(decoder.body) &&
          decoder.body.text === identityParameter.name.text;
        if (node.typeArguments !== undefined || decoder === undefined || isIdentityArrow) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          violations.push(`${path.relative(process.cwd(), filePath)}:${line}`);
        }
      }
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

const screensDir = path.join(process.cwd(), 'src', 'screens');
const homeScreenDir = path.join(screensDir, 'HomeScreen');
const productComponentsDir = path.join(process.cwd(), 'src', 'components');
const sharedRoomDir = path.join(process.cwd(), 'src', 'features', 'room');
const gamesDir = path.join(process.cwd(), 'src', 'games');
const servicesDir = path.join(process.cwd(), 'src', 'services');
const srcDir = path.join(process.cwd(), 'src');
const gameEngineDir = path.join(process.cwd(), 'packages', 'game-engine', 'src');
const engineGamesDir = path.join(gameEngineDir, 'games');
const workerDir = path.join(process.cwd(), 'packages', 'api-worker');
const workerSrcDir = path.join(workerDir, 'src');
const workerPlatformDir = path.join(workerSrcDir, 'platform');
const workerGamesDir = path.join(workerSrcDir, 'games');
const pagesFunctionsDir = path.join(process.cwd(), 'functions');

const screensFiles = getAllProductionFiles(screensDir);
const productComponentFiles = getAllProductionFiles(productComponentsDir);
const sharedRoomFiles = getAllProductionFiles(sharedRoomDir);
const servicesFiles = getAllProductionFiles(servicesDir);
const srcFiles = getAllProductionFiles(srcDir);
const gameEngineFiles = getAllProductionFiles(gameEngineDir);
const workerPlatformFiles = getAllProductionFiles(workerPlatformDir);
const workerFiles = getAllProductionFiles(workerSrcDir);
const workerFileSet = new Set(workerFiles);

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

  it.each(servicesFiles)('%s must not import screens/ or games/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter(
      (specifier) => hasPathSegment(specifier, 'screens') || specifier.startsWith('@/games/'),
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

  it.each(consumerFiles)('%s must not import the aggregate package root', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
    expect(imports.filter((specifier) => specifier === GAME_ENGINE_PACKAGE)).toEqual([]);
  });

  it.each(consumerFiles)('%s must not import a game-owned domain deep path', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
    expect(imports.filter(isGameDomainSpecifier)).toEqual([]);
  });

  it.each(consumerFiles)('%s must not import a game testing API in production', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
    expect(imports.filter(isGameTestingSpecifier)).toEqual([]);
  });

  it.each(consumerFiles)('%s must not import a removed engine ownership path', (filePath) => {
    const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
    const violations = imports.filter((specifier) =>
      removedOwnershipPrefixes.some(
        (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
      ),
    );
    expect(violations).toEqual([]);
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
      ['camp_settlements', 'packages/api-worker/src/games/werewolf/dbSchema.ts'],
      ['draw_history', 'packages/api-worker/src/features/gacha/dbSchema.ts'],
      ['feedback_replies', 'packages/api-worker/src/features/feedback/dbSchema.ts'],
      ['feedbacks', 'packages/api-worker/src/features/feedback/dbSchema.ts'],
      ['fib_word_generation_results', 'packages/api-worker/src/games/fibking/dbSchema.ts'],
      ['game_settlement_results', 'packages/api-worker/src/games/werewolf/dbSchema.ts'],
      ['idempotency_keys', 'packages/api-worker/src/features/gacha/dbSchema.ts'],
      ['login_attempts', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['password_reset_tokens', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['refresh_tokens', 'packages/api-worker/src/features/auth/dbSchema.ts'],
      ['room_game_starts', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['room_participants', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['rooms', 'packages/api-worker/src/platform/room/dbSchema.ts'],
      ['user_event_inbox', 'packages/api-worker/src/platform/userEvents/dbSchema.ts'],
      ['user_stats', 'packages/api-worker/src/features/account/dbSchema.ts'],
      ['users', 'packages/api-worker/src/features/account/dbSchema.ts'],
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

    expect(fibSchema).toContain("'fib_word_generation_results'");
    expect(fibSchema).not.toMatch(/camp_settlements|game_settlement_results/);
    expect(werewolfSchema).toMatch(/'camp_settlements'[\s\S]*'game_settlement_results'/);
    expect(werewolfSchema).not.toContain('fib_word_generation_results');
  });

  it('composes multiple concrete Worker games only in the exhaustive catalog', () => {
    const multiGameConsumers = workerFiles.filter((filePath) => {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      const importedGames = GAME_TYPES.filter((gameType) =>
        imports.some((specifier) => specifier.split('/').includes(gameType)),
      );
      return importedGames.length > 1;
    });

    expect(multiGameConsumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'packages/api-worker/src/games/catalog.ts',
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

    expect(entryImports).toContain('./games/catalog');
    expect(concreteGameImports).toEqual([]);
    expect(providerNamedRouteOwners).toEqual([]);
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
    expect(workerScripts.dev).toContain('--var FIB_WORD_PROVIDER:local');
    expect(workerScripts.types).toContain('--env-interface WorkerBindings');
    expect(workerScripts['types:check']).toContain('--check');
    expect(workerScripts.typecheck).toContain('types:check');
    expect(workerDevDependencies).not.toHaveProperty('@cloudflare/workers-types');
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
    ]);
  });

  it('keeps account, auth, feedback, and game composition files owner-local', () => {
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'account'))).toEqual([
      'authRoutes.ts',
      'avatarRoutes.ts',
      'dbSchema.ts',
      'maintenance.ts',
      'profile.ts',
      'routes.ts',
      'schemas.ts',
    ]);
    expect(getTopLevelProductionFiles(path.join(workerSrcDir, 'features', 'auth'))).toEqual([
      'dbSchema.ts',
      'maintenance.ts',
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
      'githubWebhookSchemas.ts',
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
      'crypto',
      'gameModules',
      'http',
      'observability',
      'room',
      'telemetry',
      'time',
      'userEvents',
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
      'runtimeGameModule.ts',
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
      'packages/api-worker/src/features/auth/wechat/WeChatAuthProxy.ts',
      'packages/api-worker/src/features/feedback/githubWebhookSchemas.ts',
      'packages/api-worker/src/features/feedback/providers/github.ts',
      'packages/api-worker/src/games/fibking/wordProviders/gemini.ts',
      'packages/api-worker/src/games/fibking/wordProviders/workersAi.ts',
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
      if (specifier.startsWith('@/screens/RoomScreen/')) return true;
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
  const removedPaths = [
    'src/screens/RoomScreen',
    'src/services/registry.ts',
    'src/services/facade',
    'src/services/types/IGameFacade.ts',
    'src/contexts/GameFacadeContext.tsx',
    'src/services/cloudflare/CFRoomService.ts',
    'src/services/types/IRoomService.ts',
    'src/features/room/services/RoomCommandDispatcher.ts',
    'src/features/room/services/RoomSession.ts',
    'src/features/room/services/completeRoomCreation.ts',
    'src/features/room/services/roomCommandClient.ts',
    'src/features/room/services/roomSeatCommands.ts',
    'src/features/room/controllers/useRoomLifecycle.ts',
    'src/features/room/controllers/useRoomSessionStatus.ts',
    'src/features/room/controllers/useRoomConnection.ts',
    'src/features/room/model/GameUiModule.ts',
    'src/games/model/GameProductUi.ts',
    'src/services/infra/audio/audioRegistry.ts',
    'src/utils/roleBadges.ts',
    'src/utils/roleBadges.web.ts',
    'src/games/werewolf/hooks/useWerewolfRoomLifecycle.ts',
    'src/games/werewolf/room/components/AuthGateOverlay.tsx',
    'src/games/werewolf/room/components/WxAuthFailedOverlay.tsx',
    'src/screens/BoardPickerScreen',
    'src/screens/ConfigScreen',
    'src/screens/EncyclopediaScreen',
    'src/screens/GameRulesScreen',
    'src/screens/NotepadScreen',
    'src/components/AIChatBubble',
    'src/components/BoardStrategy',
    'src/components/FactionChip.tsx',
    'src/components/FactionRoleList.tsx',
    'src/components/NotepadPanel.tsx',
    'src/components/RoleCardSimple.tsx',
    'src/components/RoleDescriptionView.tsx',
    'src/components/RoleRevealEffects',
    'src/components/SettingsSheet',
    'src/components/SkiaShaderWarmup.tsx',
    'src/components/roleDisplayUtils.ts',
    'src/services/cloudflare/CFStorageService.ts',
    'src/services/types/IRoomDirectoryService.ts',
    'src/services/types/IStorageService.ts',
    'src/types/GameStateTypes.ts',
    'src/utils/aiChatBridge.ts',
    'src/screens/HomeScreen/components/RandomRoleCard.tsx',
    'src/screens/AdminScreen/adminApi.ts',
  ];

  it.each(removedPaths)('%s must not exist', (relativePath) => {
    expect(fs.existsSync(path.join(process.cwd(), relativePath))).toBe(false);
  });

  it('does not restore a game-owned facade abstraction', () => {
    const offenders = getAllProductionFiles(gamesDir).flatMap((filePath) => {
      const relativePath = path.relative(process.cwd(), filePath);
      const identifiers = getIdentifierNames(filePath).filter((name) => /facade/i.test(name));
      const fileViolation = /facade/i.test(path.basename(filePath)) ? [relativePath] : [];
      return [...fileViolation, ...identifiers.map((name) => `${relativePath}:${name}`)];
    });

    expect(offenders).toEqual([]);
  });
});

describe('Client ownership: horizontal catch-all roots stay empty', () => {
  const removedCatchAllRoots = ['src/hooks', 'src/lib', 'src/services/feature'];

  it.each(removedCatchAllRoots)('%s must not own production modules', (relativePath) => {
    expect(getAllProductionFiles(path.join(process.cwd(), relativePath))).toEqual([]);
  });
});

describe('Client storage ownership', () => {
  it('creates MMKV only from the infrastructure storage primitive', () => {
    const consumers = srcFiles.filter((filePath) =>
      getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8')).includes(
        'react-native-mmkv',
      ),
    );

    expect(consumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/services/infra/localStorage.ts',
    ]);
  });

  it('keeps direct local-storage access inside service ownership', () => {
    const consumers = srcFiles.filter((filePath) =>
      getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8')).includes(
        '@/services/infra/localStorage',
      ),
    );
    const offenders = consumers.filter((filePath) => {
      const relativePath = path.relative(srcDir, filePath);
      return (
        !relativePath.startsWith(`services${path.sep}`) &&
        !relativePath.split(path.sep).includes('services')
      );
    });

    expect(offenders.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
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
          ? ['src/app/createAppServices.ts', 'src/features/room/services/RoomCreationService.ts']
          : ['src/app/createAppServices.ts'];

      expect(consumers.map((filePath) => path.relative(process.cwd(), filePath)).sort()).toEqual(
        expected,
      );
    }
  });

  it('keeps direct room-directory creation inside the application service', () => {
    const consumers = srcFiles.filter((filePath) =>
      /\broomDirectory\s*\.\s*createRoom\s*\(/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(consumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/features/room/services/RoomCreationService.ts',
    ]);
  });
});

describe('Client ownership: Home and root navigation stay game-neutral', () => {
  const sharedHomeFiles = getAllProductionFiles(path.join(srcDir, 'features', 'home'));
  const sharedNavigationFiles = getAllProductionFiles(path.join(srcDir, 'features', 'navigation'));
  const genericHostFiles = [
    ...getAllProductionFiles(homeScreenDir),
    ...sharedHomeFiles,
    ...sharedNavigationFiles,
    path.join(srcDir, 'games', 'home.ts'),
    path.join(srcDir, 'games', 'navigation.ts'),
    path.join(srcDir, 'games', 'model', 'ClientGameCatalog.ts'),
    path.join(srcDir, 'games', 'ClientGameCatalogContext.tsx'),
    path.join(srcDir, 'navigation', 'AppNavigator.tsx'),
    path.join(srcDir, 'navigation', 'GameHostRoutes.tsx'),
    path.join(srcDir, 'navigation', 'types.ts'),
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

  it('composes multiple concrete client games only in the exhaustive plugin catalog', () => {
    const multiGameConsumers = srcFiles.filter((filePath) => {
      const imports = getModuleSpecifiers(filePath, fs.readFileSync(filePath, 'utf-8'));
      const importedGames = GAME_TYPES.filter((gameType) =>
        imports.some((specifier) => specifier.split('/').includes(gameType)),
      );
      return importedGames.length > 1;
    });

    expect(multiGameConsumers.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/games/catalog.ts',
    ]);
  });

  it('keeps concrete config sub-routes out of the root stack', () => {
    const rootTypes = fs.readFileSync(path.join(srcDir, 'navigation', 'types.ts'), 'utf-8');
    const appNavigator = fs.readFileSync(
      path.join(srcDir, 'navigation', 'AppNavigator.tsx'),
      'utf-8',
    );
    const removedRootRoutes = ['BoardPicker', 'Config', 'GameRules', 'Encyclopedia', 'Notepad'];

    for (const routeName of removedRootRoutes) {
      expect(rootTypes).not.toMatch(new RegExp(`^\\s*${routeName}:`, 'm'));
      expect(appNavigator).not.toContain(`name="${routeName}"`);
    }
  });

  it('selects root game hosts from the catalog without a literal game type', () => {
    const gameHostRoutes = fs.readFileSync(
      path.join(srcDir, 'navigation', 'GameHostRoutes.tsx'),
      'utf-8',
    );
    for (const gameType of GAME_TYPES) {
      expect(gameHostRoutes).not.toMatch(new RegExp(`['"]${gameType}['"]`));
    }
    expect(gameHostRoutes).not.toMatch(/['"]nominate['"]/);
    expect(gameHostRoutes).not.toMatch(/useClientGameModule\s*\(\s*['"]/);
  });
});

describe('Test boundary: real navigation is opt-in', () => {
  it('does not load the full navigation module from the global Jest mock', () => {
    const jestSetup = fs.readFileSync(path.join(process.cwd(), 'jest.setup.ts'), 'utf-8');

    expect(jestSetup).not.toMatch(/jest\.requireActual[\s\S]{0,200}@react-navigation\/native/);
  });
});

describe('Client ownership: generic audio and avatar utilities stay game-neutral', () => {
  it('keeps Werewolf narration out of the platform AudioService', () => {
    const filePath = path.join(process.cwd(), 'src', 'services', 'infra', 'AudioService.ts');
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

  it('keeps role projection out of the product avatar registry', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'src', 'utils', 'avatar.ts'), 'utf-8');

    expect(content).not.toMatch(/\bRoleId\b|\bgetRoleAvatar\b/);
  });
});

describe('Client ownership: RoomSession has one implementation', () => {
  it('defines exactly one RoomSession class in production client code', () => {
    const implementations = srcFiles.filter((filePath) =>
      /\bclass\s+RoomSession\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(implementations.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/features/room/session/RoomSession.ts',
    ]);
  });

  it('is instantiated only by the production game-session factory', () => {
    const constructors = srcFiles.filter((filePath) =>
      /\bnew\s+RoomSession\s*</.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(constructors.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([
      'src/app/CloudflareGameSessionFactory.ts',
    ]);
  });
});

describe('Client interaction: disabled feedback is explicit', () => {
  it('does not restore disabled-press compatibility metadata', () => {
    const offenders = srcFiles.filter((filePath) =>
      /\bfireWhenDisabled\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(offenders.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });
});

describe('Production types: no escape-hatch assertions', () => {
  it('forbids any, never, and double assertions across all runtime packages', () => {
    const violations = [...srcFiles, ...gameEngineFiles, ...workerFiles].flatMap(
      getUnsafeTypeAssertions,
    );

    expect(violations).toEqual([]);
  });
});

describe('Client HTTP: every Cloudflare success response has an owner decoder', () => {
  it('forbids generic and identity-decoded cfFetch calls', () => {
    const violations = srcFiles.flatMap(getUnvalidatedCloudflareCalls);

    expect(violations).toEqual([]);
  });
});

describe('Client debug logs: one external store', () => {
  it('does not restore the mobileDebug facade', () => {
    const facadePath = path.join(srcDir, 'utils', 'mobileDebug.ts');
    const offenders = srcFiles.filter((filePath) =>
      /\bmobileDebug\b/.test(fs.readFileSync(filePath, 'utf-8')),
    );

    expect(fs.existsSync(facadePath)).toBe(false);
    expect(offenders.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });
});

describe('Client composition: one game-neutral catalog provider', () => {
  const compositionRootFiles = [
    path.join(process.cwd(), 'App.tsx'),
    path.join(srcDir, 'app'),
  ].flatMap((entry) => (fs.statSync(entry).isDirectory() ? getAllProductionFiles(entry) : [entry]));

  it.each(compositionRootFiles)('%s must not import a concrete game module', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getModuleSpecifiers(filePath, content).filter(
      (specifier) =>
        specifier.startsWith('@/games/') &&
        specifier !== '@/games/catalog' &&
        specifier !== '@/games/ClientGameCatalogContext' &&
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

    expect(offenders.map((filePath) => path.relative(process.cwd(), filePath))).toEqual([]);
  });
});

// ─── Rule 3: screens/ must call feature APIs instead of infrastructure ───────

describe('Layer boundary: screens → services runtime imports (forbidden)', () => {
  it('should find screens files to check', () => {
    expect(screensFiles.length).toBeGreaterThan(0);
  });

  it.each(screensFiles)('%s must not runtime import services/', (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = getRuntimeModuleSpecifiers(filePath, content).filter((specifier) =>
      specifier.startsWith('@/services/'),
    );

    expect(violations).toEqual([]);
  });
});
