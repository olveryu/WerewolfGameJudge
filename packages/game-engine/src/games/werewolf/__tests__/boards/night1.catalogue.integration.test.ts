import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { formatSeat } from '../../../../platform/room/formatSeat';
import { renderBlockedPrompt } from '../../../../platform/steps';
import { NIGHT_CASES } from './nightCases';
import { collectShownText, renderStepCatalogue } from './stepCatalogue';

const WEREWOLF_DIRECTORY = path.resolve(__dirname, '../..');
const COPY_SOURCES = [
  ...fs
    .readdirSync(path.join(WEREWOLF_DIRECTORY, 'roles'))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(WEREWOLF_DIRECTORY, 'roles', name)),
  path.join(WEREWOLF_DIRECTORY, 'domain/stepProjection.ts'),
  path.join(WEREWOLF_DIRECTORY, 'domain/review/nightReview.ts'),
  path.resolve(WEREWOLF_DIRECTORY, '../../platform/steps/copy.ts'),
];

/** Card text is shown on the role card and in the encyclopedia, not during the night. */
const CARD_KEYS = /^(name|shortName|emoji|description|.+Text)$/;

/** Sentences no played night can show, each with where it is shown and tested instead. */
const SHOWN_ELSEWHERE: Readonly<Record<string, string>> = {
  'treasureMaster.needsPlainWolf': 'board setup; Template.validation.test.ts',
  'treasureMaster.needsGod': 'board setup; Template.validation.test.ts',
  'treasureMaster.needsVillager': 'board setup; Template.validation.test.ts',
  'copy.staleStep': 'a submission that arrives after the step moved on; steps.contract.test.ts',
};

interface CopyEntry {
  readonly id: string;
  readonly text: string;
}

function collectCopy(filePath: string): CopyEntry[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const entries: CopyEntry[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineCopy'
    ) {
      const table = node.arguments[0];
      if (table !== undefined && ts.isObjectLiteralExpression(table)) {
        for (const property of table.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
          if (!ts.isStringLiteralLike(property.initializer)) continue;
          entries.push({
            id: `${path.basename(filePath, '.ts')}.${property.name.text}`,
            text: property.initializer.text,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return entries;
}

/** A copy template as a pattern: placeholders match anything, the written words must appear. */
function toPattern(template: string): RegExp {
  const escaped = template
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]+?');
  return new RegExp(escaped);
}

describe('Night-1 step-by-step list', () => {
  it('matches the generated list of what every step shows in every situation', async () => {
    await expect(renderStepCatalogue(NIGHT_CASES)).toMatchFileSnapshot(
      './__snapshots__/night-steps.catalogue.txt',
    );
  });

  it('shows every sentence written for the night in at least one played night', () => {
    const shown = collectShownText(NIGHT_CASES);
    const unreached = COPY_SOURCES.flatMap(collectCopy)
      .filter((entry) => !CARD_KEYS.test(entry.id.split('.')[1] ?? ''))
      .filter((entry) => /\p{Script=Han}/u.test(entry.text))
      .filter((entry) => !toPattern(entry.text).test(shown))
      .map((entry) => entry.id);

    // Exactly the listed exceptions: a new unreached sentence fails, and so does a stale exception.
    expect(unreached.sort()).toEqual(Object.keys(SHOWN_ELSEWHERE).sort());
  });

  // A greyed card prints no reason, so the status line has to carry it.
  it('explains every greyed card in the status line and names the one card left to press', () => {
    const violations: string[] = [];
    for (const nightCase of NIGHT_CASES) {
      for (const sighting of nightCase.play().sightings) {
        if (sighting.cards.every((card) => card.isAvailable)) continue;
        const where = `${nightCase.name} > ${sighting.stepId} > ${formatSeat(sighting.seat)}`;
        const available = sighting.cards.filter((card) => card.isAvailable);
        const [onlyCard] = available;
        if (sighting.status === null) {
          violations.push(`${where}: a card is greyed out and the status line is empty`);
        } else if (
          available.length === 1 &&
          onlyCard !== undefined &&
          !sighting.status.endsWith(renderBlockedPrompt('', onlyCard.label))
        ) {
          violations.push(`${where}: "${sighting.status}" does not point at 「${onlyCard.label}」`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
