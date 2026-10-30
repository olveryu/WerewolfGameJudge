/**
 * Every (status × viewer) cell of WEREWOLF_GUIDANCE_MATRIX holds against
 * the real assembly: engine projection → night model → bottom layout →
 * bottom actions → shell model. The probed viewer is never the actor
 * (actors read the schema action sentence instead — same cell).
 */
import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  getWerewolfViewModel,
  WEREWOLF_STATE_IDENTITY,
} from '@game-judge/game-engine/games/werewolf/public';

import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';
import type { SheriffElectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { resolveNightInteraction } from '@/games/werewolf/room/night/resolveNightInteraction';
import { buildWerewolfGuideMessage } from '@/games/werewolf/room/werewolfGuideMessage';
import {
  createWerewolfBottomActionLayout,
  createWerewolfBottomActions,
  createWerewolfRoomCapabilities,
  createWerewolfRoomShellModel,
} from '@/games/werewolf/room/werewolfRoomAdapter';
import { viewerFor } from '@/test-utils/roomViewer';

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

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'HOST',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'witch', 'seer'] as RoleId[],
    players: {
      0: { seat: 0, role: 'wolf' as RoleId },
      1: { seat: 1, role: 'witch' as RoleId },
      2: { seat: 2, role: 'seer' as RoleId },
    },
    roleViewedSeats: [],
    nightStep: { kind: 'inStep', stepId: 'seerCheck' },
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    roster: {
      0: { seat: 0, userId: 'HOST', profile: { displayName: '房主' } },
      1: { seat: 1, userId: 'p1', profile: { displayName: 'P2' } },
      2: { seat: 2, userId: 'p2', profile: { displayName: 'P3' } },
    },
    ...overrides,
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
    requestAdvance: jest.fn(),
    requestEndBySelfDestruct: jest.fn(),
  };
}

function bottomFor(
  status: GameStatus,
  audience: RoomViewerAudience,
): { kind: string; message: string | null } {
  const viewer = viewerFor(audience, { hostUserId: 'HOST', seatedUserId: 'p1' });
  const state = createGameState({ status });
  const viewModel = getWerewolfViewModel(state, { seat: viewer.seat, isHost: viewer.isHost });
  const night = resolveNightInteraction({
    viewModel,
    draft: { firstSwapSeat: null, multiSelectedSeats: [] },
    swapSecondSeat: null,
    locks: { isAudioPlaying: false, hasPendingCommand: false },
    nowMs: 0,
  });
  const sheriffElectionPanel = status === GameStatus.Day ? createElection() : null;
  const capabilities = createWerewolfRoomCapabilities({
    status,
    isHost: viewer.isHost,
    mySeat: viewer.seat,
    hasOccupiedSeats: true,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    openProfile: jest.fn(),
    takeOverBots: { isAllowed: false, reason: null },
    shareRoom: jest.fn(),
  });
  const layout = createWerewolfBottomActionLayout({
    viewModel,
    night,
    isHost: viewer.isHost,
    effectiveSeat: viewer.seat,
    isAudioPlaying: false,
    isActionSubmitting: false,
    canOpenNightReview: viewer.isHost,
    onNightButton: jest.fn(),
    onViewRole: jest.fn(),
    onNightReview: jest.fn(),
  });
  const bottomActions = createWerewolfBottomActions({
    state,
    viewModel,
    night,
    isHost: viewer.isHost,
    isAudioPlaying: false,
    layout,
    actionMessage: null,
    guideMessage: buildWerewolfGuideMessage({
      isHost: viewer.isHost,
      roomStatus: status,
      mySeat: viewer.seat,
      viewModel,
    }),
    sheriffElectionPanel,
    isSheriffInspectorVisible: false,
    openSheriffDetails: jest.fn(),
  });
  const model = createWerewolfRoomShellModel({
    state,
    viewModel,
    night,
    revision: 1,
    roomCode: '1234',
    viewer,
    capabilities,
    connection: {
      status: { kind: 'live' },
      pendingDurableCount: 0,
      presence: new Set<string>(),
      onRetryNow: jest.fn(),
    },
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
    onSeatPress: jest.fn(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: viewer.userId },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    controlledSeat: null,
    onReleaseBot: jest.fn(),
    onBotSeatLongPress: null,
    isActionSubmitting: false,
    isStartingGame: false,
    isHostActionSubmitting: false,
    bottomActions,
    sheriffElectionPanel,
    panelFlow: { lastNightInfoConfirmed: false, nightReviewOpened: false },
    onHostControl: jest.fn(),
    onMusicSettings: jest.fn(),
    onMarkAllBotsViewed: jest.fn(),
    onMarkAllBotsGroupConfirmed: jest.fn(),
    onNightReview: jest.fn(),
    onLastNightInfo: jest.fn(),
    onSelectMvp: jest.fn(),
  });
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
        expect(bottom.kind).toBe('dock');
        expect(bottom.message).toBe('报名进行中');
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

  it('gives Ended no guide line for any viewer — the panel flow step bar carries it', () => {
    const state = createGameState({ status: GameStatus.Ended });
    const viewModel = getWerewolfViewModel(state, { seat: 0, isHost: true });
    expect(
      buildWerewolfGuideMessage({
        isHost: true,
        roomStatus: GameStatus.Ended,
        mySeat: 0,
        viewModel,
      }),
    ).toBeNull();
    expect(
      buildWerewolfGuideMessage({
        isHost: false,
        roomStatus: GameStatus.Ended,
        mySeat: 1,
        viewModel,
      }),
    ).toBeNull();
  });
});
