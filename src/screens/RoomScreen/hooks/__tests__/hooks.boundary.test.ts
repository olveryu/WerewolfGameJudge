/**
 * Boundary tests for RoomScreen hooks
 *
 * These tests enforce architectural constraints:
 * - Hooks do NOT advance night phase
 * - Hooks do NOT directly write state
 * - Hooks do NOT import service singletons
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const HOOKS_DIR = path.join(__dirname, '..');

// Helper to check if content matches any forbidden pattern
function containsForbiddenImport(content: string, forbidden: string): boolean {
  const importPattern = new RegExp(
    String.raw`import\s+.*\b` + forbidden + String.raw`\b.*from`,
    'g',
  );
  const requirePattern = new RegExp(String.raw`require\(.*` + forbidden, 'g');
  return importPattern.test(content) || requirePattern.test(content);
}

function matchesAnyPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

// Helper to check forbidden imports in a file
function checkForbiddenImports(file: string): boolean {
  const forbiddenImports = [
    'GameStateService',
    'BroadcastService',
    'NightFlowController',
    'RoomService',
    'supabase',
  ];
  const filePath = path.join(HOOKS_DIR, file);
  if (!fs.existsSync(filePath)) return false; // skip if not exists
  const content = fs.readFileSync(filePath, 'utf-8');
  return forbiddenImports.some((f) => containsForbiddenImport(content, f));
}

describe('RoomScreen hooks boundary constraints', () => {
  const hookFiles = ['useActionerState.ts', 'useRoomInit.ts', 'useRoomActions.ts'];

  describe('No service singleton imports', () => {
    it.each(hookFiles)('%s does not import forbidden service singletons', (file) => {
      expect(checkForbiddenImports(file)).toBe(false);
    });
  });

  describe('No direct state mutation', () => {
    const stateMutationPatterns = [
      /\.setState\s*\(/,
      /gameState\s*=\s*[^=]/,
      /\.actions\.set\s*\(/,
      /\.wolfVotes\.set\s*\(/,
      /\.players\.set\s*\(/,
    ];

    it.each(hookFiles)('%s does not directly mutate game state', (file) => {
      const filePath = path.join(HOOKS_DIR, file);
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(matchesAnyPattern(content, stateMutationPatterns)).toBe(false);
    });
  });

  describe('No night phase advancement', () => {
    const nightAdvancePatterns = [
      /advanceToNextAction\s*\(/,
      /currentStepIndex\s*\+\+/,
      /currentStepIndex\s*\+=\s*1/,
      /setCurrentActionerIndex\s*\(/,
      /endNight\s*\(/,
      /startNight\s*\(/,
    ];

    it.each(hookFiles)('%s does not advance night phase', (file) => {
      const filePath = path.join(HOOKS_DIR, file);
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(matchesAnyPattern(content, nightAdvancePatterns)).toBe(false);
    });
  });

  describe('useActionerState is pure derivation', () => {
    it('only uses useMemo for derivation', () => {
      const filePath = path.join(HOOKS_DIR, 'useActionerState.ts');
      if (!fs.existsSync(filePath)) {
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should use useMemo
      expect(content).toMatch(/useMemo/);

      // Should NOT use useEffect for side effects
      expect(content).not.toMatch(/useEffect/);

      // Should NOT use useState (no local state)
      expect(content).not.toMatch(/useState/);
    });
  });

  describe('useRoomInit constraints', () => {
    it('only handles initialization, not game actions', () => {
      const filePath = path.join(HOOKS_DIR, 'useRoomInit.ts');
      if (!fs.existsSync(filePath)) {
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should NOT import action-related functions
      expect(content).not.toMatch(/submitAction/);
      expect(content).not.toMatch(/submitWolfVote/);
      expect(content).not.toMatch(/performSeerAction/);
    });
  });

  describe('useRoomActions constraints', () => {
    it('does not import NightFlowController', () => {
      const filePath = path.join(HOOKS_DIR, 'useRoomActions.ts');
      if (!fs.existsSync(filePath)) {
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');

      // Only check for actual imports, not mentions in comments
      expect(containsForbiddenImport(content, 'NightFlowController')).toBe(false);
    });

    it('is pure Intent Layer - returns ActionIntent, does NOT call submit functions', () => {
      const filePath = path.join(HOOKS_DIR, 'useRoomActions.ts');
      if (!fs.existsSync(filePath)) {
        return;
      }
      const content = fs.readFileSync(filePath, 'utf-8');

      // Intent Layer: must export ActionIntent type
      expect(content).toMatch(/export\s+(interface|type)\s+ActionIntent/);

      // Intent Layer: must export getActionIntent function
      expect(content).toMatch(/getActionIntent/);

      // Intent Layer: must NOT call submitAction / submitWolfVote directly
      expect(content).not.toMatch(/submitAction\s*\(/);
      expect(content).not.toMatch(/submitWolfVote\s*\(/);

      // Intent Layer: must NOT show dialogs (those are in useRoomActionDialogs)
      expect(content).not.toMatch(/showAlert\s*\(/);
      expect(content).not.toMatch(/Alert\.alert\s*\(/);

      // Intent Layer: must NOT directly call GameStateService
      expect(content).not.toMatch(/GameStateService\.getInstance/);
    });
  });
});
