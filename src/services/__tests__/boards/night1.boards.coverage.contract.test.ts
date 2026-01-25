/**
 * Night-1 Boards Coverage Contract Test
 *
 * 门禁测试：强制 10 个 12 人板子全部有 integration test 覆盖
 *
 * A. 强制 10 个板子全部有测试文件
 * B. 防止"空壳 / 只测 deaths"的测试
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { NIGHT_STEPS } from '../../../models/roles/spec/nightSteps';

// =============================================================================
// 权威列表：10 个 12 人板子（来自 PRESET_TEMPLATES）
// =============================================================================

const REQUIRED_12P_TEMPLATES = [
  '标准板12人',
  '狼美守卫12人',
  '狼王守卫12人',
  '石像鬼守墓人12人',
  '梦魇守卫12人',
  '血月猎魔12人',
  '狼王摄梦人12人',
  '狼王魔术师12人',
  '机械狼通灵师12人',
  '恶灵骑士12人',
] as const;

// =============================================================================
// 板子名 → 测试文件关键字映射
// =============================================================================

/**
 * 每个板子对应的测试文件必须包含这些关键字之一
 * 用于匹配 TEMPLATE_NAME = '...' 语句
 */
const TEMPLATE_TO_TEST_PATTERN: Record<string, RegExp> = {
  标准板12人: /TEMPLATE_NAME\s*=\s*['"]标准板12人['"]/,
  狼美守卫12人: /TEMPLATE_NAME\s*=\s*['"]狼美守卫12人['"]/,
  狼王守卫12人: /TEMPLATE_NAME\s*=\s*['"]狼王守卫12人['"]/,
  石像鬼守墓人12人: /TEMPLATE_NAME\s*=\s*['"]石像鬼守墓人12人['"]/,
  梦魇守卫12人: /TEMPLATE_NAME\s*=\s*['"]梦魇守卫12人['"]/,
  血月猎魔12人: /TEMPLATE_NAME\s*=\s*['"]血月猎魔12人['"]/,
  狼王摄梦人12人: /TEMPLATE_NAME\s*=\s*['"]狼王摄梦人12人['"]/,
  狼王魔术师12人: /TEMPLATE_NAME\s*=\s*['"]狼王魔术师12人['"]/,
  机械狼通灵师12人: /TEMPLATE_NAME\s*=\s*['"]机械狼通灵师12人['"]/,
  恶灵骑士12人: /TEMPLATE_NAME\s*=\s*['"]恶灵骑士12人['"]/,
};

// =============================================================================
// 主题字段断言关键字（至少包含其中一个）
// =============================================================================

const REQUIRED_ASSERTION_PATTERNS = [
  /\.currentNightResults\??\./,
  /\.seerReveal/,
  /\.psychicReveal/,
  /\.gargoyleReveal/,
  /\.wolfRobotReveal/,
  /\.actions\??\./,
  /\.actions\?\.\w+/,
];

// =============================================================================
// 测试目录路径
// =============================================================================

const BOARDS_TEST_DIR = path.join(__dirname, '.');

// =============================================================================
// 辅助函数
// =============================================================================

function getIntegrationTestFiles(): string[] {
  const files = fs.readdirSync(BOARDS_TEST_DIR);
  return files.filter(
    (f) => f.startsWith('night1.') && f.endsWith('.12p.integration.test.ts'),
  );
}

function readTestFileContent(filename: string): string {
  const filepath = path.join(BOARDS_TEST_DIR, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileMentionsStepId(content: string, stepId: string): boolean {
  // We accept a few common usages:
  // - ctx.assertStep('wolfKill')
  // - currentStepId === 'seerCheck'
  // - executeStepsUntil(ctx, 'witchAction', ...)
  // - schemaId === 'dreamcatcherDream'
  const s = escapeRegExp(stepId);
  const patterns: RegExp[] = [
    new RegExp(String.raw`\.assertStep\(\s*['"]${s}['"]\s*\)`),
    new RegExp(String.raw`currentStepId\s*(?:===|!==|"toBe"|"not\.toBe")\s*['"]${s}['"]`),
    new RegExp(String.raw`executeStepsUntil\(\s*\w+\s*,\s*['"]${s}['"]`),
    new RegExp(String.raw`schemaId\s*===\s*['"]${s}['"]`),
    new RegExp(String.raw`stepId\s*===\s*['"]${s}['"]`),
    new RegExp(String.raw`findActionMessage\([^)]*['"]${s}['"]`),
  ];

  return patterns.some((p) => p.test(content));
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('Night-1 Boards Coverage Contract', () => {
  const testFiles = getIntegrationTestFiles();

  describe('A. 强制 10 个板子全部有测试文件', () => {
    it('应该发现至少 10 个 night1.*.12p.integration.test.ts 文件', () => {
      expect(testFiles.length).toBeGreaterThanOrEqual(10);
    });

    it.each(REQUIRED_12P_TEMPLATES)(
      '板子 "%s" 必须有对应的 integration test 文件',
      (templateName) => {
        const pattern = TEMPLATE_TO_TEST_PATTERN[templateName];
        expect(pattern).toBeDefined();

        // 查找至少一个测试文件包含该模板名
        const hasTestFile = testFiles.some((filename) => {
          const content = readTestFileContent(filename);
          return pattern.test(content);
        });

        expect(hasTestFile).toBe(true);
      },
    );
  });

  describe('B. 防止"空壳 / 只测 deaths"', () => {
    it.each(testFiles)(
      '文件 "%s" 必须包含至少一个主题字段断言（非纯 deaths 测试）',
      (filename) => {
        const content = readTestFileContent(filename);

        // 检查是否包含至少一个主题字段断言
        const hasThemeAssertion = REQUIRED_ASSERTION_PATTERNS.some((pattern) =>
          pattern.test(content),
        );

        expect(hasThemeAssertion).toBe(true);
      },
    );
  });

  describe('C. Step-level coverage: NIGHT_STEPS 每个 stepId 必须在 boards tests 中出现', () => {
    const stepIds = NIGHT_STEPS.map((s) => s.id);

    it('NIGHT_STEPS 中的 stepId 必须非空且唯一', () => {
      expect(stepIds.length).toBeGreaterThan(0);
      expect(new Set(stepIds).size).toBe(stepIds.length);
      expect(stepIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    });

    it.each(stepIds)('stepId "%s" 必须至少被一个 boards test 提及（显式断言或推进到该 step）', (stepId) => {
      // Search all boards tests (including non-12p helpers/contract tests)
      const allBoardTests = fs
        .readdirSync(BOARDS_TEST_DIR)
        .filter((f) => f.endsWith('.test.ts'));

      const mentionedInSomeFile = allBoardTests.some((filename) => {
        const content = readTestFileContent(filename);
        return fileMentionsStepId(content, stepId);
      });

      expect(mentionedInSomeFile).toBe(true);
    });
  });
});
