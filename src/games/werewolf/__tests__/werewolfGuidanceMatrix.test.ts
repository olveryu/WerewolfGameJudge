/**
 * Werewolf guidance matrix: every (status × viewer) cell declared in
 * werewolfGuidanceMatrix.ts is held true against the real production
 * path — buildWerewolfGuideMessage derives the guide sentence, then
 * createWerewolfRoomShellModel composes the bottom message. Local
 * states are fabricated with the same factory as
 * werewolfRoomAdapter.test.ts (werewolf states are runtime projections,
 * not engine-driven flows, in this game's client tests).
 */
import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  buildNightPlan,
  GameStatus,
  WEREWOLF_STATE_IDENTITY,
} from '@game-judge/game-engine/games/werewolf/public';

import { EMPTY_LAYOUT } from '@/games/werewolf/room/hooks/bottomLayoutConfig';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { buildWerewolfGuideMessage } from '@/games/werewolf/room/werewolfGuideMessage';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import {
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
  type WerewolfRoomShellModelInput,
} from '@/games/werewolf/werewolfRoomAdapter';

import { WEREWOLF_GUIDANCE_MATRIX } from '../room/werewolfGuidanceMatrix';

const STATUSES: readonly GameStatus[] = [
  GameStatus.Unseated,
  GameStatus.Seated,
  GameStatus.Assigned,
  GameStatus.Ready,
  GameStatus.Ongoing,
  GameStatus.Day,
  GameStatus.Ended,
];

function createLocalGameState(overrides: Partial<GameState> = {}): LocalGameState {
  return toWerewolfLocalState({
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'witch', 'seer'] as RoleId[],
    players: {
      0: { seat: 0, hasViewedRole: false, role: 'wolf' as RoleId },
      1: { seat: 1, hasViewedRole: false, role: 'witch' as RoleId },
      2: { seat: 2, hasViewedRole: false, role: 'seer' as RoleId },
    },
    currentStepIndex: 0,
    isAudioPlaying: false,
    pendingAudioEffects: [],
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {
      0: { seat: 0, userId: 'HOST' },
      1: { seat: 1, userId: 'p1' },
      2: { seat: 2, userId: 'p2' },
    },
    playerProfiles: {
      HOST: { displayName: '房主' },
      p1: { displayName: 'P2' },
      p2: { displayName: 'P3' },
    },
    ...overrides,
  });
}

function createCapabilityInput() {
  return {
    status: GameStatus.Unseated,
    isHost: true,
    mySeat: null,
    hasOccupiedSeats: true,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
    shareRoom: jest.fn(),
  };
}

const ELECTION_VIEW: SheriffElectionViewModel = {
  phase: 'registration',
  phaseTitle: '报名上警',
  phaseDescription: '玩家可报名',
  candidateRecords: null,
  speakingInstruction: null,
  voteProgress: null,
  myBallot: null,
  candidateOptions: [],
  completedRounds: [],
  finalResult: null,
  canRegister: false,
  canCancelRegistration: false,
  canWithdraw: false,
  canVote: false,
  canAdvance: false,
  advanceLabel: null,
};

function createElection(): SheriffElectionPanelModel {
  return {
    view: ELECTION_VIEW,
    pendingAction: null,
    register: jest.fn(async () => undefined),
    cancelRegistration: jest.fn(async () => undefined),
    withdraw: jest.fn(async () => undefined),
    vote: jest.fn(async () => undefined),
    advance: jest.fn(async () => undefined),
    requestEndBySelfDestruct: jest.fn(),
  };
}

type Viewer = 'host' | 'seated' | 'spectator';

