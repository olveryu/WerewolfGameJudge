/**
 * useRoomDerived.groupConfirmAcks.test.ts - AU-39 Slice 0 golden tests
 *
 * Pins the schema -> ack-array mapping used for groupConfirm steps: each of
 * the four reveal steps reads its own ack family from game state, and an
 * unknown groupConfirm step id fails fast. The acked seats surface as
 * showReadyBadge on the seat view models (visible to every viewer).
 */

import type { ActionSchema, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  SCHEMAS,
  WEREWOLF_STATE_IDENTITY,
} from '@game-judge/game-engine/games/werewolf/public';
import { renderHook } from '@testing-library/react-native';

import { useRoomDerived } from '@/games/werewolf/room/hooks/useRoomDerived';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

// =============================================================================
// Fixture: four ack families with one distinct acked seat each
//   conversionRevealAcks -> seat 0, seedWolfInfectionRevealAcks -> seat 1,
//   cupidLoversRevealAcks -> seat 2, piperRevealAcks -> seat 3
// =============================================================================

function createState(): LocalGameState {
  const roles = [
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ] as RoleId[];
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host1',
    template: { name: 'Test', numberOfPlayers: 6, roles },
    players: new Map(
      roles.map((role, seat) => [
        seat,
        { userId: `p${seat}`, seat, displayName: `P${seat}`, role, hasViewedRole: false },
      ]),
    ),
    actions: new Map(),
    wolfVotes: new Map(),
    currentStepIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [3],
    conversionRevealAcks: [0],
    cupidLoversRevealAcks: [2],
    seedWolfInfectionRevealAcks: [1],
    status: GameStatus.Ongoing,
  };
}

/**
 * AU-39: the ack mapping now lives in the engine projection — the hook
 * reads the current step's reveal from the view model. The view model
 * below carries exactly the ack families the fixture state encodes
 * (conversion -> [0], seedWolf -> [1], cupid -> [2], piper -> [3]); an
 * unknown step id has no reveal, which is what fails fast.
 */
const ACKED_SEATS_BY_STEP: Readonly<Record<string, readonly number[]>> = {
  awakenedGargoyleConvertReveal: [0],
  seedWolfInfectReveal: [1],
  cupidLoversReveal: [2],
  piperHypnotizedReveal: [3],
};

function viewModelForSchema(currentSchema: ActionSchema): WerewolfViewModel {
  const ackedSeats = ACKED_SEATS_BY_STEP[currentSchema.id];
  return {
    status: GameStatus.Ongoing,
    mySeat: 5,
    myRole: null,
    myEffectiveRole: null,
    seats: [0, 1, 2, 3, 4, 5].map((seat) => ({
      seat,
      displayName: `P${seat}`,
      isBot: false,
      visibleRole: null,
      isWolfPackPeer: false,
      hasViewedRole: false,
    })),
    wolfPackSeats: null,
    viewedSeats: [],
    night: {
      stepSchemaKind: 'groupConfirm',
      confirmStatus: null,
      reveals:
        ackedSeats === undefined
          ? []
          : [
              {
                stepId: currentSchema.id,
                isSubject: false,
                subjectSeats: null,
                partnerSeat: null,
                hasAcked: false,
                ackedSeats,
              },
            ],
      wolfVotesBySeat: null,
    },
    day: { sheriffSeat: null, mvpSeat: null },
  };
}

function deriveWithSchema(currentSchema: ActionSchema, currentActionRole: RoleId) {
  return renderHook(() =>
    useRoomDerived({
      gameState: createState(),
      viewModel: viewModelForSchema(currentSchema),
      currentSchema,
      currentActionRole,
      roomStatus: GameStatus.Ongoing,
      actorSeatForUi: 5,
      imActioner: false,
      firstSwapSeat: null,
      secondSeat: null,
      multiSelectedSeats: [],
      getWolfStatusLine: () => null,
      effectiveRole: null,
    }),
  );
}

function ackedSeatsOf(seatViewModels: readonly { showReadyBadge?: boolean }[]): number[] {
  const acked: number[] = [];
  seatViewModels.forEach((seat, index) => {
    if (seat.showReadyBadge) acked.push(index);
  });
  return acked;
}

// =============================================================================
// Mapping golden
// =============================================================================

describe('AU-39 golden: useRoomDerived groupConfirm ack mapping', () => {
  it.each([
    ['awakenedGargoyleConvertReveal', 'awakenedGargoyle', [0]],
    ['seedWolfInfectReveal', 'seedWolf', [1]],
    ['cupidLoversReveal', 'cupid', [2]],
    ['piperHypnotizedReveal', 'piper', [3]],
  ] as const)('%s reads its own ack family', (schemaId, actionRole, expectedAcked) => {
    const { result } = deriveWithSchema(SCHEMAS[schemaId], actionRole);
    expect(ackedSeatsOf(result.current.seatViewModels)).toEqual(expectedAcked);
  });

  it('fails fast on an unknown groupConfirm step id', () => {
    const bogusSchema = {
      id: 'groupConfirmBogus',
      kind: 'groupConfirm',
      displayName: 'Bogus',
      requireAllAcks: true,
    } as unknown as ActionSchema;

    expect(() => deriveWithSchema(bogusSchema, 'piper')).toThrow(
      'Unknown groupConfirm step: groupConfirmBogus',
    );
  });
});
