import { withTestNightState } from '../../__tests__/nightStateFixture';
import { GameStatus } from '../../domain/models/GameStatus';
import type { GameState } from '../../domain/protocol/types';
import { normalizeState } from '../../domain/state/normalize';
import { parseWerewolfState } from '../parseState';

function createFullState(): GameState {
  return withTestNightState({
    gameType: 'werewolf',
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Ended,
    templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager', 'wolf', 'witch', 'villager'],
    rules: {
      isPlagueMode: false,
      isSheriffElectionEnabled: true,
      witchCanSelfHeal: true,
    },
    players: {
      0: { seat: 0, role: 'treasureMaster' },
      1: { seat: 1, role: 'wolf' },
      2: { seat: 2, role: 'seer' },
      3: { seat: 3, role: 'villager' },
    },
    roleViewedSeats: [],
    roster: {
      0: {
        seat: 0,
        userId: 'host',
        profile: {
          displayName: 'Host',
          avatarUrl: 'avatar',
          avatarFrame: 'frame',
          seatFlair: 'flair',
          seatAnimation: 'animation',
          nameStyle: 'style',
          revealEffect: 'effect',
          level: 3,
        },
      },
      1: { seat: 1, userId: 'player', profile: { displayName: 'Player' } },
      2: { seat: 2, userId: 'seer', profile: { displayName: 'Seer' } },
      3: { seat: 3, userId: 'villager', profile: { displayName: 'Villager' } },
    },
    nightState: null,
    isAudioPlaying: true,
    audioBatchId: 1,
    gameSequence: 0,
    roleRevealRandomNonce: 'nonce',
    lastNightDeaths: [2],
    deathReasons: { 2: 'wolfKill' },
    sheriffElection: {
      phase: 'completed',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [
        {
          round: 'first',
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          ballots: { 2: 0, 3: 1 },
          voteCounts: { 0: 1, 1: 1 },
          abstainingSeats: [],
        },
        {
          round: 'runoff',
          candidateSeats: [0, 1],
          eligibleVoterSeats: [2, 3],
          ballots: { 2: 0, 3: null },
          voteCounts: { 0: 1, 1: 0 },
          abstainingSeats: [3],
        },
      ],
    },
    sheriffElectionResult: { kind: 'elected', sheriffSeat: 0 },
    pendingAudioEffects: [{ audioKey: 'wolfKill', isEndAudio: false }],
    seerLabelMap: { seer: 1 },
    nightReviewAllowedSeats: [0, 1],
    bottomCards: ['wolf', 'witch', 'villager'],
    boardNominations: {
      host: {
        userId: 'host',
        displayName: 'Host',
        roles: ['wolf', 'seer'],
        upvoters: ['player'],
      },
    },
  });
}

