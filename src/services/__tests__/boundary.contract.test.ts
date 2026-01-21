/**
 * Boundary Contract Tests - 边界契约测试
 *
 * 验证模块间导入规则，防止架构漂移。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SERVICES_DIR = path.join(__dirname, '..');

// 正则模式
const RUNTIME_IMPORT = /^import\s+(?!type\s)/; // "import X" 但不是 "import type X"
const TYPE_ONLY_IMPORT = /^import\s+type\s/;

function getImports(filePath: string): { runtime: string[]; typeOnly: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const runtime: string[] = [];
  const typeOnly: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (TYPE_ONLY_IMPORT.test(trimmed)) {
      typeOnly.push(trimmed);
    } else if (RUNTIME_IMPORT.test(trimmed)) {
      runtime.push(trimmed);
    }
  }
  return { runtime, typeOnly };
}

// 辅助函数：递归获取所有 .ts 文件（排除 .test.ts）
function getAllTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('模块边界契约（Module Boundary Contract）', () => {
  describe('protocol/ 层', () => {
    const protocolDir = path.join(SERVICES_DIR, 'protocol');

    it('types.ts 无运行时导入', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) {
        // Phase 0 跳过
        return;
      }

      const { runtime } = getImports(typesPath);
      expect(runtime).toEqual([]);
    });

    it('types.ts 不导出函数', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;

      const content = fs.readFileSync(typesPath, 'utf-8');
      // 不应有 "export function" 或 "export const ... = (...) =>"
      expect(content).not.toMatch(/export\s+(async\s+)?function\s/);
      expect(content).not.toMatch(/export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>/);
    });

    it('types.ts 导出 BroadcastGameState', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) {
        // Phase 0 跳过
        return;
      }

      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+interface\s+BroadcastGameState\b/);
    });

    it('types.ts 导出 HostBroadcast', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;

      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+type\s+HostBroadcast\b/);
    });

    it('types.ts 导出 PlayerMessage', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;

      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+type\s+PlayerMessage\b/);
    });

    it('types.ts 导出 ProtocolAction', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;

      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+interface\s+ProtocolAction\b/);
    });
  });

  describe('core/ 层', () => {
    it('core/ 不运行时导入 transport/', () => {
      const coreDir = path.join(SERVICES_DIR, 'core');
      if (!fs.existsSync(coreDir)) return;

      const files = getAllTsFiles(coreDir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*transport/);
        }
      }
    });

    it('core/ 不运行时导入 BroadcastService', () => {
      const coreDir = path.join(SERVICES_DIR, 'core');
      if (!fs.existsSync(coreDir)) return;

      const files = getAllTsFiles(coreDir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*BroadcastService/);
        }
      }
    });
  });

  describe('v2/ 层', () => {
    it('v2/ 不运行时导入 legacy/', () => {
      const v2Dir = path.join(SERVICES_DIR, 'v2');
      if (!fs.existsSync(v2Dir)) return;

      const files = getAllTsFiles(v2Dir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*legacy/);
        }
      }
    });

    it('v2/ 不运行时导入 GameStateService', () => {
      const v2Dir = path.join(SERVICES_DIR, 'v2');
      if (!fs.existsSync(v2Dir)) return;

      const files = getAllTsFiles(v2Dir);
      for (const filePath of files) {
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*GameStateService/);
        }
      }
    });
  });

  describe('BroadcastService 类型迁移', () => {
    it('BroadcastService.ts 不再定义 BroadcastGameState 接口（只重导出）', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      // 不应有本地 interface 定义
      expect(content).not.toMatch(/^export\s+interface\s+BroadcastGameState\b/m);
    });

    it('BroadcastService.ts 不再定义 HostBroadcast 类型（只重导出）', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      // 允许 "export type { HostBroadcast } from"，但不允许 "export type HostBroadcast ="
      expect(content).not.toMatch(/^export\s+type\s+HostBroadcast\s*=/m);
    });

    it('BroadcastService.ts 不再定义 PlayerMessage 类型（只重导出）', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      // 允许 "export type { PlayerMessage } from"，但不允许 "export type PlayerMessage ="
      expect(content).not.toMatch(/^export\s+type\s+PlayerMessage\s*=/m);
    });

    it('BroadcastService.ts 从 protocol/types 重导出类型', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      expect(content).toMatch(
        /export\s+type\s*\{[^}]*BroadcastGameState[^}]*\}\s*from\s+['"]\.\/protocol\/types['"]/,
      );
    });
  });
});
