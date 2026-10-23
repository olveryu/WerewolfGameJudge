/**
 * Settle countdown registry (E-3): the value table below is the
 * one registration of the "all submitted -> arm 5s -> settle on
 * expiry" round close. Adoption is registered per access point,
 * not per game, because one game can host two points (werewolf
 * night wolf vote and sheriff election; avalon team vote and
 * quest plays) that switch in different PRs.
 *
 * - 'switched': the access point's host file calls
 *   `decideSettleCountdownArm` (welded bidirectionally below: a
 *   pending point must not call it yet, and the call count across
 *   all game sources must equal the number of switched points, so
 *   an unregistered adoption — a new drift call site — fails).
 * - 'pending': the point is a verified adopter with a named
 *   landing PR. Its current arming form stays registered until
 *   that PR flips the row. (No registered point is pending
 *   today: sheriff's arm — a net-new carrier landed by PR-2b —
 *   was the last to flip.)
 *
 * Clear reachability is registered per point with its reason:
 * the skeleton keeps one three-way decision for all points; a
 * point whose submissions cannot be retracted simply never
 * produces the clear input combination.
 *
 * No-manual-close weld: a voting phase closes only by the armed
 * countdown expiring. Manual close surfaces that still exist are
 * registered as ruled-pending-deletion with presence markers —
 * while deletion is pending the markers must still be there (a
 * silently vanished marker means the registry rotted); the PR
 * that deletes one flips its row to 'none' in the same change.
 *
 * Out-of-registry baselines (bidirectional weld below):
 * - relay answering is the no-countdown variant (registry label
 *   `relayImmediate`; there is no such code symbol): the last
 *   ready seat transitions the phase immediately with a null
 *   deadline in `platform/room/relay/tasks.ts`.
 * - werewolf's expiry side (`inlineProgression`) is out of
 *   domain, and its empty-step AUTO_SKIP arming is the second
 *   writer of the werewolf `stepDeadline` carrier — registered
 *   here so the countdown welds never mistake it for an adopter.
 *
 * Deadline arithmetic weld (bidirectional, below): every
 * now-anchored deadline addition in the scanned sources must
 * appear in `EXPECTED_DEADLINE_ARITHMETIC`, and every registered
 * entry must still be present — the scanned multiset and the
 * registry must be exactly equal, so a new unregistered arm
 * computation fails and a silently vanished registered one
 * fails too. Anchors are `nowMs`, `now`, and `phaseStartAt`
 * (bare or behind a dotted prefix such as `context.` /
 * `input.` / `execution.`), plus `Date.now()`; the right-hand
 * side is unrestricted (a literal such as `5000`, a named
 * constant, or a call). Registrations are exact points — one
 * file, one enclosing function, one normalized expression —
 * never a whole file or directory. The registered points are
 * the skeleton's set branch and the out-of-registry baselines:
 * demo and drawguess stage-entry arming (E-2 domain), the relay
 * clock helper and gallery resume re-arm (relay domain), and
 * the werewolf inline AUTO_SKIP second writer. The switched
 * adopters contribute no local arithmetic: their call sites
 * pass `nowMs` into the skeleton, whose set branch is the one
 * registered addition. (The two avalon legacy arm fragments
 * were registered under `avalonPending` while those points
 * were pending; PR-2 switched them and the registrations were
 * retired — the `avalonPending` domain now stands empty, kept
 * so the step below still welds any future pending avalon
 * arithmetic registration to the adopter registry.)
 *
 * Known limits of this weld's text scan: the parenthesized
 * anchor form — `(context.nowMs) + 5000`,
 * `(Date.now()) + 5000` — is covered (one closing parenthesis
 * may sit between the anchor and the `+`). Two escapes remain
 * known limitations. A regex literal containing `//` earlier
 * on the same line masks the rest of that line for the comment
 * stripper, so arithmetic behind it is not scanned; and an
 * anchor handed off through an alias variable before the
 * addition leaves the anchor set entirely. Closing either
 * needs lexical or data-flow analysis, which is out of
 * proportion for a drift weld — and both forms are deliberate,
 * review-visible obfuscation rather than accidental drift.
 *
 * Weld scan scope is the game-engine production sources: every
 * non-test `.ts` file under `packages/game-engine/src` (games,
 * platform, and product trees), with comments stripped before
 * scanning so a comment quoting an arm form is not a hit. The
 * avalon client's `settleCountdownSeconds` display field (root
 * `src/`) is a presentation value, not an arm site, and is out
 * of scope by construction.
 *
 * Division of ownership with the E-2 registry
 * (`platform/__tests__/phaseDeadlineVariants.contract.test.ts`):
 * E-3 owns the arm computation — the `decideSettleCountdownArm`
 * truth table, the per-access-point adoption registry, and the
 * deadline arithmetic weld in this file. E-2 owns the expiry
 * side: the phase expiry guard assembly, the settle.due pin,
 * and the worker delivery of the pinned effect. For avalon the
 * two meet at one value: the `deadlineAt` the skeleton arm
 * produces here is the value avalon pins through
 * `buildSettleDueEffect` (`sequence+phase+round+deadline`) and
 * that the E-2 value table's avalon row registers as its
 * settlePin.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { decideSettleCountdownArm, SETTLE_COUNTDOWN_MS } from '../settleCountdown';

const gamesDirectory = path.resolve(__dirname, '..', '..', '..', 'games');
const relayTasksPath = path.resolve(__dirname, '..', 'relay', 'tasks.ts');

type SettleCountdownAccessPointId =
  | 'werewolf:wolf-vote'
  | 'werewolf:sheriff-vote'
  | 'avalon:vote'
  | 'avalon:quest';

type ClearRegistration =
  | 'reachable'
  | 'unreachable-ballotsAppendOnly'
  | 'unreachable-submissionIrrevocable';

type ManualCloseRegistration =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'ruledPendingDeletion';
      /** File (relative to the games directory) the markers are welded against. */
      readonly markerFile: string;
      /** Literals that must still be present while deletion is pending. */
      readonly presenceMarkers: readonly string[];
      /** Where the deletion lands. */
      readonly deletion: string;
    };