describe('parseWerewolfState', () => {
  it('rejects a state missing pendingAudioEffects', () => {
    const state = createFullState();
    const encoded = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete encoded['pendingAudioEffects'];

    expect(() => parseWerewolfState(encoded)).toThrow('pendingAudioEffects');
  });

  it('decodes every current GameState field from JSON', () => {
    const state = createFullState();
    const encoded: unknown = JSON.parse(JSON.stringify(state));

    expect(parseWerewolfState(encoded)).toEqual(normalizeState(state));
  });

  it('decodes the sheriff speaking start and direction', () => {
    const state = createFullState();
    const encoded = {
      ...state,
      status: GameStatus.Day,
      sheriffElection: {
        phase: 'candidateSpeech',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        speakingStartSeat: 1,
        speakingDirection: 'counterclockwise',
      },
      sheriffElectionResult: undefined,
    };

    expect(parseWerewolfState(encoded).sheriffElection).toEqual({
      phase: 'candidateSpeech',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      speakingStartSeat: 1,
      speakingDirection: 'counterclockwise',
    });
  });

  it('decodes an armed sheriff voting deadline', () => {
    const state = createFullState();
    const encoded = {
      ...state,
      status: GameStatus.Day,
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
      sheriffElectionResult: undefined,
    };

    expect(parseWerewolfState(encoded).sheriffElection).toEqual({
      phase: 'firstVote',
      registeredSeats: [0, 1],
      withdrawnSeats: [],
      completedRounds: [],
      candidateSeats: [0, 1],
      eligibleVoterSeats: [2, 3],
      ballots: { 2: 0, 3: 1 },
      deadline: 6000,
    });
  });

  it('rejects an empty reveal effect', () => {
    const state = createFullState();
    const hostOccupant = state.roster[0];
    if (hostOccupant == null || !('profile' in hostOccupant)) {
      throw new Error('fixture seat 0 must be a human occupant');
    }
    const encoded = {
      ...state,
      roster: {
        ...state.roster,
        0: { ...hostOccupant, profile: { ...hostOccupant.profile, revealEffect: '' } },
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow('revealEffect');
  });

  it('rejects a payload carrying the legacy stepDeadline field', () => {
    const encoded = { ...createFullState(), stepDeadline: 2 };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState contains unknown field: stepDeadline',
    );
  });

  it('rejects a payload carrying the legacy currentStepIndex field', () => {
    const encoded = { ...createFullState(), currentStepIndex: -1 };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState contains unknown field: currentStepIndex',
    );
  });

  it('rejects a Day payload carrying the legacy currentStepId field', () => {
    const encoded = {
      ...createFullState(),
      status: GameStatus.Day,
      sheriffElection: {
        phase: 'candidateSpeech',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        speakingStartSeat: 1,
        speakingDirection: 'counterclockwise',
      },
      sheriffElectionResult: undefined,
      currentStepId: 'wolfKill',
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState contains unknown field: currentStepId',
    );
  });

  it('rejects an unknown top-level field', () => {
    const encoded = { ...createFullState(), parallelStatus: 'ongoing' };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState contains unknown field: parallelStatus',
    );
  });

  it('rejects malformed roster occupants', () => {
    const botWithUserId = {
      ...createFullState(),
      roster: { 0: { seat: 0, kind: 'bot', userId: 'bot-0' } },
    };
    expect(() => parseWerewolfState(botWithUserId)).toThrow('unknown field: userId');

    const humanWithKind = {
      ...createFullState(),
      roster: { 0: { seat: 0, userId: 'host', kind: 'bot' } },
    };
    // kind:'bot' routes to the bot branch, which rejects the human field.
    expect(() => parseWerewolfState(humanWithKind)).toThrow('unknown field: userId');

    const unknownKind = {
      ...createFullState(),
      roster: { 0: { seat: 0, userId: 'host', profile: { displayName: '房主' }, kind: 'ghost' } },
    };
    expect(() => parseWerewolfState(unknownKind)).toThrow('unknown field: kind');
  });

  it('rejects an unknown nested field', () => {
    const encoded = {
      ...createFullState(),
      players: {
        0: {
          seat: 0,
          legacyBot: true,
        },
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.players.0 contains unknown field: legacyBot',
    );
  });

  it('rejects missing required fields without defaults', () => {
    const { pendingAudioEffects: _effects, ...encoded } = createFullState();

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.pendingAudioEffects must be an array',
    );
  });

  it('rejects a current-version payload missing audioBatchId', () => {
    const { audioBatchId: _audioBatchId, ...encoded } = createFullState();

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.audioBatchId must be a finite number',
    );
  });

  it('rejects a negative audioBatchId', () => {
    const encoded = { ...createFullState(), audioBatchId: -1 };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.audioBatchId must be a non-negative integer',
    );
  });

  it('rejects an unknown sheriff-election phase', () => {
    const encoded = {
      ...createFullState(),
      sheriffElection: {
        phase: 'ballotReveal',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.sheriffElection.phase must be a valid sheriff election phase',
    );
  });

  it('rejects a sheriff ballot whose target is not a seat or null', () => {
    const encoded = {
      ...createFullState(),
      sheriffElection: {
        phase: 'firstVote',
        registeredSeats: [0, 1],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0, 1],
        eligibleVoterSeats: [2, 3],
        ballots: { 2: '0' },
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow('GameState.sheriffElection.ballots.2');
  });

  it('rejects fields from a different sheriff-election phase', () => {
    const encoded = {
      ...createFullState(),
      sheriffElection: {
        phase: 'registration',
        registeredSeats: [],
        withdrawnSeats: [],
        completedRounds: [],
        ballots: {},
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.sheriffElection contains unknown field: ballots',
    );
  });
});
