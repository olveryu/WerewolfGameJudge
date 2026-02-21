/**
 * quickQuestions.contract.test - Contract test ensuring ROLE_QUESTIONS covers all roles
 *
 * Verifies that every RoleId in ROLE_SPECS has a corresponding question list
 * in ROLE_QUESTIONS, so newly added roles are never silently skipped
 * by the AI assistant's suggested questions.
 */
import { getAllRoleIds } from '@werewolf/game-engine/models/roles';
// ROLE_QUESTIONS is not exported, so we test via generateQuickQuestions behavior.
// We import the module source to read ROLE_QUESTIONS via a static-analysis approach.
import * as fs from 'fs';
import * as path from 'path';

describe('ROLE_QUESTIONS coverage contract', () => {
  const allRoleIds = getAllRoleIds();

  // Read the source file and extract ROLE_QUESTIONS keys
  const sourcePath = path.resolve(__dirname, '../quickQuestions.ts');
  const source = fs.readFileSync(sourcePath, 'utf-8');

  // Extract all keys from ROLE_QUESTIONS object literal (lines like "  roleId: [")
  const keyRegex = /^\s{2}(\w+):\s*\[/gm;
  const foundKeys = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(source)) !== null) {
    foundKeys.add(match[1]);
  }

  // Filter to only keys that appear between "ROLE_QUESTIONS" declaration and its closing "};"
  const roleQuestionsStart = source.indexOf('const ROLE_QUESTIONS');
  const roleQuestionsBlock = source.slice(
    roleQuestionsStart,
    source.indexOf('\n};', roleQuestionsStart) + 3,
  );
  const blockKeys = new Set<string>();
  const blockRegex = /^\s{2}(\w+):\s*\[/gm;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(roleQuestionsBlock)) !== null) {
    blockKeys.add(blockMatch[1]);
  }

  it('ROLE_QUESTIONS covers every role in ROLE_SPECS', () => {
    const missing = allRoleIds.filter((id) => !blockKeys.has(id));
    expect(missing).toEqual([]);
  });

  it('ROLE_QUESTIONS contains no stale entries absent from ROLE_SPECS', () => {
    const roleIdSet = new Set<string>(allRoleIds);
    const stale = [...blockKeys].filter((id) => !roleIdSet.has(id));
    expect(stale).toEqual([]);
  });
});