interface SettleCountdownRow {
  readonly adoption: 'switched' | 'pending';
  /** Landing PR for a pending row; absent once switched. */
  readonly landingPr?: string;
  /** File (relative to the games directory) hosting this point's arm call. */
  readonly hostFile: string;
  readonly clear: ClearRegistration;
  /**
   * Marker of this point's pre-skeleton arm fragment, for a
   * pending row that still arms in its own code. Counted in the
   * host file: one occurrence per pending point carrying it.
   */
  readonly legacyArmMarker?: string;
  readonly manualClose: ManualCloseRegistration;
}

/** Registered settle countdown adopters, per access point. */
const EXPECTED_SETTLE_COUNTDOWN_ADOPTERS: Readonly<
  Record<SettleCountdownAccessPointId, SettleCountdownRow>
> = {
  'werewolf:wolf-vote': {
    adoption: 'switched',
    hostFile: 'werewolf/domain/handlers/actionHandler.ts',
    // Wolves can retract a vote, so completion can fall back
    // after arming and the clear branch is reachable.
    clear: 'reachable',
    manualClose: { kind: 'none' },
  },
  'werewolf:sheriff-vote': {
    adoption: 'switched',
    hostFile: 'werewolf/domain/handlers/sheriffElectionHandler.ts',
    // Sheriff ballots are append-only (cast or overwritten, never
    // removed), so completion is monotonic and clear is
    // structurally unreachable at this point.
    clear: 'unreachable-ballotsAppendOnly',
    // E-3 PR-2b deleted the advance vote-phase close branch: a
    // sheriff voting phase now closes only on countdown expiry.
    manualClose: { kind: 'none' },
  },
  'avalon:vote': {
    adoption: 'switched',
    hostFile: 'avalon/engine.ts',
    // Avalon ballots can be overwritten but never retracted, so
    // completion is monotonic and clear is unreachable.
    clear: 'unreachable-submissionIrrevocable',
    // The host's manual finish was deleted outright (2026-10-21
    // ruling): the armed countdown expiring is the only close.
    manualClose: { kind: 'none' },
  },
  'avalon:quest': {
    adoption: 'switched',
    hostFile: 'avalon/engine.ts',
    // Quest plays can be overwritten but never retracted, so
    // completion is monotonic and clear is unreachable.
    clear: 'unreachable-submissionIrrevocable',
    // The host's manual finish was deleted outright (2026-10-21
    // ruling): the armed countdown expiring is the only close.
    manualClose: { kind: 'none' },
  },
};

