import { withTestNightState } from '../../../__tests__/nightStateFixture';
import { GameStatus } from '../../models';
import type { GameState } from '../../protocol/types';
import { assertWerewolfStateInvariants } from '../assertStateInvariants';

function createTreasureMasterState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    gameType: 'werewolf',
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Assigned,
    templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager'],
    players: {
      0: {
        seat: 0,
        role: 'treasureMaster',
      },
    },
    roleViewedSeats: [],
    roster: { 0: { seat: 0, userId: 'host', profile: { displayName: 'host' } } },
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    bottomCards: ['wolf', 'seer', 'villager'],
    ...overrides,
  };
  return state.status === GameStatus.Ongoing ? withTestNightState(state) : state;
}

function createThiefState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    ...createTreasureMasterState(),
    templateRoles: ['thief', 'wolf', 'seer'],
    players: {
      0: { seat: 0, role: 'thief' },
    },
    bottomCards: ['wolf', 'seer'],
    ...overrides,
  };
  return state.status === GameStatus.Ongoing ? withTestNightState(state) : state;
}

function createSheriffElectionState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    gameType: 'werewolf',
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Day,
    templateRoles: ['wolf', 'seer', 'hunter', 'villager'],
    rules: { isSheriffElectionEnabled: true },
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'seer' },
      2: { seat: 2, role: 'hunter' },
      3: { seat: 3, role: 'villager' },
    },
    roleViewedSeats: [],
    roster: {
      0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
      1: { seat: 1, userId: 'p1', profile: { displayName: 'p1' } },
      2: { seat: 2, userId: 'p2', profile: { displayName: 'p2' } },
      3: { seat: 3, userId: 'p3', profile: { displayName: 'p3' } },
    },
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    sheriffElection: {
      phase: 'firstVote',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      candidateSeats: [0, 1],
      eligibleVoterSeats: [2, 3],
      ballots: { 2: 0 },
    },
    ...overrides,
  };
  return state.status === GameStatus.Day || state.status === GameStatus.Ended
    ? withTestNightState(state)
    : state;
}

/**
 * An Ongoing state on the first plan step of the sheriff fixture's board
 * (plan: wolfKill, hunterConfirm, seerCheck — length 3).
 */
function createOngoingState(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = {
    ...createSheriffElectionState(),
    status: GameStatus.Ongoing,
    sheriffElection: undefined,
    sheriffElectionResult: undefined,
    ...overrides,
  };
  if (state.status === GameStatus.Ongoing) return withTestNightState(state);
  return state.status === GameStatus.Day || state.status === GameStatus.Ended
    ? state
    : { ...state, nightState: null };
}

