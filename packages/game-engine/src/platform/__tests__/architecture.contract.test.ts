import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { GAME_TYPES } from '../protocol/gameTypes';
import { getModuleSpecifiers } from './moduleSpecifiers';

const platformDirectory = path.resolve(__dirname, '..');
const gamesDirectory = path.resolve(__dirname, '..', '..', 'games');
const productDirectory = path.resolve(__dirname, '..', '..', 'product');
const sourceDirectory = path.resolve(__dirname, '..', '..');
const packageDirectory = path.resolve(sourceDirectory, '..');
const werewolfHandlersDirectory = path.join(gamesDirectory, 'werewolf', 'domain', 'handlers');

const REMOVED_ROOT_DIRECTORIES = [
  'engine',
  'growth',
  'models',
  'protocol',
  'resolvers',
  'utils',
] as const;
const REMOVED_PACKAGE_EXPORT_PREFIXES = [
  './engine',
  './growth',
  './models',
  './protocol',
  './resolvers',
  './utils',
] as const;
const GAME_EXPORT_PATTERN = /^\.\/games\/([^/]+)(?:\/(.+))?$/;
const ALLOWED_GAME_MODULE_ENTRYPOINTS = new Set(['public']);
const EXPECTED_PACKAGE_EXPORTS = [
  './games/catalog',
  './games/fibking/public',
  './games/werewolf/public',
  './platform/engine',
  './platform/identifiers',
  './platform/protocol/actionResult',
  './platform/protocol/canonicalJson',
  './platform/protocol/commandResult',
  './platform/protocol/commands',
  './platform/protocol/gameTypes',
  './platform/protocol/reasons',
  './platform/protocol/roomCode',
  './platform/protocol/roomLocator',
  './platform/protocol/roomSnapshot',
  './platform/protocol/userEvents',
  './platform/random',
  './platform/room/formatSeat',
  './platform/room/roster',
  './product/growth',
  './product/rewards',
] as const;
const FORBIDDEN_HANDLER_CONTRACT_IDENTIFIERS = new Set([
  'SideEffect',
  'STANDARD_SIDE_EFFECTS',
  'sideEffects',
]);
const FORBIDDEN_HANDLER_EFFECT_TYPES = new Set([
  'BROADCAST_STATE',
  'PLAY_AUDIO',
  'SAVE_STATE',
  'SEND_MESSAGE',
]);

interface PackageExportEntry {
  readonly exportPath: string;
  readonly typesPath: string;
  readonly defaultPath: string;
}

function isPathWithin(directory: string, candidate: string): boolean {
  return candidate === directory || candidate.startsWith(`${directory}${path.sep}`);
}

function collectProductionFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectProductionFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getOrdinaryTypeAssertions(filePath: string, source?: string): readonly string[] {
  const content = source ?? fs.readFileSync(filePath, 'utf8');
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

function getHandlerContractViolations(filePath: string, source?: string): readonly string[] {
  const content = source ?? fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  function addViolation(node: ts.Node): void {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    violations.push(
      `${path.relative(process.cwd(), filePath)}:${line}:${node.getText(sourceFile)}`,
    );
  }

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && FORBIDDEN_HANDLER_CONTRACT_IDENTIFIERS.has(node.text)) {
      addViolation(node);
    } else if (ts.isStringLiteral(node) && FORBIDDEN_HANDLER_EFFECT_TYPES.has(node.text)) {
      addViolation(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function findBoundaryViolations(
  filePath: string,
  source: string,
  allowedDirectories: readonly string[],
  allowedFiles: readonly string[] = [],
): readonly string[] {
  return getModuleSpecifiers(filePath, source).filter((specifier) => {
    if (!specifier.startsWith('.')) return true;
    const resolvedPath = path.resolve(path.dirname(filePath), specifier);
    return (
      !allowedDirectories.some((directory) => isPathWithin(directory, resolvedPath)) &&
      !allowedFiles.includes(resolvedPath)
    );
  });
}

function readPackageExports(): readonly PackageExportEntry[] {
  const packageJson: unknown = JSON.parse(
    fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
  );
  if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
    throw new Error('game-engine package.json must contain an object');
  }
  if (!('exports' in packageJson)) {
    throw new Error('game-engine package.json must define exports');
  }
  const packageExports = packageJson.exports;
  if (
    typeof packageExports !== 'object' ||
    packageExports === null ||
    Array.isArray(packageExports)
  ) {
    throw new Error('game-engine package.json exports must contain an object');
  }

  return Object.keys(packageExports).map((exportPath) => {
    const mapping: unknown = Reflect.get(packageExports, exportPath);
    if (typeof mapping !== 'object' || mapping === null || Array.isArray(mapping)) {
      throw new Error(`game-engine export ${exportPath} must contain an object`);
    }
    const typesPath: unknown = Reflect.get(mapping, 'types');
    const defaultPath: unknown = Reflect.get(mapping, 'default');
    if (typeof typesPath !== 'string' || typeof defaultPath !== 'string') {
      throw new Error(`game-engine export ${exportPath} must define types and default paths`);
    }
    return { exportPath, typesPath, defaultPath };
  });
}

describe('game-engine platform dependency boundary', () => {
  const platformFiles = collectProductionFiles(platformDirectory);

  it('contains production modules', () => {
    expect(platformFiles.length).toBeGreaterThan(0);
  });

  it.each(platformFiles)('%s imports only other platform modules', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const violations = findBoundaryViolations(filePath, source, [platformDirectory]);

    expect(violations).toEqual([]);
  });
});

describe('game-engine product dependency boundary', () => {
  const productFiles = collectProductionFiles(productDirectory);

  it('contains production modules', () => {
    expect(productFiles.length).toBeGreaterThan(0);
  });

  it.each(productFiles)('%s imports only product or platform modules', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const violations = findBoundaryViolations(filePath, source, [
      productDirectory,
      platformDirectory,
    ]);

    expect(violations).toEqual([]);
  });
});