const ACCESS_POINT_IDS = Object.keys(
  EXPECTED_SETTLE_COUNTDOWN_ADOPTERS,
) as SettleCountdownAccessPointId[];

const engineSourceDirectory = path.resolve(__dirname, '..', '..', '..');

type DeadlineArithmeticDomain =
  | 'skeleton'
  | 'avalonPending'
  | 'e2StageDeadline'
  | 'relayClock'
  | 'werewolfInlineAutoSkip';

interface DeadlineArithmeticRegistration {
  /** File relative to `packages/game-engine/src` (posix separators). */
  readonly file: string;
  /** Function enclosing the arithmetic. */
  readonly symbol: string;
  /** Normalized `left + firstRightToken` form of the addition. */
  readonly expression: string;
  readonly domain: DeadlineArithmeticDomain;
}

/**
 * Every now-anchored deadline addition in the game-engine
 * production sources, registered as exact points. The switched
 * points (werewolf wolf-vote and sheriff-vote; avalon vote and
 * quest) contribute no local arithmetic: their call sites pass
 * `nowMs` into the
 * skeleton, and the skeleton's set branch is the one addition.
 */
const EXPECTED_DEADLINE_ARITHMETIC: readonly DeadlineArithmeticRegistration[] = [
  {
    file: 'platform/room/settleCountdown.ts',
    symbol: 'decideSettleCountdownArm',
    expression: 'input.nowMs + countdownMs',
    domain: 'skeleton',
  },
  {
    file: 'games/demo/engine.ts',
    symbol: 'beginGame',
    expression: 'context.nowMs + DEMO_STAGE_DURATION_MS',
    domain: 'e2StageDeadline',
  },
  {
    file: 'games/drawguess/engine.ts',
    symbol: 'dealWords',
    expression: 'context.nowMs + DRAWGUESS_WORD_SELECT_SECONDS',
    domain: 'e2StageDeadline',
  },
  {
    file: 'games/drawguess/engine.ts',
    symbol: 'beginDrawing',
    expression: 'phaseStartAt + DRAWGUESS_DRAWING_DURATION_SECONDS',
    domain: 'e2StageDeadline',
  },
  {
    file: 'games/drawguess/engine.ts',
    symbol: 'endRound',
    expression: 'context.nowMs + DRAWGUESS_ROUND_END_SECONDS',
    domain: 'e2StageDeadline',
  },
  {
    file: 'platform/room/relay/clock.ts',
    symbol: 'relayDeadline',
    expression: 'nowMs + seconds',
    domain: 'relayClock',
  },
  {
    // Resume re-arm in the gallery control path; gallery moves
    // proper go through `relayDeadline` above and add no second
    // arithmetic point.
    file: 'platform/room/relay/gallery.ts',
    symbol: 'controlRelayGallery',
    expression: 'nowMs + duration',
    domain: 'relayClock',
  },
  {
    file: 'games/werewolf/domain/inlineProgression.ts',
    symbol: 'runInlineProgression',
    expression: 'execution.nowMs + randomIntInclusive',
    domain: 'werewolfInlineAutoSkip',
  },
];

