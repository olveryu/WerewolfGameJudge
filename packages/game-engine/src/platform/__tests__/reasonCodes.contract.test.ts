/**
 * Reason-code contract (AU-48): rejection reasons are wire protocol.
 *
 * Every game's REASONS-class constants must hold stable English codes
 * (snake_case), never display text. User-facing copy lives in the
 * client presenters, keyed by these codes. Werewolf has no REASONS
 * table (its handler literals are already English codes).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AVALON_REASONS, teamSizeReason } from '../../games/avalon/domain/decision';
import { DRAWGUESS_REASONS } from '../../games/drawguess/domain/decision';
import * as fibReasons from '../../games/fibking/domain/reasons';
import * as pictionaryReasons from '../../games/pictionary/domain/reasons';
import { STORY_RELAY_REASONS } from '../../games/storyrelay/domain/decision';
import { UNDERCOVER_REASONS } from '../../games/undercover/domain/decision';

const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

function reasonTableValues(table: Record<string, string>): string[] {
  return Object.values(table);
}

function standaloneReasonValues(module: Record<string, unknown>): string[] {
  return Object.entries(module)
    .filter(([name]) => name.startsWith('REASON_'))
    .map(([, value]) => {
      if (typeof value !== 'string') throw new Error('REASON_* exports must be strings');
      return value;
    });
}

describe('reason codes are stable English codes, never display text', () => {
  it.each([
    ['avalon', reasonTableValues(AVALON_REASONS)],
    ['drawguess', reasonTableValues(DRAWGUESS_REASONS)],
    ['storyrelay', reasonTableValues(STORY_RELAY_REASONS)],
    ['undercover', reasonTableValues(UNDERCOVER_REASONS)],
    ['fibking', standaloneReasonValues(fibReasons)],
    ['pictionary', standaloneReasonValues(pictionaryReasons)],
  ])('%s reasons all match the code pattern', (_game, values) => {
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(CODE_PATTERN);
    }
  });

  it('avalon team-size reason is a stable code plus its numeric parameter', () => {
    expect(teamSizeReason(3)).toBe('avalon_team_size_invalid:3');
    expect(teamSizeReason(3)).toMatch(/^avalon_[a-z_]+:\d+$/);
  });
});

/**
 * The tables above cannot see ad-hoc literals: a `reject('中文文案')` call
 * bypasses every REASONS table. Scan all seven games' production sources
 * for CJK text passed straight to reject/handlerError.
 */
describe('no CJK display text is passed to reject/handlerError anywhere', () => {
  const gamesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'games');
  const CJK_REJECT = /(?:reject|handlerError)\(\s*['"`][^'"`]*[\u4e00-\u9fff]/;

  function productionFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : productionFiles(full);
      }
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
    });
  }

  it.each(['avalon', 'drawguess', 'fibking', 'pictionary', 'storyrelay', 'undercover', 'werewolf'])(
    '%s production sources contain no CJK rejection literals',
    (game) => {
      const offenders = productionFiles(path.join(gamesDir, game)).filter((file) =>
        CJK_REJECT.test(fs.readFileSync(file, 'utf-8')),
      );
      expect(offenders).toEqual([]);
    },
  );
});