describe('game-engine game module dependency boundary', () => {
  const gameDirectoryNames = fs
    .readdirSync(gamesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const gameDirectories = gameDirectoryNames.map((name) => path.join(gamesDirectory, name));

  it('contains exactly the registered game module directories', () => {
    expect(gameDirectoryNames).toEqual([...GAME_TYPES].sort());
  });

  for (const gameDirectory of gameDirectories) {
    const gameName = path.basename(gameDirectory);
    const productionFiles = collectProductionFiles(gameDirectory);

    it(`${gameName}: contains production modules`, () => {
      expect(productionFiles.length).toBeGreaterThan(0);
    });

    it.each(productionFiles)(
      `${gameName}: %s imports only its game, product, or platform`,
      (filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        const violations = findBoundaryViolations(filePath, source, [
          gameDirectory,
          productDirectory,
          platformDirectory,
        ]);

        expect(violations).toEqual([]);
      },
    );
  }
});

describe('game-engine dependency boundary fixtures', () => {
  it.each([
    {
      filePath: path.join(platformDirectory, 'fixture.ts'),
      source: "import '../product/growth';",
      allowedDirectories: [platformDirectory],
      expected: '../product/growth',
    },
    {
      filePath: path.join(productDirectory, 'fixture.ts'),
      source: "import '../games/werewolf/public';",
      allowedDirectories: [productDirectory, platformDirectory],
      expected: '../games/werewolf/public',
    },
    {
      filePath: path.join(gamesDirectory, 'werewolf', 'fixture.ts'),
      source: "import '../fibking/public';",
      allowedDirectories: [
        path.join(gamesDirectory, 'werewolf'),
        productDirectory,
        platformDirectory,
      ],
      expected: '../fibking/public',
    },
  ])('rejects $expected', ({ filePath, source, allowedDirectories, expected }) => {
    expect(findBoundaryViolations(filePath, source, allowedDirectories)).toEqual([expected]);
  });
});

describe('game-engine production type honesty', () => {
  const productionFiles = collectProductionFiles(sourceDirectory);

  it('forbids ordinary type assertions while allowing const assertions', () => {
    const violations = productionFiles.flatMap((filePath) => getOrdinaryTypeAssertions(filePath));

    expect(violations).toEqual([]);
  });

  it('rejects ordinary and angle-bracket assertion fixtures', () => {
    const fixturePath = path.join(sourceDirectory, 'typeAssertion.fixture.ts');

    expect(getOrdinaryTypeAssertions(fixturePath, 'value as RoleId;')).toEqual([
      'src/typeAssertion.fixture.ts:1',
    ]);
    expect(getOrdinaryTypeAssertions(fixturePath, '<RoleId>value;')).toEqual([
      'src/typeAssertion.fixture.ts:1',
    ]);
    expect(getOrdinaryTypeAssertions(fixturePath, 'value as const;')).toEqual([]);
  });
});

describe('Werewolf handler event boundary', () => {
  const handlerFiles = collectProductionFiles(werewolfHandlersDirectory);

  it('contains production handlers', () => {
    expect(handlerFiles.length).toBeGreaterThan(0);
  });

  it('does not describe platform persistence, broadcast, messaging, or audio IO effects', () => {
    const violations = handlerFiles.flatMap((filePath) => getHandlerContractViolations(filePath));

    expect(violations).toEqual([]);
  });

  it('rejects identifier and effect-type fixtures', () => {
    const fixturePath = path.join(werewolfHandlersDirectory, 'contract.fixture.ts');
    const source = [
      "type SideEffect = { type: 'BROADCAST_STATE' };",
      'const sideEffects: SideEffect[] = [];',
    ].join('\n');

    expect(getHandlerContractViolations(fixturePath, source)).toEqual([
      expect.stringContaining(':1:SideEffect'),
      expect.stringContaining(":1:'BROADCAST_STATE'"),
      expect.stringContaining(':2:sideEffects'),
      expect.stringContaining(':2:SideEffect'),
    ]);
  });
});

describe('game-engine ownership layout', () => {
  it('has no aggregate package-root entrypoint', () => {
    expect(fs.existsSync(path.join(sourceDirectory, 'index.ts'))).toBe(false);

    const packageJson: unknown = JSON.parse(
      fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
    );
    if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
      throw new Error('game-engine package.json must contain an object');
    }

    expect(Reflect.has(packageJson, 'main')).toBe(false);
    expect(Reflect.has(packageJson, 'types')).toBe(false);
  });

  it.each(REMOVED_ROOT_DIRECTORIES)('does not restore src/%s', (directoryName) => {
    expect(fs.existsSync(path.join(sourceDirectory, directoryName))).toBe(false);
  });

  it('does not expose removed generic game subpaths', () => {
    const removedExports = readPackageExports()
      .map(({ exportPath }) => exportPath)
      .filter((exportPath) =>
        REMOVED_PACKAGE_EXPORT_PREFIXES.some(
          (prefix) => exportPath === prefix || exportPath.startsWith(`${prefix}/`),
        ),
      );

    expect(removedExports).toEqual([]);
  });

  it('exposes each game module only through public or testing entrypoints', () => {
    const invalidGameExports = readPackageExports()
      .map(({ exportPath }) => exportPath)
      .filter((exportPath) => {
        if (exportPath === './games/catalog') return false;
        const match = GAME_EXPORT_PATTERN.exec(exportPath);
        if (match === null) return false;
        if (match[1] === 'catalog') return true;
        const entrypoint = match[2];
        return entrypoint === undefined || !ALLOWED_GAME_MODULE_ENTRYPOINTS.has(entrypoint);
      });

    expect(invalidGameExports).toEqual([]);
  });

  it('uses exact package exports backed by source files', () => {
    const packageExports = readPackageExports();

    expect(packageExports.map(({ exportPath }) => exportPath).sort()).toEqual(
      [...EXPECTED_PACKAGE_EXPORTS].sort(),
    );

    for (const entry of packageExports) {
      expect(entry.exportPath).not.toContain('*');
      expect(fs.existsSync(path.resolve(packageDirectory, entry.typesPath))).toBe(true);
      expect(entry.defaultPath).toBe(
        entry.typesPath.replace('./src/', './dist/').replace(/\.tsx?$/, '.js'),
      );
    }
  });
});
