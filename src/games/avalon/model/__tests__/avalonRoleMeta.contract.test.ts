/**
 * 阿瓦隆角色介绍完备性 contract + 单一数据源源码钉。
 *
 * avalonRoleMeta 是阿瓦隆角色介绍的唯一数据源：角色卡与图鉴/说明页
 * 都只许消费它。本测试钉两件事：
 * 1. 每个引擎角色都有完整介绍（至少一个非空字段、胜利条件必填、
 *    展示名/阵营名非空），未知 roleId fail-fast；
 * 2. 阿瓦隆全部生产源码（meta 本体与测试文件除外）不许出现介绍文案
 *    字面量（出现 = 第二份文案源），且旧手写说明屏 AvalonRulesScreen
 *    不许回来。
 */
import { AVALON_ROLES, type AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { type AvalonRoleDescription, getAvalonRoleMeta } from '../avalonRoleMeta';

const SRC_ROOT = join(__dirname, '..', '..', '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf8');
}

/** 递归列出阿瓦隆生产源码（.ts/.tsx，排除 __tests__ 目录与 *.test.* 文件）。 */
function listAvalonProductionSources(): string[] {
  const base = join(SRC_ROOT, 'games', 'avalon');
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(join(dir, entry.name));
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.includes('.test.')
      ) {
        results.push(join(dir, entry.name));
      }
    }
  };
  walk(base);
  return results.sort();
}

const DESCRIPTION_KEYS: readonly (keyof AvalonRoleDescription)[] = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
];

describe('avalon role meta completeness', () => {
  it('covers exactly the engine role set with complete introductions', () => {
    expect(AVALON_ROLES).toHaveLength(8);
    for (const roleId of AVALON_ROLES) {
      const meta = getAvalonRoleMeta(roleId);
      expect(meta.roleId).toBe(roleId);
      expect(meta.displayName.length).toBeGreaterThan(0);
      expect(meta.factionName.length).toBeGreaterThan(0);
      const nonEmptyFields = DESCRIPTION_KEYS.filter((key) => {
        const value = meta.description[key];
        return value !== undefined && value.length > 0;
      });
      expect(nonEmptyFields.length).toBeGreaterThan(0);
      expect(meta.description.winCondition).toBeDefined();
      expect(meta.description.winCondition?.length).toBeGreaterThan(0);
    }
  });

  it('fails fast on an unknown role id', () => {
    const unknown = 'not-a-role' as AvalonRoleId;
    expect(() => getAvalonRoleMeta(unknown)).toThrow('Unknown Avalon role ID');
  });
});

describe('avalon role introduction single source (source pins)', () => {
  it('the hand-written rules screen is gone', () => {
    expect(existsSync(join(SRC_ROOT, 'games/avalon/screens/AvalonRulesScreen.tsx'))).toBe(false);
  });

  it('guide binding consumes the shared encyclopedia with the meta-backed data source', () => {
    const guideScreen = readSource('games/avalon/screens/AvalonGuideScreen.tsx');
    expect(guideScreen).toMatch(/EncyclopediaShell/);
    expect(guideScreen).toMatch(/AVALON_ENCYCLOPEDIA_SOURCE/);
    const dataSource = readSource('games/avalon/screens/avalonEncyclopediaSource.ts');
    expect(dataSource).toMatch(/getAvalonRoleMeta/);
    expect(dataSource).toMatch(/toAvalonRoleDescriptionFields/);
    const sheetSource = readSource('features/encyclopedia/EncyclopediaRoleDetailSheet.tsx');
    expect(sheetSource).toMatch(/StructuredDescriptionView/);
  });

  it('no avalon production source outside the meta contains role introduction literals', () => {
    const literals: string[] = [];
    for (const roleId of AVALON_ROLES) {
      const { description } = getAvalonRoleMeta(roleId);
      for (const key of DESCRIPTION_KEYS) {
        const value = description[key];
        if (value !== undefined) literals.push(value);
      }
    }
    // 旧说明屏手写版的特有措辞（与 meta 不一致的那份）。
    literals.push('被刺客指认出来，好人就输了，所以要藏好身份');
    const metaPath = join(SRC_ROOT, 'games', 'avalon', 'model', 'avalonRoleMeta.ts');
    const violations: string[] = [];
    for (const filePath of listAvalonProductionSources()) {
      if (filePath === metaPath) continue;
      const source = readFileSync(filePath, 'utf8');
      for (const literal of literals) {
        if (source.includes(literal)) {
          violations.push(`${filePath.slice(SRC_ROOT.length + 1)}: ${literal}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