describe('assertWerewolfStateInvariants', () => {
  it('accepts canonical assigned and ongoing bottom-card states', () => {
    expect(() => assertWerewolfStateInvariants(createTreasureMasterState())).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          status: GameStatus.Ongoing,
        }),
      ),
    ).not.toThrow();
  });

  /** The day after a night in which the Seed Wolf converted the seer at seat 2. */
  const convertedSeerState = (): GameState => {
    const settled = createSheriffElectionState({
      templateRoles: ['seedWolf', 'wolf', 'seer', 'villager'],
      players: {
        0: { seat: 0, role: 'seedWolf' },
        1: { seat: 1, role: 'wolf' },
        2: { seat: 2, role: 'seer' },
        3: { seat: 3, role: 'villager' },
      },
    });
    const night = settled.nightState!;
    return {
      ...settled,
      players: { ...settled.players, 2: { seat: 2, role: 'wolf' } },
      nightState: {
        ...night,
        roles: {
          ...night.roles,
          identities: {
            ...night.roles.identities,
            2: { ...night.roles.identities[2]!, currentRole: 'wolf' },
          },
        },
        conversion: { outcome: 'converted', targetSeat: 2 },
      },
    };
  };

  it('accepts one dealt role converted by the board’s converting role', () => {
    expect(() => assertWerewolfStateInvariants(convertedSeerState())).not.toThrow();
  });

  it('rejects a converted seat that does not hold the role it was converted into', () => {
    const converted = convertedSeerState();
    expect(() =>
      assertWerewolfStateInvariants({
        ...converted,
        players: { ...converted.players, 2: { seat: 2, role: 'seer' } },
      }),
    ).toThrow('night seat 2 disagrees with its dealt identity');
  });

  it('requires a legal deck after assignment', () => {
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ bottomCards: undefined })),
    ).toThrow('deal has no bottomCards');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({ bottomCards: ['wolf', 'seer', 'witch'] }),
      ),
    ).toThrow('bottomCards violate the canonical deck rules');
  });

  it('requires assigned identities and bottom cards to reconstruct the deal pool', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager', 'witch'],
          players: {
            0: {
              seat: 0,
              role: 'treasureMaster',
            },
            1: { seat: 1, role: 'seer' },
          },
          roster: {
            0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
            1: { seat: 1, userId: 'p1', profile: { displayName: 'p1' } },
          },
        }),
      ),
    ).toThrow('assigned roles and bottomCards do not match the role deal pool at seer');
  });

  it('removes treasure-master runtime state in plague mode but keeps thief deals valid', () => {
    const plagueTreasureMasterState = createTreasureMasterState({
      rules: { isPlagueMode: true },
      players: {
        0: { seat: 0, role: 'villager' },
      },
      bottomCards: undefined,
    });
    expect(() => assertWerewolfStateInvariants(plagueTreasureMasterState)).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ rules: { isPlagueMode: true } })),
    ).toThrow('bottomCards exist without an active bottom-card deal');

    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          rules: { isPlagueMode: true },
          bottomCards: ['villager', 'seer'],
        }),
      ),
    ).not.toThrow();
  });

  it('accepts an active sheriff election and rejects lifecycle mismatches', () => {
    expect(() => assertWerewolfStateInvariants(createSheriffElectionState())).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(createSheriffElectionState({ status: GameStatus.Ended })),
    ).toThrow('Ended state contains active sheriff election');
    expect(() =>
      assertWerewolfStateInvariants(createSheriffElectionState({ sheriffElection: undefined })),
    ).toThrow('Day state has no sheriffElection');
  });

  it('rejects withdrawal history before registration closes', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [0],
            withdrawnSeats: [0],
            completedRounds: [],
          },
        }),
      ),
    ).toThrow('registration contains withdrawn sheriff candidates');
  });

  it('requires the sheriff speaking start to identify a candidate in that round', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'runoffSpeech',
            registeredSeats: [0, 1, 2],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [0, 2],
            speakingStartSeat: 2,
            speakingDirection: 'counterclockwise',
          },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'candidateSpeech',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
            speakingStartSeat: 2,
            speakingDirection: 'clockwise',
          },
        }),
      ),
    ).toThrow('candidate speech starts from unregistered seat 2');
  });

  it('rejects active ballots from ineligible voters or for non-candidates', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [0, 1],
            eligibleVoterSeats: [2, 3],
            ballots: { 0: 1 },
          },
        }),
      ),
    ).toThrow('ballot from ineligible voter 0');
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [0, 1],
            eligibleVoterSeats: [2, 3],
            ballots: { 2: 3 },
          },
        }),
      ),
    ).toThrow('targets non-candidate 3');
  });

  it('rejects an armed voting deadline while an eligible ballot is missing', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [0, 1],
            eligibleVoterSeats: [2, 3],
            ballots: { 2: 0 },
            deadline: 6000,
          },
        }),
      ),
    ).toThrow("deadline is armed without voter 3's ballot");
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [0, 1],
            eligibleVoterSeats: [2, 3],
            ballots: { 2: 0, 3: 1 },
            deadline: 6000,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('requires phase-specific eligible voters after a candidate withdraws', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [0, 1],
            withdrawnSeats: [1],
            completedRounds: [],
            candidateSeats: [0],
            eligibleVoterSeats: [1, 2, 3],
            ballots: {},
          },
        }),
      ),
    ).toThrow('firstVote eligible voters do not match the expected seat set');
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          sheriffElection: {
            phase: 'runoffVote',
            registeredSeats: [0, 1, 2],
            withdrawnSeats: [1],
            completedRounds: [],
            candidateSeats: [0, 2],
            eligibleVoterSeats: [3],
            ballots: {},
          },
        }),
      ),
    ).toThrow('runoffVote eligible voters do not match the expected seat set');
  });

  it('rejects closed rounds whose eligible voters violate the phase rule', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          status: GameStatus.Ended,
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [0, 1],
            withdrawnSeats: [1],
            completedRounds: [
              {
                round: 'first',
                candidateSeats: [0],
                eligibleVoterSeats: [1, 2, 3],
                ballots: { 1: 0, 2: 0, 3: 0 },
                voteCounts: { 0: 3 },
                abstainingSeats: [],
              },
            ],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
        }),
      ),
    ).toThrow('first round eligible voters do not match the expected seat set');
  });

  it('recomputes closed-round vote counts at the state boundary', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          status: GameStatus.Ended,
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [0, 1],
            withdrawnSeats: [],
            completedRounds: [
              {
                round: 'first',
                candidateSeats: [0, 1],
                eligibleVoterSeats: [2, 3],
                ballots: { 2: 0, 3: null },
                voteCounts: { 0: 2, 1: 0 },
                abstainingSeats: [3],
              },
            ],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
        }),
      ),
    ).toThrow('vote count is incorrect for candidate 0');
  });

  it('rejects roster/players misalignment in both directions', () => {
    expect(() => assertWerewolfStateInvariants(createTreasureMasterState({ roster: {} }))).toThrow(
      'player record at seat 0 has no roster occupant',
    );
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          roster: {
            0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
            1: { seat: 1, userId: 'p1', profile: { displayName: 'p1' } },
          },
        }),
      ),
    ).toThrow('outside the 1-seat players map');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          players: { 0: { seat: 0, role: 'treasureMaster' }, 1: null },
          roster: {
            0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
            1: { seat: 1, userId: 'p1', profile: { displayName: 'p1' } },
          },
        }),
      ),
    ).toThrow('roster occupant at seat 1 has no player record');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          roster: {
            0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
            1: { seat: 0, userId: 'p1', profile: { displayName: 'p1' } },
          },
          players: {
            0: { seat: 0, role: 'treasureMaster' },
            1: { seat: 1, role: null },
          },
        }),
      ),
    ).toThrow('roster occupant at seat 1 stores seat 0');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          roster: {
            0: { seat: 0, userId: 'host', profile: { displayName: 'host' } },
            1: { seat: 1, userId: 'host', profile: { displayName: 'host' } },
          },
          players: {
            0: { seat: 0, role: 'treasureMaster' },
            1: { seat: 1, role: null },
          },
        }),
      ),
    ).toThrow('roster userId host occupies more than one seat');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          roster: { 0: null } as unknown as GameState['roster'],
        }),
      ),
    ).toThrow('roster seat 0 holds an empty occupant');
  });

  describe('night window', () => {
    /** The sheriff fixture's night, parked where the test asks. */
    const parkedOn = (stepId: string, deadlineMs?: number): GameState =>
      withTestNightState(
        { ...createOngoingState(), nightState: null },
        deadlineMs === undefined ? { stepId } : { stepId, deadlineMs },
      );

    it('accepts a running night parked on any of its steps, with or without a deadline', () => {
      expect(() => assertWerewolfStateInvariants(parkedOn('wolfKill', 1_000))).not.toThrow();
      expect(() => assertWerewolfStateInvariants(parkedOn('seerCheck'))).not.toThrow();
    });

    it('accepts a running night that is past its last step', () => {
      const state = createOngoingState();
      const night = state.nightState!;
      expect(() =>
        assertWerewolfStateInvariants({
          ...state,
          nightState: { ...night, slice: { ...night.slice, current: null, deadlineMs: null } },
        }),
      ).not.toThrow();
    });

    it('requires the night exactly from the moment it starts', () => {
      expect(() =>
        assertWerewolfStateInvariants({ ...createOngoingState(), nightState: null }),
      ).toThrow('Ongoing state has no nightState');
      expect(() =>
        assertWerewolfStateInvariants({
          ...createOngoingState(),
          status: GameStatus.Ready,
        }),
      ).toThrow('nightState exists before night');
    });

    it('rejects a step whose serial is not its position in the night', () => {
      const state = parkedOn('seerCheck');
      const night = state.nightState!;
      expect(() =>
        assertWerewolfStateInvariants({
          ...state,
          nightState: {
            ...night,
            slice: { ...night.slice, current: { stepId: 'seerCheck', serial: 1 } },
          },
        }),
      ).toThrow('night step serial does not match its position');
    });

    it('rejects a finished night that is still parked on a step', () => {
      const running = parkedOn('wolfKill');
      expect(() =>
        assertWerewolfStateInvariants({
          ...createSheriffElectionState(),
          nightState: running.nightState,
        }),
      ).toThrow('completed night is still active');
    });
  });
});
