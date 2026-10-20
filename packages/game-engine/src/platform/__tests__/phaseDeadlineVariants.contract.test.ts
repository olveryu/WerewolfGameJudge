/**
 * Phase Deadline variants registry (E-2): the value table below is
 * the one registration of how each game assembles the shared phase
 * expiry guard (`platform/room/phaseDeadline.ts`). The guard's four
 * assembly dimensions are orthogonal — actor channel, revision
 * policy, settle pinning, late-submission policy — and every game's
 * row names its value on each. Changing a game's assembly means
 * updating its row here in the same change.
 *
 * Adoption is registered per game alongside the variant:
 * - 'switched': the game's engine expiry path calls
 *   `guardPhaseExpiry` (welded below against the game's engine
 *   source marker), and its `phaseDeadlineProtocol.contract.test.ts`
 *   runs the shared scenarios.
 * - 'pending': the variant is the verified target shape, but the
 *   game still assembles its own gate; its switching PR flips the
 *   row and lights the weld. A pending game must not call the
 *   guard yet (the weld is bidirectional, like the capabilities
 *   contract), so an unregistered early adoption fails here.
 * - 'outOfDomain': the game has no phase-level deadline domain.
 *   werewolf: its deadline is a night-step deadline inside the
 *   nightStep discriminated union, dispatched inline by
 *   inlineProgression and coupled to audio acknowledgement — a
 *   different domain, registered here as `nightStepInline` and
 *   never adopted into this chassis. fibking and undercover declare
 *   `stageDeadline: false` in the capabilities table (their phases
 *   advance on submissions, not clocks); the rows here mirror that
 *   declaration.
 *
 * The scenario-suite weld follows the capabilities contract's
 * identityViewing weld: a switched game has its protocol contract
 * file; a game without one must not be marked switched.
 *
 * Client trigger registration (verified 2026-10-20): the four
 * games with a public expire command (avalon, drawguess, pictionary,
 * storyrelay) submit it automatically — the shared
 * `useStageDeadline` hook fires it when the countdown reaches zero,
 * from any foreground client, behind snapshot guards (live
 * connection, no pending command, unchanged phase revision). It is
 * never a host button. For avalon the command is only an
 * acceleration path; correctness rides on the scheduled settle.due
 * delivery. demo has no client expire surface at all.
 *
 * Werewolf's two client countdown hooks are not two
 * implementations of this domain (verified 2026-10-20):
 * `useStageDeadline` is the any-foreground-client expiry notifier
 * above, while `useStepDeadlineCountdown` is a host-only night-step
 * progression driver — only the host submits progression, it
 * retries every tick until the step lands, and it is coupled to
 * the engine's audio acknowledgement. Different duties, kept
 * separate on purpose (also registered in the useStageDeadline
 * header); this registry records the distinction and changes
 * neither hook.
 */

import fs from 'node:fs';
import path from 'node:path';

import { GAME_TYPES, type GameType } from '../protocol/gameTypes';

const gamesDirectory = path.resolve(__dirname, '..', '..', 'games');
const apiWorkerGamesDirectory = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'api-worker',
  'src',
  'games',
);

type PhaseDeadlineActorChannel =
  | 'uncontrolledUser'
  | 'uncontrolledUser+actorGate'
  | 'dualChannel'
  | 'systemOnly';

type PhaseDeadlineRevisionPolicy =
  | 'none'
  | 'guardSingleSilent'
  | 'guardSingleReject'
  | 'entryReject'
  | 'guardDualReject';

type PhaseDeadlineSettlePin = 'none' | 'sequence+deadline' | 'sequence+phase+round+deadline';

type PhaseDeadlineLateSubmission = 'sharedRelayTask' | 'gameGuard' | 'noneByDesign' | 'noSurface';

interface PhaseDeadlineVariant {
  readonly actorChannel: PhaseDeadlineActorChannel;
  readonly revisionPolicy: PhaseDeadlineRevisionPolicy;
  readonly settlePin: PhaseDeadlineSettlePin;
  readonly lateSubmission: PhaseDeadlineLateSubmission;
}

type PhaseDeadlineRow =
  | {
      readonly adoption: 'switched' | 'pending';
      readonly variant: PhaseDeadlineVariant;
    }
  | {
      readonly adoption: 'outOfDomain';
      /** Why this game has no phase-deadline row: see the file header. */
      readonly domain: 'nightStepInline' | 'noStageDeadline';
    };

/** Registered phase-deadline assembly per game. */
const EXPECTED_PHASE_DEADLINE_VARIANTS: Readonly<Record<GameType, PhaseDeadlineRow>> = {
  werewolf: { adoption: 'outOfDomain', domain: 'nightStepInline' },
  fibking: { adoption: 'outOfDomain', domain: 'noStageDeadline' },
  pictionary: {
    adoption: 'switched',
    variant: {
      actorChannel: 'uncontrolledUser+actorGate',
      revisionPolicy: 'guardSingleSilent',
      settlePin: 'none',
      lateSubmission: 'sharedRelayTask',
    },
  },
  undercover: { adoption: 'outOfDomain', domain: 'noStageDeadline' },
  storyrelay: {
    adoption: 'switched',
    variant: {
      actorChannel: 'uncontrolledUser',
      revisionPolicy: 'entryReject',
      settlePin: 'none',
      lateSubmission: 'sharedRelayTask',
    },
  },
  drawguess: {
    adoption: 'pending',
    variant: {
      actorChannel: 'uncontrolledUser',
      revisionPolicy: 'guardDualReject',
      settlePin: 'none',
      lateSubmission: 'gameGuard',
    },
  },
  avalon: {
    adoption: 'pending',
    variant: {
      actorChannel: 'dualChannel',
      revisionPolicy: 'none',
      settlePin: 'sequence+phase+round+deadline',
      lateSubmission: 'noneByDesign',
    },
  },
  demo: {
    adoption: 'pending',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'sequence+deadline',
      lateSubmission: 'noSurface',
    },
  },
};

/** Concatenated non-test source of one directory tree (engine or worker side). */
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

describe('phase deadline variants registry', () => {
  it('registers every game exactly once', () => {
    expect(Object.keys(EXPECTED_PHASE_DEADLINE_VARIANTS).sort()).toEqual([...GAME_TYPES].sort());
  });

  it('welds guard adoption to the guardPhaseExpiry call in each game engine', () => {
    for (const gameType of GAME_TYPES) {
      const row = EXPECTED_PHASE_DEADLINE_VARIANTS[gameType];
      const wired = readSourceTree(path.join(gamesDirectory, gameType)).includes(
        'guardPhaseExpiry',
      );
      expect(wired).toBe(row.adoption === 'switched');
    }
  });

  it('welds the shared scenario suite to exactly the switched games', () => {
    for (const gameType of GAME_TYPES) {
      const row = EXPECTED_PHASE_DEADLINE_VARIANTS[gameType];
      const suiteExists = fs.existsSync(
        path.join(gamesDirectory, gameType, '__tests__', 'phaseDeadlineProtocol.contract.test.ts'),
      );
      expect(suiteExists).toBe(row.adoption === 'switched');
    }
  });

  it('welds settle handler adoption to the worker settleDue helper call', () => {
    for (const gameType of GAME_TYPES) {
      const row = EXPECTED_PHASE_DEADLINE_VARIANTS[gameType];
      if (row.adoption === 'outOfDomain' || row.variant.settlePin === 'none') continue;
      const wired = readSourceTree(path.join(apiWorkerGamesDirectory, gameType)).includes(
        'createSettleDueHandler',
      );
      expect(wired).toBe(row.adoption === 'switched');
    }
  });
});
