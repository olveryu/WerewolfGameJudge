import fs from 'node:fs';
import path from 'node:path';

const platformDirectory = path.resolve(__dirname, '..');

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

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]!);
  }
  for (const match of source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]!);
  }
  return specifiers;
}

describe('game-engine platform dependency boundary', () => {
  const platformFiles = collectProductionFiles(platformDirectory);

  it('contains production modules', () => {
    expect(platformFiles.length).toBeGreaterThan(0);
  });

  it.each(platformFiles)('%s imports only other platform modules', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const violations = importSpecifiers(source).filter((specifier) => {
      if (!specifier.startsWith('.')) return true;
      const resolvedPath = path.resolve(path.dirname(filePath), specifier);
      return !resolvedPath.startsWith(`${platformDirectory}${path.sep}`);
    });

    expect(violations).toEqual([]);
  });
});