/** Concatenated non-test source of one directory tree. */
function readSourceTree(root: string): string {
  const chunks: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(entryPath);
      } else if (entry.name.endsWith('.ts')) {
        chunks.push(fs.readFileSync(entryPath, 'utf8'));
      }
    }
  };
  walk(root);
  return chunks.join('\n');
}

function readGameFile(relativePath: string): string {
  return fs.readFileSync(path.join(gamesDirectory, relativePath), 'utf8');
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Relative paths (posix separators) of every non-test `.ts` file under a tree. */
function listProductionSourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(entryPath);
      } else if (entry.name.endsWith('.ts')) {
        files.push(path.relative(root, entryPath).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Blanks out line and block comments (string and template
 * literals are preserved), keeping offsets and newlines intact
 * so positions in the stripped text match the original file.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const char = source[i]!;
    const next = source[i + 1];
    if (quote !== null) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      out += char;
      i += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

interface DeadlineArithmeticHit {
  readonly file: string;
  readonly symbol: string;
  readonly expression: string;
}

/**
 * Finds every now-anchored deadline addition in one production
 * source file: an anchor (`nowMs` / `now` / `phaseStartAt`, bare
 * or behind a dotted prefix, or `Date.now()`) added to a first
 * right-hand token (identifier or numeric literal, optionally
 * parenthesized). The anchor itself may be parenthesized: one
 * closing parenthesis between the anchor and the `+` is part of
 * the matched form. Each hit is pinned to its enclosing
 * function.
 */
function findDeadlineArithmetic(relativeFile: string): DeadlineArithmeticHit[] {
  const source = stripComments(
    fs.readFileSync(path.join(engineSourceDirectory, relativeFile), 'utf8'),
  );
  const pattern =
    /(?<![\w$])(Date\.now\(\))(?=\s*\)?\s*\+)|(?<![\w$])((?:[A-Za-z_$][\w$]*\.)*(?:nowMs|phaseStartAt|now))(?=\s*\)?\s*\+)/g;
  const hits: DeadlineArithmeticHit[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const left = match[1] ?? match[2]!;
    const rest = source.slice(pattern.lastIndex);
    const right = /^\s*\)?\s*\+\s*\(?\s*([A-Za-z_$][\w$]*|\d[\d_]*)/.exec(rest);
    if (right === null) continue;
    let symbol = '<module>';
    for (const declaration of source
      .slice(0, match.index)
      .matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) {
      symbol = declaration[1]!;
    }
    hits.push({ file: relativeFile, symbol, expression: `${left} + ${right[1]!}` });
  }
  return hits;
}

function byPoint(a: DeadlineArithmeticHit, b: DeadlineArithmeticHit): number {
  return `${a.file}\n${a.symbol}\n${a.expression}`.localeCompare(
    `${b.file}\n${b.symbol}\n${b.expression}`,
  );
}

describe('decideSettleCountdownArm truth table (moved from werewolf decideWolfVoteTimerAction)', () => {
  const NOW = 1000000;

  it('pins the shared countdown at 5000ms (the moved WOLF_VOTE_COUNTDOWN_MS value)', () => {
    expect(SETTLE_COUNTDOWN_MS).toBe(5000);
  });

  it('complete + no timer -> set', () => {
    const action = decideSettleCountdownArm({ complete: true, armedDeadlineAt: null, nowMs: NOW });
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadlineAt).toBe(NOW + SETTLE_COUNTDOWN_MS);
    }
  });

  it('complete + has timer -> set (reset)', () => {
    const action = decideSettleCountdownArm({
      complete: true,
      armedDeadlineAt: NOW - 1000,
      nowMs: NOW,
    });
    expect(action.type).toBe('set');
    if (action.type === 'set') {
      expect(action.deadlineAt).toBe(NOW + SETTLE_COUNTDOWN_MS);
    }
  });

  it('!complete + has timer -> clear', () => {
    const action = decideSettleCountdownArm({
      complete: false,
      armedDeadlineAt: NOW - 1000,
      nowMs: NOW,
    });
    expect(action).toEqual({ type: 'clear' });
  });

  it('!complete + no timer -> noop', () => {
    const action = decideSettleCountdownArm({ complete: false, armedDeadlineAt: null, nowMs: NOW });
    expect(action).toEqual({ type: 'noop' });
  });

  it('complete + has timer + content unchanged -> set (strategy A: still reset)', () => {
    // Strategy A: any successful submit resets. Content change is irrelevant.
    const action = decideSettleCountdownArm({
      complete: true,
      armedDeadlineAt: NOW - 1000,
      nowMs: NOW,
    });
    expect(action.type).toBe('set');
  });

  it('countdownMs override replaces the shared default', () => {
    const action = decideSettleCountdownArm({
      complete: true,
      armedDeadlineAt: null,
      nowMs: NOW,
      countdownMs: 1234,
    });
    expect(action).toEqual({ type: 'set', deadlineAt: NOW + 1234 });
  });
});

