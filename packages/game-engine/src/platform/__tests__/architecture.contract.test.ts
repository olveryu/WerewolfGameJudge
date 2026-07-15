import fs from 'node:fs';
import path from 'node:path';

import { getModuleSpecifiers } from './moduleSpecifiers';

const platformDirectory = path.resolve(__dirname, '..');
const gamesDirectory = path.resolve(__dirname, '..', '..', 'games');
const sourceDirectory = path.resolve(__dirname, '..', '..');
const packageDirectory = path.resolve(sourceDirectory, '..');

const REMOVED_GENERIC_GAME_DIRECTORIES = ['engine', 'models', 'protocol', 'resolvers'] as const;
const REMOVED_PACKAGE_EXPORT_PREFIXES = [
  './engine',
  './models',
  './protocol',
  './resolvers',
] as const;
const GAME_EXPORT_PATTERN = /^\.\/games\/([^/]+)(?:\/(.+))?$/;
const ALLOWED_GAME_MODULE_ENTRYPOINTS = new Set(['public', 'testing']);

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

describe('game-engine platform dependency boundary', () => {
  const platformFiles = collectProductionFiles(platformDirectory);

  it('contains production modules', () => {
    expect(platformFiles.length).toBeGreaterThan(0);
  });

  it.each(platformFiles)('%s imports only other platform modules', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const violations = getModuleSpecifiers(filePath, source).filter((specifier) => {
      if (!specifier.startsWith('.')) return true;
      const resolvedPath = path.resolve(path.dirname(filePath), specifier);
      return !resolvedPath.startsWith(`${platformDirectory}${path.sep}`);
    });

    expect(violations).toEqual([]);
  });
});

describe('game-engine game module dependency boundary', () => {
  const gameDirectories = fs
    .readdirSync(gamesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(gamesDirectory, entry.name));

  it('contains registered game module directories', () => {
    expect(gameDirectories.length).toBeGreaterThan(0);
  });

  for (const gameDirectory of gameDirectories) {
    const gameName = path.basename(gameDirectory);
    const productionFiles = collectProductionFiles(gameDirectory);

    it.each(productionFiles)(`${gameName}: %s does not import another game module`, (filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const violations = getModuleSpecifiers(filePath, source).filter((specifier) => {
        if (specifier.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), specifier);
          return (
            isPathWithin(gamesDirectory, resolvedPath) && !isPathWithin(gameDirectory, resolvedPath)
          );
        }

        const gamePathMatch = specifier.match(/\/games\/([^/]+)(?:\/|$)/);
        return gamePathMatch !== null && gamePathMatch[1] !== gameName;
      });

      expect(violations).toEqual([]);
    });
  }
});

describe('game-engine ownership layout', () => {
  it.each(REMOVED_GENERIC_GAME_DIRECTORIES)('does not restore src/%s', (directoryName) => {
    expect(fs.existsSync(path.join(sourceDirectory, directoryName))).toBe(false);
  });

  it('does not expose removed generic game subpaths', () => {
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

    const removedExports = Object.keys(packageExports).filter((exportPath) =>
      REMOVED_PACKAGE_EXPORT_PREFIXES.some(
        (prefix) => exportPath === prefix || exportPath.startsWith(`${prefix}/`),
      ),
    );

    expect(removedExports).toEqual([]);
  });

  it('exposes each game module only through public or testing entrypoints', () => {
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

    const invalidGameExports = Object.keys(packageExports).filter((exportPath) => {
      if (exportPath === './games/catalog') return false;
      const match = GAME_EXPORT_PATTERN.exec(exportPath);
      if (match === null) return false;
      if (match[1] === 'catalog') return true;
      const entrypoint = match[2];
      return entrypoint === undefined || !ALLOWED_GAME_MODULE_ENTRYPOINTS.has(entrypoint);
    });

    expect(invalidGameExports).toEqual([]);
  });
});
