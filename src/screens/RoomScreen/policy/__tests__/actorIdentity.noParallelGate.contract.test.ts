/**
 * actorIdentity.noParallelGate.contract.test.ts
 *
 * Anti-drift contract tests to ensure:
 * 1. Policy layer does not directly use effective* for gating
 * 2. No parallel action order sources exist
 * 3. Actor identity single source of truth is maintained
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Project root (go up from __tests__ -> policy -> RoomScreen -> screens -> src -> project root)
const PROJECT_ROOT = path.resolve(__dirname, '../../../../../');

// Helper to read file content
function readFileContent(relativePath: string): string {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  return fs.readFileSync(absolutePath, 'utf-8');
}

// Helper to find files matching pattern
function findFiles(dir: string, pattern: RegExp, exclude: RegExp[] = []): string[] {
  const absoluteDir = path.join(PROJECT_ROOT, dir);
  const results: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(absoluteDir, fullPath);

      // Skip excluded paths
      if (exclude.some((ex) => ex.test(relativePath) || ex.test(entry.name))) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(absoluteDir);
  return results;
}

describe('Actor Identity Anti-Drift Contracts', () => {
  describe('No parallel action identity gate', () => {
    it('RoomInteractionPolicy should not directly use effectiveSeat/effectiveRole for gating', () => {
      const policyContent = readFileContent(
        'src/screens/RoomScreen/policy/RoomInteractionPolicy.ts',
      );

      // Policy should NOT contain effectiveSeat or effectiveRole
      // (except in comments or type imports which we'll allow)
      const lines = policyContent.split('\n');
      const violatingLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments and imports
        if (
          line.trim().startsWith('//') ||
          line.trim().startsWith('*') ||
          line.includes('import')
        ) {
          continue;
        }
        // Check for direct usage of effectiveSeat/effectiveRole
        if (/\beffectiveSeat\b/.test(line) || /\beffectiveRole\b/.test(line)) {
          violatingLines.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }

      expect(violatingLines).toEqual([]);
    });

    it('SeatTapPolicy should not directly use effectiveSeat/effectiveRole', () => {
      const policyContent = readFileContent('src/screens/RoomScreen/seatTap/SeatTapPolicy.ts');

      const lines = policyContent.split('\n');
      const violatingLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.trim().startsWith('//') ||
          line.trim().startsWith('*') ||
          line.includes('import')
        ) {
          continue;
        }
        if (/\beffectiveSeat\b/.test(line) || /\beffectiveRole\b/.test(line)) {
          violatingLines.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }

      expect(violatingLines).toEqual([]);
    });

    it('InteractionContext should use actorSeatForUi/actorRoleForUi, not effectiveSeat/effectiveRole', () => {
      const typesContent = readFileContent('src/screens/RoomScreen/policy/types.ts');

      // InteractionContext should have actorSeatForUi and actorRoleForUi
      expect(typesContent).toMatch(/actorSeatForUi:\s*number\s*\|\s*null/);
      expect(typesContent).toMatch(/actorRoleForUi:\s*RoleId\s*\|\s*null/);

      // InteractionContext should NOT have effectiveSeat or effectiveRole as properties
      // (Check within the InteractionContext interface definition)
      const interfaceRegex = /export interface InteractionContext\s*\{[\s\S]*?\n\}/;
      const interfaceMatch = interfaceRegex.exec(typesContent);
      expect(interfaceMatch).toBeTruthy();

      if (interfaceMatch) {
        const interfaceContent = interfaceMatch[0];
        expect(interfaceContent).not.toMatch(/^\s*effectiveSeat:/m);
        expect(interfaceContent).not.toMatch(/^\s*effectiveRole:/m);
      }
    });
  });

  describe('Night steps single source of truth', () => {
    it('should not have any ACTION_ORDER definition (legacy pattern)', () => {
      const files = findFiles('src', /\.tsx?$/, [/__tests__/, /\.test\./, /node_modules/]);

      const violations: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            continue;
          }
          // Check for ACTION_ORDER (which would be a parallel order source)
          if (
            /\bACTION_ORDER\b/.test(line) &&
            !line.includes('removed') &&
            !line.includes('deprecated')
          ) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('should have exactly one NIGHT_STEPS export', () => {
      const nightStepsFile = readFileContent(
        'packages/game-engine/src/models/roles/spec/nightSteps.ts',
      );

      // Count export statements for NIGHT_STEPS
      const exportMatches = nightStepsFile.match(/export\s+(const|let|var)\s+NIGHT_STEPS\b/g);

      expect(exportMatches).toHaveLength(1);
    });

    it('all audioKey references should come from NIGHT_STEPS (not from ROLE_SPECS)', () => {
      const specsContent = readFileContent('packages/game-engine/src/models/roles/spec/specs.ts');

      // ROLE_SPECS should not define audioKey (it should come from NIGHT_STEPS)
      // Look for audioKey: 'xxx' pattern which would indicate duplicate definition
      const lines = specsContent.split('\n');
      const audioKeyDefinitions: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.trim().startsWith('//') ||
          line.trim().startsWith('*') ||
          line.includes('import')
        ) {
          continue;
        }
        // Look for audioKey: 'xxx' pattern which would indicate duplicate definition
        if (/audioKey\s*:\s*['"]/.test(line)) {
          audioKeyDefinitions.push(`Line ${i + 1}: ${line.trim()}`);
        }
      }

      expect(audioKeyDefinitions).toEqual([]);
    });
  });

  describe('Actor identity required fields', () => {
    it('InteractionContext should have required debug mode fields (non-optional)', () => {
      const typesContent = readFileContent('src/screens/RoomScreen/policy/types.ts');

      // These fields should be required (no ? after the field name)
      // isDebugMode: boolean (not isDebugMode?: boolean)
      expect(typesContent).toMatch(/isDebugMode:\s*boolean;/);
      expect(typesContent).not.toMatch(/isDebugMode\?:\s*boolean;/);

      // controlledSeat: number | null (not controlledSeat?: number | null)
      expect(typesContent).toMatch(/controlledSeat:\s*number\s*\|\s*null;/);
      expect(typesContent).not.toMatch(/controlledSeat\?:/);

      // isDelegating: boolean (not isDelegating?: boolean)
      expect(typesContent).toMatch(/isDelegating:\s*boolean;/);
      expect(typesContent).not.toMatch(/isDelegating\?:\s*boolean;/);
    });

    it('getActorIdentity should have fail-fast for delegation consistency', () => {
      const actorIdentityContent = readFileContent(
        'src/screens/RoomScreen/policy/actorIdentity.ts',
      );

      // Should have consistency check: effectiveSeat !== controlledSeat
      expect(actorIdentityContent).toMatch(/effectiveSeat\s*!==\s*controlledSeat/);

      // Should return null identity on inconsistency
      expect(actorIdentityContent).toMatch(/actorSeatForUi:\s*null/);
      expect(actorIdentityContent).toMatch(/actorRoleForUi:\s*null/);
    });
  });
});