describe('settle countdown registry', () => {
  it('registers exactly the four ruled access points', () => {
    expect([...ACCESS_POINT_IDS].sort()).toEqual([
      'avalon:quest',
      'avalon:vote',
      'werewolf:sheriff-vote',
      'werewolf:wolf-vote',
    ]);
  });

  it('welds skeleton adoption to the decideSettleCountdownArm call in each host file', () => {
    const hostFiles = [
      ...new Set(ACCESS_POINT_IDS.map((id) => EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].hostFile)),
    ];
    for (const hostFile of hostFiles) {
      const expectedCalls = ACCESS_POINT_IDS.filter(
        (id) =>
          EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].hostFile === hostFile &&
          EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].adoption === 'switched',
      ).length;
      const calls = countOccurrences(readGameFile(hostFile), 'decideSettleCountdownArm(');
      expect(calls).toBe(expectedCalls);
    }
  });

  it('welds the total skeleton call count across all game sources to the switched points', () => {
    const switchedCount = ACCESS_POINT_IDS.filter(
      (id) => EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].adoption === 'switched',
    ).length;
    let totalCalls = 0;
    for (const gameDirectory of fs.readdirSync(gamesDirectory, { withFileTypes: true })) {
      if (!gameDirectory.isDirectory()) continue;
      totalCalls += countOccurrences(
        readSourceTree(path.join(gamesDirectory, gameDirectory.name)),
        'decideSettleCountdownArm(',
      );
    }
    expect(totalCalls).toBe(switchedCount);
  });

  it('welds pending legacy arm fragments to their registered count per host file', () => {
    const pendingMarkers = new Map<string, { hostFile: string; count: number }>();
    for (const id of ACCESS_POINT_IDS) {
      const row = EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id];
      if (row.adoption !== 'pending' || row.legacyArmMarker === undefined) continue;
      const key = `${row.hostFile}\n${row.legacyArmMarker}`;
      const entry = pendingMarkers.get(key) ?? { hostFile: row.hostFile, count: 0 };
      entry.count += 1;
      pendingMarkers.set(key, entry);
    }
    for (const [key, entry] of pendingMarkers) {
      const marker = key.split('\n')[1]!;
      expect(countOccurrences(readGameFile(entry.hostFile), marker)).toBe(entry.count);
    }
  });

  it('confines the avalon legacy settle constant to its registered occurrences', () => {
    // While any avalon point is pending, avalon keeps its legacy
    // constant: one definition + one import + one use per pending
    // point. Once no avalon point is pending the constant is gone.
    // (Doc comments naming the shared SETTLE_COUNTDOWN_MS are not
    // arithmetic and are not counted; the weld targets the legacy
    // constant's full name and any in-game constant definition.)
    const pendingAvalon = ACCESS_POINT_IDS.filter(
      (id) =>
        id.startsWith('avalon:') && EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].adoption === 'pending',
    ).length;
    const expectedAvalonOccurrences = pendingAvalon === 0 ? 0 : 2 + pendingAvalon;
    for (const gameDirectory of fs.readdirSync(gamesDirectory, { withFileTypes: true })) {
      if (!gameDirectory.isDirectory()) continue;
      const source = readSourceTree(path.join(gamesDirectory, gameDirectory.name));
      expect(countOccurrences(source, 'AVALON_SETTLE_COUNTDOWN_SECONDS')).toBe(
        gameDirectory.name === 'avalon' ? expectedAvalonOccurrences : 0,
      );
      const constantDefinitions = source.match(/const \w*SETTLE_COUNTDOWN\w* =/g) ?? [];
      expect(constantDefinitions.length).toBe(
        gameDirectory.name === 'avalon' && pendingAvalon > 0 ? 1 : 0,
      );
    }
  });

  it('welds ruled-pending-deletion manual close surfaces to their presence markers', () => {
    for (const id of ACCESS_POINT_IDS) {
      const manualClose = EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].manualClose;
      if (manualClose.kind !== 'ruledPendingDeletion') continue;
      const source = readGameFile(manualClose.markerFile);
      for (const marker of manualClose.presenceMarkers) {
        expect(source).toContain(marker);
      }
    }
  });

  it('welds the none-manual-close points: werewolf and avalon declare no finish or close command', () => {
    const werewolfCommands = readGameFile('werewolf/commands/types.ts');
    expect(werewolfCommands).not.toContain('finish');
    expect(werewolfCommands).not.toContain('close');
    const avalonCommands = readGameFile('avalon/commands/types.ts');
    expect(avalonCommands).not.toContain('finish');
    expect(avalonCommands).not.toContain('close');
  });

  it('welds the relay baseline: last ready settles immediately with a null deadline', () => {
    const relayTasks = fs.readFileSync(relayTasksPath, 'utf8');
    expect(relayTasks).toContain("phaseChanged('settling', null");
    expect(relayTasks).not.toContain('decideSettleCountdownArm');
    expect(relayTasks).not.toContain('SETTLE_COUNTDOWN');
  });

  it('welds the werewolf inline baseline: AUTO_SKIP stays the out-of-domain stepDeadline writer', () => {
    const inlineProgression = readGameFile('werewolf/domain/inlineProgression.ts');
    expect(inlineProgression).toContain('AUTO_SKIP_DELAY_MIN_MS');
    expect(inlineProgression).not.toContain('decideSettleCountdownArm');
  });
});

