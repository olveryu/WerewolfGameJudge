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
 *   that PR flips the row: avalon's two in-engine arm fragments,
 *   sheriff's not-yet-existing arm (a net-new carrier, PR-2b).
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
 * that deletes one flips its row to 'deleted' in the same change.
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
 * Weld scan scope is the game-engine game sources only. The
 * avalon client's `settleCountdownSeconds` display field (root
 * `src/`) is a presentation value, not an arm site, and is out
 * of scope by construction.
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
    adoption: 'pending',
    landingPr: 'E-3 PR-2b',
    hostFile: 'werewolf/domain/handlers/sheriffElectionHandler.ts',
    // Sheriff ballots are append-only (cast or overwritten, never
    // removed), so completion is monotonic and clear is
    // structurally unreachable at this point.
    clear: 'unreachable-ballotsAppendOnly',
    manualClose: {
      kind: 'ruledPendingDeletion',
      markerFile: 'werewolf/domain/handlers/sheriffElectionHandler.ts',
      // The host advance command still closes both vote phases.
      presenceMarkers: ['closeFirstVote(context.state, election)', 'closeRunoffVote(election)'],
      deletion: 'E-3 PR-2b removes the advance vote-phase close branch',
    },
  },
  'avalon:vote': {
    adoption: 'pending',
    landingPr: 'E-3 PR-2',
    hostFile: 'avalon/engine.ts',
    // Avalon ballots can be overwritten but never retracted, so
    // completion is monotonic and clear is unreachable.
    clear: 'unreachable-submissionIrrevocable',
    legacyArmMarker: 'AVALON_SETTLE_COUNTDOWN_SECONDS * 1000',
    manualClose: {
      kind: 'ruledPendingDeletion',
      markerFile: 'avalon/commands/types.ts',
      presenceMarkers: ["'avalon.vote.finish'"],
      deletion: 'independent avalon finish deletion (not an E-3 PR)',
    },
  },
  'avalon:quest': {
    adoption: 'pending',
    landingPr: 'E-3 PR-2',
    hostFile: 'avalon/engine.ts',
    // Quest plays can be overwritten but never retracted, so
    // completion is monotonic and clear is unreachable.
    clear: 'unreachable-submissionIrrevocable',
    legacyArmMarker: 'AVALON_SETTLE_COUNTDOWN_SECONDS * 1000',
    manualClose: {
      kind: 'ruledPendingDeletion',
      markerFile: 'avalon/commands/types.ts',
      presenceMarkers: ["'avalon.quest.finish'"],
      deletion: 'independent avalon finish deletion (not an E-3 PR)',
    },
  },
};

const ACCESS_POINT_IDS = Object.keys(
  EXPECTED_SETTLE_COUNTDOWN_ADOPTERS,
) as SettleCountdownAccessPointId[];

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

  it('welds the none-manual-close point: werewolf declares no finish or close command', () => {
    const werewolfCommands = readGameFile('werewolf/commands/types.ts');
    expect(werewolfCommands).not.toContain('finish');
    expect(werewolfCommands).not.toContain('close');
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
