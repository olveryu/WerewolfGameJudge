/**
 * Contract Test: 禁止在业务/服务/Screen 代码中使用 Math.random()
 *
 * 规则（详见 docs/random-and-id-guidelines.md）：
 * 1. ID/nonce 生成 → 用 src/utils/id.ts (randomHex, newRequestId, newRejectionId)
 * 2. 可测试随机 → 用 src/utils/random.ts (secureRng + Rng 注入)
 * 3. 跨客户端一致随机 → Host 解析 + BroadcastGameState 广播
 *
 * 例外（允许 Math.random）：
 * - __tests__/ 测试文件
 * - *.test.ts / *.test.tsx
 * - *.stories.tsx Storybook 文件
 * - RoleRevealEffects/ 内的视觉装饰（粒子、位移等）
 * - 注释/文档字符串中的示例
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';

// 允许使用 Math.random() 的文件模式
const ALLOWED_PATTERNS = [
  // 测试文件
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  // Storybook
  '**/*.stories.tsx',
  // 视觉装饰（纯 UI 动画效果，不影响游戏逻辑）
  '**/RoleRevealEffects/Particle.tsx',
  '**/RoleRevealEffects/EnhancedRoulette.tsx',
  '**/RoleRevealEffects/ScratchReveal.tsx',
  '**/RoleRevealEffects/TarotDraw.tsx',
  '**/RoleRevealEffects/FireReveal.tsx',
  // AI 建议（非游戏逻辑）
  '**/AIChatBubble.tsx',
];

// 需要检查的目录
const SCAN_DIRS = ['src/screens', 'src/services', 'src/hooks', 'src/contexts'];

describe('Math.random() 禁止规则', () => {
  it('业务代码中不应直接使用 Math.random()', async () => {
    const srcRoot = path.resolve(__dirname, '..');
    const violations: Array<{ file: string; line: number; content: string }> = [];

    for (const dir of SCAN_DIRS) {
      const dirPath = path.join(srcRoot, dir.replace('src/', ''));
      if (!fs.existsSync(dirPath)) continue;

      // 查找所有 .ts/.tsx 文件
      const files = await glob('**/*.{ts,tsx}', {
        cwd: dirPath,
        absolute: true,
        ignore: ALLOWED_PATTERNS,
      });

      for (const file of files) {
        const relativePath = path.relative(srcRoot, file);

        // 检查是否在允许列表中
        const isAllowed = ALLOWED_PATTERNS.some((pattern) => {
          // 简单的通配符匹配
          if (pattern.includes('**')) {
            const regex = new RegExp(
              pattern
                .replaceAll('**', '.*')
                .replaceAll('*', '[^/]*')
                .replaceAll('.', String.raw`\.`)
            );
            return regex.test(relativePath) || regex.test(file);
          }
          return relativePath.includes(pattern) || file.includes(pattern);
        });

        if (isAllowed) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // 跳过注释行
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
          }

          // 检测 Math.random()
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
      const report = violations
        .map((v) => `  ${v.file}:${v.line}\n    ${v.content}`)
        .join('\n\n');

      fail(
        `发现 ${violations.length} 处禁止使用 Math.random() 的代码:\n\n${report}\n\n` +
          `修复方案:\n` +
          `- ID/nonce 生成 → import { randomHex } from '@/utils/id'\n` +
          `- 可测试随机 → import { secureRng, randomIntInclusive } from '@/utils/random'\n` +
          `- 跨客户端一致 → Host 解析并通过 BroadcastGameState 广播\n` +
          `- 详见 docs/random-and-id-guidelines.md`
      );
    }
  });

  it('shuffle 函数应使用 Rng 注入而非 Math.random()', async () => {
    const shufflePath = path.resolve(__dirname, '../utils/shuffle.ts');
    if (!fs.existsSync(shufflePath)) {
      // shuffle.ts 不存在则跳过
      return;
    }

    const content = fs.readFileSync(shufflePath, 'utf-8');

    // 确保没有直接调用 Math.random()
    const hasMathRandom = content.includes('Math.random()');
    expect(hasMathRandom).toBe(false);

    // 确保使用了 Rng 类型
    const hasRngType = content.includes('Rng') || content.includes('rng');
    expect(hasRngType).toBe(true);
  });
});
