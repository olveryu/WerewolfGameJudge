import { WEREWOLF_STATE_IDENTITY } from '../../../state/version';
import { GameStatus } from '../../models';
import type { GameState } from '../../protocol/types';
import { assertWerewolfStateInvariants } from '../assertStateInvariants';

function createTreasureMasterState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Assigned,
    templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager'],
    players: {
      0: {
        userId: 'host',
        seat: 0,
        role: 'treasureMaster',
        hasViewedRole: false,
      },
    },
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    bottomCards: ['wolf', 'seer', 'villager'],
    treasureMasterSeat: 0,
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    ...overrides,
  };
}

function createThiefState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createTreasureMasterState(),
    templateRoles: ['thief', 'wolf', 'seer'],
    players: {
      0: { userId: 'host', seat: 0, role: 'thief', hasViewedRole: false },
    },
    bottomCards: ['wolf', 'seer'],
    treasureMasterSeat: undefined,
    thiefSeat: 0,
    ...overrides,
  };
}

function createSheriffElectionState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Day,
    templateRoles: ['wolf', 'seer', 'hunter', 'villager'],
    rules: { isSheriffElectionEnabled: true },
    players: {
      0: { userId: 'host', seat: 0, role: 'wolf', hasViewedRole: true },
      1: { userId: 'p1', seat: 1, role: 'seer', hasViewedRole: true },
      2: { userId: 'p2', seat: 2, role: 'hunter', hasViewedRole: true },
      3: { userId: 'p3', seat: 3, role: 'villager', hasViewedRole: true },
    },
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    currentNightResults: {},
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
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
}

describe('assertWerewolfStateInvariants', () => {
  it('accepts canonical assigned and ongoing bottom-card states', () => {
    expect(() => assertWerewolfStateInvariants(createTreasureMasterState())).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'wolf' },
        }),
      ),
    ).not.toThrow();
  });

  it('requires currentNightResults exactly during ongoing and ended states', () => {
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ status: GameStatus.Ongoing })),
    ).toThrow('Ongoing state has no currentNightResults');
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ currentNightResults: {} })),
    ).toThrow('Assigned state contains currentNightResults');
  });

  it('accepts one non-wolf role converted into a wolf by Seed Wolf', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          templateRoles: ['seedWolf', 'wolf', 'seer', 'villager'],
          players: {
            0: { userId: 'host', seat: 0, role: 'seedWolf', hasViewedRole: true },
            1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: true },
            2: { userId: 'p2', seat: 2, role: 'wolf', hasViewedRole: true },
            3: { userId: 'p3', seat: 3, role: 'villager', hasViewedRole: true },
          },
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 2 },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a converted Seed Wolf target that is not a wolf', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createSheriffElectionState({
          templateRoles: ['seedWolf', 'wolf', 'seer', 'villager'],
          players: {
            0: { userId: 'host', seat: 0, role: 'seedWolf', hasViewedRole: true },
            1: { userId: 'p1', seat: 1, role: 'wolf', hasViewedRole: true },
            2: { userId: 'p2', seat: 2, role: 'seer', hasViewedRole: true },
            3: { userId: 'p3', seat: 3, role: 'villager', hasViewedRole: true },
          },
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 2 },
        }),
      ),
    ).toThrow('converted Seed Wolf target seat 2 is not a wolf');
  });

  it('requires a legal deck and the matching seated actor after assignment', () => {
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ bottomCards: undefined })),
    ).toThrow('deal has no bottomCards');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({ bottomCards: ['wolf', 'seer', 'witch'] }),
      ),
    ).toThrow('bottomCards violate the canonical deck rules');
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ treasureMasterSeat: 1 })),
    ).toThrow('actor seat 1 is empty');
  });

  it('requires assigned identities and bottom cards to reconstruct the deal pool', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager', 'witch'],
          players: {
            0: {
              userId: 'host',
              seat: 0,
              role: 'treasureMaster',
              hasViewedRole: false,
            },
            1: { userId: 'p1', seat: 1, role: 'seer', hasViewedRole: false },
          },
        }),
      ),
    ).toThrow('assigned roles and bottomCards do not match the role deal pool at seer');
  });

  it('rejects a chosen card outside the deck or from the forbidden faction', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { treasureMasterChosenCard: 'witch' },
        }),
      ),
    ).toThrow('which is not in bottomCards');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { treasureMasterChosenCard: 'wolf' },
        }),
      ),
    ).toThrow('is a wolf-faction card');
  });

  it('requires thief to choose the wolf-faction card when one is present', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'seer' },
        }),
      ),
    ).toThrow('must be the wolf-faction card');
  });

  it('rejects state owned by the other bottom-card actor', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'wolf' },
        }),
      ),
    ).toThrow('also contains thiefChosenCard');
  });

  it('removes treasure-master runtime state in plague mode but keeps thief deals valid', () => {
    const plagueTreasureMasterState = createTreasureMasterState({
      rules: { isPlagueMode: true },
      players: {
        0: { userId: 'host', seat: 0, role: 'villager', hasViewedRole: false },
      },
      bottomCards: undefined,
      treasureMasterSeat: undefined,
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
});