function bottomFor(status: GameStatus, viewer: Viewer): { kind: string; message: string | null } {
  const isHost = viewer === 'host';
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null;
  const gameState = createLocalGameState({ status });
  const guideMessage = buildWerewolfGuideMessage({
    isHost,
    roomStatus: status,
    mySeat,
    gameState,
  });
  // Entry state of the night: the first planned step is running, the
  // narration has settled, and the probed viewer is not the actor
  // (actors read the schema action sentence instead — same cell).
  const nightPlan = buildNightPlan(gameState.template.roles, gameState.seerLabelMap);
  const input: WerewolfRoomShellModelInput = {
    roomCode: '1234',
    capabilities: createWerewolfRoomCapabilities(createCapabilityInput()),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/room/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    user: { id: isHost ? 'HOST' : 'p1' },
    ticketCount: null,
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    onAvatarPress: jest.fn(),
    roomStatus: status,
    isHost,
    isAudioPlaying: false,
    isActionSubmitting: false,
    isStartingGame: false,
    isHostActionSubmitting: false,
    imActioner: false,
    isPlagueMode: false,
    seatedCount: 3,
    viewedCount: 0,
    totalSeats: 3,
    actionMessage: '',
    guideMessage,
    currentStepId: status === GameStatus.Ongoing ? (nightPlan.steps[0]?.stepId ?? null) : null,
    gameState,
    seatViewModels: [],
    controlledSeat: null,
    sheriffElectionPanel: status === GameStatus.Day ? createElection() : null,
    stateRevision: 1,
    onSeatPress: jest.fn(),
    onSeatLongPressed: jest.fn(),
    hasBots: false,
    controlledBotName: null,
    onReleaseBot: jest.fn(),
    mvpSeat: null,
    onSelectMvp: jest.fn(),
    currentSchemaKind: null,
    onHostControl: jest.fn(),
    onMusicSettings: jest.fn(),
    onMarkAllBotsViewed: jest.fn(),
    onMarkAllBotsGroupConfirmed: jest.fn(),
    onNightReview: jest.fn(),
    onLastNightInfo: jest.fn(),
    bottomLayout: EMPTY_LAYOUT,
    onSchemaButtonPress: jest.fn(),
    onStaticButtonPress: jest.fn(),
    isSheriffInspectorVisible: false,
    openSheriffDetails: jest.fn(),
  };
  const model = createWerewolfRoomShellModel(input);
  return { kind: model.bottomActions.kind, message: model.bottomActions.message };
}

describe('WEREWOLF_GUIDANCE_MATRIX', () => {
  it('covers exactly the GameStatus list, each exempt cell with a reason', () => {
    expect(Object.keys(WEREWOLF_GUIDANCE_MATRIX).sort()).toEqual(
      STATUSES.map((status) => status as string).sort(),
    );
    for (const row of Object.values(WEREWOLF_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(STATUSES)('holds every viewer cell in status %s', (status) => {
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = WEREWOLF_GUIDANCE_MATRIX[status][viewer];
      const bottom = bottomFor(status, viewer);
      if (status === GameStatus.Day) {
        // Declared exempt because the sheriff dock — not a message —
        // is the bottom guidance surface in the election phase.
        expect(bottom.kind).toBe('dock');
        expect(bottom.message).toBeNull();
        continue;
      }
      if (cell.kind === 'message') {
        if (typeof bottom.message !== 'string' || bottom.message === '') {
          throw new Error(
            `${status} x ${viewer}: declared a message cell, got ${JSON.stringify(bottom.message)}`,
          );
        }
      } else if (bottom.message !== null) {
        throw new Error(
          `${status} x ${viewer}: declared exempt (${cell.reason}), got ${JSON.stringify(bottom.message)}`,
        );
      }
    }
  });

  it('addresses the Assigned spectator as a waiter, never as a card holder', () => {
    const gameState = createLocalGameState({ status: GameStatus.Assigned });
    expect(
      buildWerewolfGuideMessage({
        isHost: false,
        roomStatus: GameStatus.Assigned,
        mySeat: null,
        gameState,
      }),
    ).toBe('等待玩家查看身份');
    expect(
      buildWerewolfGuideMessage({
        isHost: false,
        roomStatus: GameStatus.Assigned,
        mySeat: 1,
        gameState,
      }),
    ).toContain('查看你的身份');
  });
});
