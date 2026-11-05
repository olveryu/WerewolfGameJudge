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
 *   fibking and undercover declare `stageDeadline: false` in the
 *   capabilities table (their phases advance on submissions, not
 *   clocks); the rows here mirror that declaration.
 *
 * Werewolf (switched by the game-client convergence, see
 * `docs/game-client-convergence-design.md` §6.2) settles on the
 * system channel only, like every other stage-deadline game (D3,
 * 2026-11-05 — the public expire command was deleted in all five
 * games). Its deadline carriers are the night step's `stepDeadline`
 * and a sheriff voting round's `deadline`; the pin is (game
 * sequence, phase, deadline) where phase is the step id or the
 * voting round — werewolf is night-1 only, so there is no round
 * field. Dispatch is the ordinary inline progression pass, which
 * keeps the audio-ack gate in front of every night transition.
 *
 * The scenario-suite weld follows the capabilities contract's
 * identityViewing weld: a switched game has its protocol contract
 * file; a game without one must not be marked switched.
 *
 * Client trigger registration: no game has a public expire
 * command (D3, 2026-11-05). No client sends expiry — the shared
 * `useStageDeadline` hook is a display-only countdown; the
 * scheduled settle.due delivery is the only channel, and
 * correctness rides on it. demo has no client expire surface
 * at all, as before.
 *
 * Cross-reference to the E-3 registry
 * (`platform/room/__tests__/settleCountdown.contract.test.ts`):
 * the `deadlineAt` the avalon and werewolf rows pin through their
 * settlePin is produced by the E-3 skeleton arm
 * (`decideSettleCountdownArm`), not by an assembly dimension
 * here (werewolf's vacant bottom-card auto-skip arm is the one
 * pinned deadline that the E-3 registry lists as a non-skeleton
 * writer).
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

/**
 * The actor channel of the expiry path. Since D3 (2026-11-05) every
 * stage-deadline game settles on the system channel only — there is
 * no public expire command anywhere — so this dimension has a
 * single value.
 */
type PhaseDeadlineActorChannel = 'systemOnly';

type PhaseDeadlineRevisionPolicy = 'none';

type PhaseDeadlineSettlePin =
  | 'none'
  | 'sequence+deadline'
  | 'sequence+phase+deadline'
  | 'sequence+phase+round+deadline'
  | 'round+revision+deadline'
  | 'sequence+revision+turn+deadline';

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
      readonly domain: 'noStageDeadline';
    };

/** Registered phase-deadline assembly per game. */
const EXPECTED_PHASE_DEADLINE_VARIANTS: Readonly<Record<GameType, PhaseDeadlineRow>> = {
  werewolf: {
    adoption: 'switched',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'sequence+phase+deadline',
      lateSubmission: 'noneByDesign',
    },
  },
  fibking: { adoption: 'outOfDomain', domain: 'noStageDeadline' },
  pictionary: {
    adoption: 'switched',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'round+revision+deadline',
      lateSubmission: 'sharedRelayTask',
    },
  },
  undercover: { adoption: 'outOfDomain', domain: 'noStageDeadline' },
  storyrelay: {
    adoption: 'switched',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'round+revision+deadline',
      lateSubmission: 'sharedRelayTask',
    },
  },
  drawguess: {
    adoption: 'switched',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'sequence+revision+turn+deadline',
      lateSubmission: 'gameGuard',
    },
  },
  avalon: {
    adoption: 'switched',
    variant: {
      actorChannel: 'systemOnly',
      revisionPolicy: 'none',
      settlePin: 'sequence+phase+round+deadline',
      lateSubmission: 'noneByDesign',
    },
  },
  demo: {
    adoption: 'switched',
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
