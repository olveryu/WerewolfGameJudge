/**
 * A role's rules live in its own file. Everything else in the engine — the night flow, the
 * report, the reducer, the step mechanism — must work without naming a role, so that adding
 * or changing a role never means touching a second place.
 */

import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { getAllRoleIds } from '../catalog';

const ENGINE_ROOT = path.resolve(__dirname, '../../../..');
const CHECKED_DIRECTORIES = ['games/werewolf', 'platform/steps'];
const ROLE_DIRECTORY = 'games/werewolf/roles';

/** Preset boards are lists of roles; that is their content, not a rule about a role. */
const ROLE_LIST_DECLARATIONS: Readonly<Record<string, string>> = {
  'games/werewolf/domain/models/Template.ts': 'PRESET_TEMPLATES',
};

/**
 * Every role id literal outside the role files, by file. Two kinds are accepted:
 *
 * - `wolf` and `villager` are also the names of a faction, a team and a camp. The literals in
 *   the first group name those, not the roles; no text check can tell them apart, so they are
 *   counted, and a role-specific branch cannot hide among them unnoticed.
 * - The second group really names a role, for a reason that is not that role's own rule.
 */
const ACCEPTED_LITERALS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // Faction, team and camp names.
  'games/werewolf/domain/models/roles/camp.ts': { villager: 3, wolf: 3 },
  'games/werewolf/roles/catalog.ts': { wolf: 1 },
  'games/werewolf/roles/nightState.ts': { villager: 1, wolf: 2 },
  'games/werewolf/roles/role.ts': { villager: 1, wolf: 3 },
  'games/werewolf/roles/roleSteps.ts': { wolf: 5 },
  // Plague mode replaces a cancelled bottom card with a plain villager: the mode's rule.
  'games/werewolf/domain/models/Template.ts': { villager: 1 },
  // The wolves' shared step is announced and labelled as the plain wolf's.
  'games/werewolf/roles/wolfKill.ts': { wolf: 2 },
};

function collectProductionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectProductionFiles(filePath);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [filePath] : [];
  });
}

function isInsideDeclaration(node: ts.Node, name: string | undefined): boolean {
  if (name === undefined) return false;
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === name
    ) {
      return true;
    }
  }
  return false;
}

describe('role ownership', () => {
  it('names a role only in a role file', () => {
    const roleIds = new Set<string>(getAllRoleIds());
    const found: Record<string, Record<string, number>> = {};
    for (const directory of CHECKED_DIRECTORIES) {
      for (const filePath of collectProductionFiles(path.join(ENGINE_ROOT, directory))) {
        const relativePath = path.relative(ENGINE_ROOT, filePath).split(path.sep).join('/');
        const isRoleFile =
          path.dirname(relativePath) === ROLE_DIRECTORY &&
          roleIds.has(path.basename(relativePath, '.ts'));
        if (isRoleFile) continue;
        const source = ts.createSourceFile(
          filePath,
          fs.readFileSync(filePath, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        const visit = (node: ts.Node): void => {
          if (
            ts.isStringLiteralLike(node) &&
            roleIds.has(node.text) &&
            !isInsideDeclaration(node, ROLE_LIST_DECLARATIONS[relativePath])
          ) {
            const counts = (found[relativePath] ??= {});
            counts[node.text] = (counts[node.text] ?? 0) + 1;
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }

    // Exactly the accepted literals: a new one fails, and so does a stale entry.
    expect(found).toEqual(ACCEPTED_LITERALS);
  });
});
