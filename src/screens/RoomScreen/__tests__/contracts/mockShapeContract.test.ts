/**
 * Mock Shape Contract Test
 *
 * Verifies that the key set of createGameRoomMock's return value matches useGameRoom's return value.
 * If useGameRoom adds a field that createGameRoomMock does not include, this test will fail.
 *
 * Implementation: extracts the return-value key list from useGameRoom source (via AST-like regex),
 * and compares it against the keys actually produced by createGameRoomMock.
 *
 * Note: this is a contract test, not a functional test. Only the key set is checked, not values.
 */

import * as fs from 'fs';
import * as path from 'path';

import { createGameRoomMock } from '../harness/boardTestUtils';

// =============================================================================
// Extract keys from useGameRoom source
// =============================================================================

/**
 * Extracts field names from the return {} block in useGameRoom.ts source.
 * Match pattern: lines starting with `key:` or `key,` (comment lines are skipped).
 */
function extractReturnKeys(source: string): string[] {
  // Find the LAST `return {` block in the file (the hook's actual return value).
  // Using lastIndexOf avoids false positives from inner `return { success: ... }` blocks.
  const lastReturnIdx = source.lastIndexOf('return {');
  if (lastReturnIdx === -1) {
    throw new Error('Could not find return block in useGameRoom.ts');
  }
  const tail = source.substring(lastReturnIdx);
  // Extract the content between the outer braces
  const braceMatch = tail.match(/return\s*\{([^]*?)\};/);
  if (!braceMatch) {
    throw new Error('Could not parse return block in useGameRoom.ts');
  }

  const block = braceMatch[1]!;
  const keys: string[] = [];

  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      continue;
    }

    // Match `key:` or `key,` patterns
    // E.g.: `gameState,` → gameState
    // E.g.: `currentActionRole: nightDerived.currentActionRole,` → currentActionRole
    // E.g.: `isAudioPlaying: nightDerived.isAudioPlaying,` → isAudioPlaying
    const keyMatch = trimmed.match(/^(\w+)\s*[,:]/);
    if (keyMatch) {
      keys.push(keyMatch[1]!);
    }
  }

  return keys;
}

// =============================================================================
// Tests
// =============================================================================

describe('createGameRoomMock shape contract', () => {
  /**
   * Known gaps: keys that exist in useGameRoom but are intentionally
   * not in createGameRoomMock (existing board UI tests don't need them).
   * If this set grows, it means more drift has been introduced.
   * Reduce this set over time by adding missing keys to the mock.
   */
  const KNOWN_MISSING_KEYS = new Set<string>([
    // All gaps fixed — this set should stay empty.
    // If a new key is added to useGameRoom but not to createGameRoomMock,
    // the test below will fail and tell you exactly which key to add.
  ]);

  it('should not introduce NEW missing keys beyond known gaps', () => {
    // Read useGameRoom source
    const useGameRoomPath = path.resolve(__dirname, '../../../../hooks/useGameRoom.ts');
    const source = fs.readFileSync(useGameRoomPath, 'utf-8');
    const expectedKeys = extractReturnKeys(source);

    expect(expectedKeys.length).toBeGreaterThan(20); // Sanity check

    // Get actual mock keys
    const mock = createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'wolf',
      mySeat: 0,
    });
    const mockKeys = new Set(Object.keys(mock));

    // Find NEW missing keys (not in known gaps)
    const missingKeys = expectedKeys.filter((k) => !mockKeys.has(k));
    const newMissingKeys = missingKeys.filter((k) => !KNOWN_MISSING_KEYS.has(k));

    if (newMissingKeys.length > 0) {
      throw new Error(
        `createGameRoomMock has ${newMissingKeys.length} NEW missing keys from useGameRoom:\n` +
          `  ${newMissingKeys.join(', ')}\n\n` +
          `These new keys exist in useGameRoom's return value but are not in the mock.\n` +
          `Either add them to createGameRoomMock or to KNOWN_MISSING_KEYS in this test.`,
      );
    }

    // Also verify known missing keys are still actually missing (not stale)
    const staleMissingKeys = [...KNOWN_MISSING_KEYS].filter((k) => mockKeys.has(k));
    if (staleMissingKeys.length > 0) {
      throw new Error(
        `These keys are in KNOWN_MISSING_KEYS but now exist in the mock:\n` +
          `  ${staleMissingKeys.join(', ')}\n\n` +
          `Remove them from KNOWN_MISSING_KEYS to keep the contract accurate.`,
      );
    }
  });

  it('should document total known mock drift', () => {
    const useGameRoomPath = path.resolve(__dirname, '../../../../hooks/useGameRoom.ts');
    const source = fs.readFileSync(useGameRoomPath, 'utf-8');
    const expectedKeys = extractReturnKeys(source);

    const mock = createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'wolf',
      mySeat: 0,
    });
    const mockKeys = new Set(Object.keys(mock));

    const allMissing = expectedKeys.filter((k) => !mockKeys.has(k));
    // This assertion documents the current drift level.
    // Decrease KNOWN_MISSING_KEYS.size as gaps are fixed.
    expect(allMissing.length).toBe(0);
  });

  it('should not have extra keys not in useGameRoom return value', () => {
    const useGameRoomPath = path.resolve(__dirname, '../../../../hooks/useGameRoom.ts');
    const source = fs.readFileSync(useGameRoomPath, 'utf-8');
    const expectedKeys = new Set(extractReturnKeys(source));

    const mock = createGameRoomMock({
      schemaId: 'wolfKill',
      currentActionRole: 'wolf',
      myRole: 'wolf',
      mySeat: 0,
    });
    const mockKeys = Object.keys(mock);

    // Find extra keys in mock that don't exist in useGameRoom
    const extraKeys = mockKeys.filter((k) => !expectedKeys.has(k));

    if (extraKeys.length > 0) {
      throw new Error(
        `createGameRoomMock has ${extraKeys.length} extra keys not in useGameRoom:\n` +
          `  ${extraKeys.join(', ')}\n\n` +
          `These keys exist in the mock but not in useGameRoom's return value.\n` +
          `Remove them from createGameRoomMock to prevent false coverage.`,
      );
    }
  });
});
