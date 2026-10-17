/**
 * Mock VM × real VM cross-check (AU-39 follow-up).
 *
 * buildMockWerewolfViewModel (boardTestUtils) re-derives the projection
 * with local rules for the board UI suites, while production reads
 * getWerewolfViewModel from the engine. This suite feeds ONE scenario
 * through both builders and pins agreement on the fields the seat board
 * actually consumes from the view model (werewolfRoom.helpers reads
 * seats[].isWolfPackPeer, seats[].hasViewedRole and
 * night.wolfVotesBySeat; wolfPackSeats / viewedSeats are the same facts
 * in list form, night.stepSchemaKind gates the board's step rendering).
 *
 * Deliberately NOT compared: displayName / isBot / visibleRole. The seat
 * board takes names and bot flags from gameState players, not the view
 * model, and visibleRole differs by design (the mock never names a role;
 * the real VM names only the viewer's own seat).
 */

import {
  buildNightPlan,
  type CurrentNightResults,
  type GameState,
  GameStatus,
  getSchema,
  getWerewolfViewModel,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import type { LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { buildMockWerewolfViewModel } from '../harness/boardTestUtils';

const ROLES: readonly RoleId[] = [
  'wolf',
  'wolf',
  'seer',
  'witch',
  'villager',
  'wolf',
  'villager',
  'villager',
];
const BOT_SEAT = 5;
const UNVIEWED_SEAT = 6;
const CURRENT_NIGHT_RESULTS: CurrentNightResults = {
  wolfVotesBySeat: { '0': 4, '1': 4, '5': 2 },
};

function buildEngineState(): GameState {
  const players: Record<number, { seat: number; hasViewedRole: boolean; role: RoleId } | null> = {};
  const roster: Record<number, { seat: number; userId: string } | { seat: number; kind: 'bot' }> =
    {};
  const playerProfiles: Record<string, { displayName: string }> = {};
  ROLES.forEach((role, seat) => {
    players[seat] = { seat, hasViewedRole: seat !== UNVIEWED_SEAT, role };
    roster[seat] = seat === BOT_SEAT ? { seat, kind: 'bot' } : { seat, userId: `p${seat}` };
    playerProfiles[`p${seat}`] = { displayName: `P${seat + 1}` };
  });
  const plan = buildNightPlan(ROLES);
  const stepIndex = plan.steps.findIndex((step) => step.stepId === 'wolfKill');
  if (stepIndex < 0) throw new Error('wolfKill step missing from the night plan');
  return buildWerewolfTestState({
    status: GameStatus.Ongoing,
    templateRoles: [...ROLES],
    currentStepIndex: stepIndex,
    players,
    roster,
    playerProfiles,
    currentNightResults: CURRENT_NIGHT_RESULTS,
  });
}

function buildMockPlayers(): ReadonlyMap<number, LocalPlayer> {
  return new Map(
    ROLES.map((role, seat): [number, LocalPlayer] => [
      seat,
      {
        userId: `p${seat}`,
        seat,
        displayName: `P${seat + 1}`,
        role,
        hasViewedRole: seat !== UNVIEWED_SEAT,
        isBot: seat === BOT_SEAT,
      },
    ]),
  );
}

/** The seat-board consumption surface of a view model, in seat order. */
function seatBoardSurface(viewModel: ReturnType<typeof getWerewolfViewModel>) {
  return {
    seats: viewModel.seats.map((seatView) => ({
      seat: seatView.seat,
      isWolfPackPeer: seatView.isWolfPackPeer,
      hasViewedRole: seatView.hasViewedRole,
    })),
    wolfPackSeats: viewModel.wolfPackSeats,
    viewedSeats: viewModel.viewedSeats,
    wolfVotesBySeat: viewModel.night.wolfVotesBySeat,
    stepSchemaKind: viewModel.night.stepSchemaKind,
  };
}

describe('buildMockWerewolfViewModel × getWerewolfViewModel cross-check', () => {
  it('agrees on the seat-board surface for a wolf viewer at the wolf step', () => {
    const real = getWerewolfViewModel(buildEngineState(), 0);
    const mock = buildMockWerewolfViewModel({
      mySeat: 0,
      myRole: 'wolf',
      currentActionRole: 'wolf',
      currentSchema: getSchema('wolfKill'),
      players: buildMockPlayers(),
      wolfVotes: new Map(),
      actions: new Map(),
      currentNightResults: CURRENT_NIGHT_RESULTS,
    });
    expect(seatBoardSurface(mock)).toEqual(seatBoardSurface(real));
    // Scenario sanity: the wolf meeting is live for this viewer, so the
    // compared fields are exercised, not all-default.
    expect(real.wolfPackSeats).toEqual([0, 1, 5]);
    expect(real.viewedSeats).toEqual([0, 1, 2, 3, 4, 5, 7]);
  });

  it('agrees on the seat-board surface for a seer viewer who cannot see the pack', () => {
    const real = getWerewolfViewModel(buildEngineState(), 2);
    const mock = buildMockWerewolfViewModel({
      mySeat: 2,
      myRole: 'seer',
      currentActionRole: 'wolf',
      currentSchema: getSchema('wolfKill'),
      players: buildMockPlayers(),
      wolfVotes: new Map(),
      actions: new Map(),
      currentNightResults: CURRENT_NIGHT_RESULTS,
    });
    expect(seatBoardSurface(mock)).toEqual(seatBoardSurface(real));
    expect(real.wolfPackSeats).toBeNull();
    expect(real.night.wolfVotesBySeat).toBeNull();
  });
});
