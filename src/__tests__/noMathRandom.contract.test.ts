/**
 * Contract Test: forbid Math.random() in business/service/Screen code
 *
 * Rules (see docs/random-and-id-guidelines.md):
 * 1. ID/nonce generation -> use src/utils/id.ts (randomHex, newRequestId, newRejectionId)
 * 2. Testable randomness -> use src/utils/random.ts (secureRng + Rng injection)
 * 3. Cross-client consistent randomness -> server-resolved + WerewolfState broadcast
 *
 * Exceptions (Math.random allowed):
 * - __tests__/ test files
 * - *.test.ts / *.test.tsx
 * - *.stories.tsx Storybook files
 * - Visual decoration in RoleRevealEffects/ (particles, displacement, etc.)
 * - Examples in comments/doc strings
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { glob } from 'glob';

// File patterns where Math.random() is allowed
const ALLOWED_PATTERNS = [
  // Test files
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  // Storybook
  '**/*.stories.tsx',
  // Visual decoration (pure UI animation, no impact on game logic)
  '**/RoleRevealEffects/**',
  '**/GachaScreen/**',
];

// Directories to scan
const SCAN_DIRS = ['src/screens', 'src/services', 'src/hooks', 'src/contexts', 'src/components'];

describe('Math.random() 禁止规则', () => {
  it('业务代码中不应直接使用 Math.random()', async () => {
    const srcRoot = path.resolve(__dirname, '..');
    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const dir of SCAN_DIRS) {
      const dirPath = path.join(srcRoot, dir.replace('src/', ''));
      if (!fs.existsSync(dirPath)) continue;

      // Find all .ts/.tsx files
      const files = await glob('**/*.{ts,tsx}', {
        cwd: dirPath,
        absolute: true,
        ignore: ALLOWED_PATTERNS,
      });

      for (const file of files) {
        const relativePath = path.relative(srcRoot, file);

        // Check whether file is in the allowed list
        const isAllowed = ALLOWED_PATTERNS.some((pattern) => {
          // Simple glob matching
          if (pattern.includes('**')) {
            const regex = new RegExp(
              pattern
                .replaceAll('**', '.*')
                .replaceAll('*', '[^/]*')
                .replaceAll('.', String.raw`\.`),
            );
            return regex.test(relativePath) || regex.test(file);
          }
          return relativePath.includes(pattern) || file.includes(pattern);
        });

        if (isAllowed) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Skip comment lines
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
          }

          // Detect Math.random()
          if (line.includes('Math.random()')) {
            violations.push({
              file: relativePath,
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      }
    }

    if (violations.length > 0) {
      const report = violations.map((v) => `  ${v.file}:${v.line}\n    ${v.content}`).join('\n\n');

      throw new Error(
        `发现 ${violations.length} 处禁止使用 Math.random() 的代码:\n\n${report}\n\n` +
          `修复方案:\n` +
          `- ID/nonce 生成 → import { randomHex } from '@werewolf/game-engine/utils/id'\n` +
          `- 可测试随机 → import { secureRng, randomIntInclusive, randomPick } from '@werewolf/game-engine/utils/random'\n` +
          `- 数组打乱 → import { shuffleArray } from '@werewolf/game-engine/utils/shuffle'\n` +
          `- 跨客户端一致 → 服务端解析并通过 WerewolfState 广播\n` +
          `- 详见 docs/random-and-id-guidelines.md`,
      );
    }
  });

  it('shuffle 函数应使用 Rng 注入而非 Math.random()', async () => {
    const shufflePath = path.resolve(__dirname, '../utils/shuffle.ts');
    if (!fs.existsSync(shufflePath)) {
      // Skip if shuffle.ts does not exist
      return;
    }

    const content = fs.readFileSync(shufflePath, 'utf-8');

    // Ensure no direct Math.random() call
    const hasMathRandom = content.includes('Math.random()');
    expect(hasMathRandom).toBe(false);

    // Ensure Rng type is used
    const hasRngType = content.includes('Rng') || content.includes('rng');
    expect(hasRngType).toBe(true);
  });
});
