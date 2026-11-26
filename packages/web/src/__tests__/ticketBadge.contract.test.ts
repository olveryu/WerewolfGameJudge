/**
 * Contract test: one unused-ticket badge rule.
 *
 * Every ticket badge shows `ticketBadgeText` (`components/ticketBadgeCount.ts`: nothing at zero,
 * capped at `99+`) of `countUnusedTickets` (`features/gacha/model/unusedTickets.ts`: normal plus
 * golden draws). No other source caps a count at 99 or sums the two balances by hand.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_DIR = join(import.meta.dirname, '..');
const BADGE_RULE = 'components/ticketBadgeCount.ts';
const TICKET_SUM = 'features/gacha/model/unusedTickets.ts';

/** A second cap: `99+`, a comparison against 99, or the cap constant used outside its module. */
const CAP = /99\+|[<>]=?\s*99\b|\b99\s*[<>]|\bTICKET_BADGE_MAX\b/;
/** A hand-written sum of the two draw balances. */
const SUM = /\b(?:normalDraws|goldenDraws)\s*\+\s*(?:\w+\??\.)*(?:normalDraws|goldenDraws)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(fullPath);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

describe('Ticket badge', () => {
  const sources = sourceFiles(SRC_DIR).map((file) => ({
    file: relative(SRC_DIR, file),
    source: readFileSync(file, 'utf8'),
  }));

  it('caps its count in one place', () => {
    const caps = sources
      .filter(({ file, source }) => file !== BADGE_RULE && CAP.test(source))
      .map(({ file }) => file);
    expect(caps).toEqual([]);
  });

  it('counts unused tickets in one place', () => {
    const sums = sources
      .filter(({ file, source }) => file !== TICKET_SUM && SUM.test(source))
      .map(({ file }) => file);
    expect(sums).toEqual([]);
  });
});
