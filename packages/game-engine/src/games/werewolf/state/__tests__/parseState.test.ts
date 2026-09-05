import { GameStatus } from '../../domain/models/GameStatus';
import { Team } from '../../domain/models/roles/spec/types';
import type { GameState } from '../../domain/protocol/types';
import { normalizeState } from '../../domain/state/normalize';
import { parseWerewolfState } from '../parseState';
import { WEREWOLF_STATE_IDENTITY } from '../version';

function createFullState(): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
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
      0: { userId: 'host', seat: 0, role: 'treasureMaster', hasViewedRole: true },
      1: { userId: 'player', seat: 1, role: 'wolf', hasViewedRole: true, isBot: false },
      2: { userId: 'seer', seat: 2, role: 'seer', hasViewedRole: true },
      3: { userId: 'villager', seat: 3, role: 'villager', hasViewedRole: true },
    },
    roster: {
      host: {
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
    currentStepIndex: 0,
    isAudioPlaying: true,
    roleRevealRandomNonce: 'nonce',
    currentStepId: 'wolfKill',
    actions: [{ schemaId: 'wolfKill', actorSeat: 0, targetSeat: 1, timestamp: 1 }],
    currentNightResults: {
      wolfVotesBySeat: { '0': 1 },
      blockedSeat: 1,
      wolfKillOverride: {
        source: 'nightmare',
        ui: {
          promptTitle: 'title',
          promptMessage: 'message',
          emptyVoteText: 'empty',
          rejectMessage: 'reject',
        },
      },
      guardedSeat: 2,
      savedSeat: 2,
      poisonedSeat: 3,
      dreamingSeat: 1,
      charmedSeat: 2,
      swappedSeats: [0, 1],
      silencedSeat: 1,
      votebannedSeat: 2,
      cursedSeat: 3,
      shelteredSeat: 1,
      hypnotizedSeats: [1, 2],
      convertedSeat: 3,
      shadowMimicTarget: 2,
      avengerFaction: Team.Good,
      treasureMasterChosenCard: 'witch',
      loverSeats: [0, 1],
    },
    pendingRevealAcks: ['host'],
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
    nightmareBlockedSeat: 1,
    wolfKillOverride: {
      source: 'poisoner',
      ui: {
        promptTitle: 'title',
        promptMessage: 'message',
        emptyVoteText: 'empty',
        rejectMessage: 'reject',
      },
    },
    wolfRobotContext: { learnedSeat: 1, disguisedRole: 'seer' },
    witchContext: { killedSeat: 2, canSave: true, canPoison: false },
    seerReveal: { targetSeat: 1, result: '狼人' },
    mirrorSeerReveal: { targetSeat: 1, result: '好人' },
    drunkSeerReveal: { targetSeat: 2, result: '好人' },
    psychicReveal: { targetSeat: 1, result: 'wolf' },
    gargoyleReveal: { targetSeat: 1, result: 'wolf' },
    pureWhiteReveal: { targetSeat: 1, result: 'wolf' },
    wolfWitchReveal: { targetSeat: 1, result: 'wolf' },
    wolfRobotReveal: {
      targetSeat: 1,
      result: 'seer',
      learnedRoleId: 'seer',
      canShootAsHunter: false,
    },
    wolfRobotHunterStatusViewed: true,
    confirmStatus: { role: 'hiddenWolf', wolfTeammates: [0] },
    actionRejected: {
      action: 'wolfKill',
      reason: 'rejected',
      targetUserId: 'host',
      rejectionId: 'rejection',
    },
    stepDeadline: 2,
    pendingAudioEffects: [{ audioKey: 'wolfKill', isEndAudio: false }],
    ui: {
      currentActorHint: {
        kind: 'wolf_kill_disabled',
        targetRoleIds: ['wolf'],
        message: 'disabled',
        bottomAction: 'wolfEmptyOnly',
        promptOverride: { title: 'title', text: 'text' },
      },
    },
    debugMode: { botsEnabled: true },
    seerLabelMap: { seer: 1 },
    nightReviewAllowedSeats: [0, 1],
    hypnotizedSeats: [1],
    piperRevealAcks: [0],
    convertedSeat: 2,
    conversionRevealAcks: [0, 1],
    bottomCards: ['wolf', 'witch', 'villager'],
    treasureMasterSeat: 0,
    loverSeats: [0, 1],
    cupidSeat: 2,
    cupidLoversRevealAcks: [0, 1],
    seedWolfInfectionRevealAcks: [0, 1],
    boardNominations: {
      host: {
        userId: 'host',
        displayName: 'Host',
        roles: ['wolf', 'seer'],
        upvoters: ['player'],
      },
    },
  };
}

describe('parseWerewolfState', () => {
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

  it('migrates the legacy empty reveal effect to the canonical room value', () => {
    const state = createFullState();
    const encoded = {
      ...state,
      roster: {
        ...state.roster,
        host: { ...state.roster.host, revealEffect: '' },
      },
    };

    expect(parseWerewolfState(encoded).roster.host?.revealEffect).toBe('none');
  });

  it('rejects an unknown top-level field', () => {
    const encoded = { ...createFullState(), parallelStatus: 'ongoing' };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState contains unknown field: parallelStatus',
    );
  });

  it('rejects an unknown nested field', () => {
    const encoded = {
      ...createFullState(),
      players: {
        0: {
          userId: 'host',
          seat: 0,
          hasViewedRole: true,
          legacyBot: true,
        },
      },
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      'GameState.players.0 contains unknown field: legacyBot',
    );
  });

  it('rejects missing required fields without defaults', () => {
    const { actions: _actions, ...encoded } = createFullState();

    expect(() => parseWerewolfState(encoded)).toThrow('GameState.actions must be an array');
  });

  it('rejects a different state version', () => {
    const encoded = {
      ...createFullState(),
      stateVersion: WEREWOLF_STATE_IDENTITY.stateVersion - 1,
    };

    expect(() => parseWerewolfState(encoded)).toThrow(
      `GameState.stateVersion must be ${WEREWOLF_STATE_IDENTITY.stateVersion}`,
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
