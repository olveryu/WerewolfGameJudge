/**
 * quickQuestions.contract.test - ROLE_QUESTIONS covers every role
 *
 * Every RoleId in ROLE_SPECS has a question list in ROLE_QUESTIONS, so a new role is never
 * silently skipped by the AI assistant's suggested questions. ROLE_QUESTIONS is private, so the
 * keys are read from the source.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAllRoleIds } from '@game-judge/game-engine/games/werewolf/public';

describe('ROLE_QUESTIONS coverage contract', () => {
  const allRoleIds = getAllRoleIds();
  const source = readFileSync(resolve(import.meta.dirname, '../quickQuestions.ts'), 'utf-8');

  // Keys between the ROLE_QUESTIONS declaration and its closing "};" (lines like "  roleId: [").
  const roleQuestionsStart = source.indexOf('const ROLE_QUESTIONS');
  const roleQuestionsBlock = source.slice(
    roleQuestionsStart,
    source.indexOf('\n};', roleQuestionsStart) + 3,
  );
  const blockKeys = new Set(
    [...roleQuestionsBlock.matchAll(/^\s{2}(\w+):\s*\[/gm)].map((match) => match[1]),
  );

  it('ROLE_QUESTIONS covers every role in ROLE_SPECS', () => {
    expect(allRoleIds.filter((id) => !blockKeys.has(id))).toEqual([]);
  });

  it('ROLE_QUESTIONS contains no stale entries absent from ROLE_SPECS', () => {
    const roleIdSet = new Set<string | undefined>(allRoleIds);
    expect([...blockKeys].filter((id) => !roleIdSet.has(id))).toEqual([]);
  });
});
