import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getAllRoleIds,
  getRoleSpec,
  type SchemaId,
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/public';

const MATRIX_PATH = resolve(
  import.meta.dirname,
  '../../../../docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md',
);
const MATRIX = readFileSync(MATRIX_PATH, 'utf8');

function readMarkedSection(sectionName: string): string {
  const startMarker = `<!-- ${sectionName}:start -->`;
  const endMarker = `<!-- ${sectionName}:end -->`;
  const start = MATRIX.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing matrix marker: ${startMarker}`);
  const contentStart = start + startMarker.length;
  const end = MATRIX.indexOf(endMarker, contentStart);
  if (end === -1) throw new Error(`Missing matrix marker: ${endMarker}`);
  return MATRIX.slice(contentStart, end);
}

function readTableRows(sectionName: string): string[][] {
  return readMarkedSection(sectionName)
    .split('\n')
    .filter((line) => /^\|\s*`/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
}

function readCodeSpan(value: string): string {
  const match = /^`([^`]+)`$/.exec(value);
  if (match === null) throw new Error(`Expected a code-formatted matrix value, got: ${value}`);
  return match[1]!;
}

function requireSchemaText(value: string | undefined, field: string): string {
  if (value === undefined) throw new Error(`Schema is missing ${field}`);
  return value;
}

function expectedButtonLabels(roleId: string, schemaId: SchemaId): readonly [string, string] {
  const schema = SCHEMAS[schemaId];
  switch (schema.kind) {
    case 'chooseSeat':
      return [
        roleId === 'wolfRobot'
          ? `— while selecting; ${requireSchemaText(schema.ui?.hunterGateButtonText, 'hunterGateButtonText')} after learning a hunter`
          : '—; seat tap opens the confirmation flow',
        schema.canSkip
          ? `${requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText')}${roleId === 'wolfRobot' ? ' while selecting' : ''}`
          : '—',
      ];
    case 'swap':
      return [
        '—; second seat opens the confirmation flow',
        schema.canSkip ? requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText') : '—',
      ];
    case 'wolfVote':
      return ['—; seat tap starts the vote flow', 'See shared wolf-vote buttons'];
    case 'compound': {
      const poisonStep = schema.steps.find((step) => step.key === 'poison');
      if (poisonStep === undefined) throw new Error('witchAction is missing its poison step');
      return [
        '对袭击目标用解药 when saving is available',
        requireSchemaText(poisonStep.ui?.bottomActionText, 'poison step bottomActionText'),
      ];
    }
    case 'confirm': {
      const statusUi = schema.ui?.confirmStatusUi;
      const secondary = statusUi?.kind === 'infection' ? statusUi.skipButtonText : '—';
      return [requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText'), secondary];
    }
    case 'groupConfirm':
      return [
        requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText'),
        '—; acknowledgement is in the reveal dialog',
      ];
    case 'multiChooseSeat':
      return [
        `${requireSchemaText(schema.ui?.confirmButtonText, 'confirmButtonText')} when targets are selected`,
        schema.canSkip ? requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText') : '—',
      ];
    case 'chooseCard':
      return [requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText'), '—'];
    case 'skip':
      return ['—', requireSchemaText(schema.ui?.bottomActionText, 'bottomActionText')];
    case 'confirmTarget':
      throw new Error('confirmTarget is supported only as a compound sub-step');
    default: {
      const exhaustive: never = schema;
      throw new Error(`Unhandled schema kind: ${String(exhaustive)}`);
    }
  }
}

function sortRows(rows: readonly (readonly string[])[]): string[][] {
  return rows
    .map((row) => [...row])
    .sort((left, right) => left.join('|').localeCompare(right.join('|')));
}

describe('Night-1 role button matrix contract', () => {
  it('matches every role step, schema kind, and schema-derived button label', () => {
    const actualRows = readTableRows('night-role-step-buttons').map((cells) => {
      expect(cells).toHaveLength(6);
      return [
        readCodeSpan(cells[0]!),
        cells[1]!,
        readCodeSpan(cells[2]!),
        readCodeSpan(cells[3]!),
        cells[4]!,
        cells[5]!,
      ];
    });
    const expectedRows = getAllRoleIds().flatMap((roleId) => {
      const role = getRoleSpec(roleId);
      return (role.nightSteps ?? []).map((step) => {
        const schema = SCHEMAS[step.stepId];
        const [primary, secondary] = expectedButtonLabels(roleId, step.stepId);
        return [roleId, role.displayName, step.stepId, schema.kind, primary, secondary];
      });
    });

    expect(sortRows(actualRows)).toEqual(sortRows(expectedRows));
  });

  it('covers every role, including roles without a role-specific Night-1 step', () => {
    const actualRows = readTableRows('night-roles-without-step').map((cells) => {
      expect(cells).toHaveLength(3);
      return [readCodeSpan(cells[0]!), cells[1]!, cells[2]!];
    });
    const expectedRows = getAllRoleIds()
      .filter((roleId) => (getRoleSpec(roleId).nightSteps ?? []).length === 0)
      .map((roleId) => {
        const role = getRoleSpec(roleId);
        const sharesWolfVote = role.recognition?.participatesInWolfVote === true;
        const note = sharesWolfVote
          ? 'No role-specific Night-1 step; still receives shared wolf-vote buttons.'
          : 'No role-specific Night-1 step; no daytime/death ability is implied by this row.';
        return [roleId, role.displayName, note];
      });
    expect(sortRows(actualRows)).toEqual(sortRows(expectedRows));

    const coveredRoleIds = new Set([
      ...getAllRoleIds().filter((roleId) => (getRoleSpec(roleId).nightSteps ?? []).length > 0),
      ...actualRows.map(([roleId]) => roleId!),
    ]);
    expect([...coveredRoleIds].sort()).toEqual([...getAllRoleIds()].sort());
  });

  it('matches the configured shared wolf-vote participants and button labels', () => {
    const rows = readTableRows('shared-wolf-vote-buttons');
    expect(rows).toHaveLength(1);
    const [rolesCell, primary, secondary] = rows[0]!;
    const actualRoleIds = [...rolesCell!.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
    const expectedRoleIds = getAllRoleIds()
      .filter((roleId) => getRoleSpec(roleId).recognition?.participatesInWolfVote === true)
      .sort();
    expect([...actualRoleIds].sort()).toEqual(expectedRoleIds);
    expect(primary).toBe('—; seat tap starts the vote flow');
    expect(secondary).toBe(
      `${requireSchemaText(SCHEMAS.wolfKill.ui?.emptyVoteText, 'wolfKill emptyVoteText')}; 取消投票 after voting`,
    );
  });
});