describe('deadline arithmetic weld (bidirectional)', () => {
  it('registers exact points only: one file, one function, one expression per entry', () => {
    for (const entry of EXPECTED_DEADLINE_ARITHMETIC) {
      expect(entry.file.endsWith('.ts')).toBe(true);
      expect(entry.file).not.toContain('*');
      expect(entry.symbol.length).toBeGreaterThan(0);
      expect(entry.symbol).not.toContain('*');
      expect(entry.expression).toContain(' + ');
    }
  });

  it('confines every now-anchored deadline addition to the registered points', () => {
    const actual = listProductionSourceFiles(engineSourceDirectory)
      .flatMap((file) => findDeadlineArithmetic(file))
      .sort(byPoint);
    const expected = EXPECTED_DEADLINE_ARITHMETIC.map(({ file, symbol, expression }) => ({
      file,
      symbol,
      expression,
    })).sort(byPoint);
    expect(actual).toEqual(expected);
  });

  it('keeps the pending avalon arithmetic points in step with the adopter registry', () => {
    const pendingAvalonPoints = ACCESS_POINT_IDS.filter(
      (id) =>
        id.startsWith('avalon:') &&
        EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].adoption === 'pending' &&
        EXPECTED_SETTLE_COUNTDOWN_ADOPTERS[id].legacyArmMarker !== undefined,
    ).length;
    const registered = EXPECTED_DEADLINE_ARITHMETIC.filter(
      (entry) => entry.domain === 'avalonPending',
    ).length;
    expect(registered).toBe(pendingAvalonPoints);
    expect(
      EXPECTED_DEADLINE_ARITHMETIC.filter((entry) => entry.domain === 'skeleton'),
    ).toHaveLength(1);
  });
});
