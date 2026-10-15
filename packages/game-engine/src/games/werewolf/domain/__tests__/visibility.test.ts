/**
 * getWerewolfViewModel — AU-39 slice 1 characterization tests.
 *
 * One state snapshot per scenario, projected for every seat plus null
 * (spectator). Expected values on the overlapping fields (wolf pack
 * membership, confirm-status gating, group-confirm acks, bottom-card
 * effective roles) are the SAME values pinned by the Slice 0 client golden
 * suites (RoomScreen.helpers / promptExecutor / groupConfirmExecutor /
 * useRoomDerived.groupConfirmAcks) — the two sides agreeing is the
 * equivalence evidence for the later client switch (Slice 2/3).
 */

import { describe, expect, it } from 'vitest';

import { WEREWOLF_STATE_IDENTITY } from '../../state/version';
import { buildNightPlan, GameStatus, type RoleId, type SchemaId } from '../models';
import type { ConfirmStatus, GameState, WerewolfHumanSeat } from '../protocol/types';
import type { CurrentNightResults } from '../resolvers/types';
import { getWerewolfViewModel, type WerewolfSeatView, type WerewolfViewModel } from '../visibility';

// =============================================================================
// Fixtures
// =============================================================================

interface StateSpec {
  readonly roles: readonly (RoleId | null)[];
  readonly templateRoles?: readonly RoleId[];
  readonly status?: GameStatus;
  readonly stepId?: SchemaId;
  readonly botSeats?: readonly number[];
  readonly unviewedSeats?: readonly number[];
  readonly currentNightResults?: CurrentNightResults;
  readonly confirmStatus?: ConfirmStatus;
  readonly hypnotizedSeats?: readonly number[];
  readonly loverSeats?: readonly [number, number];
  readonly convertedSeat?: number;
  readonly piperRevealAcks?: readonly number[];
  readonly cupidLoversRevealAcks?: readonly number[];
  readonly conversionRevealAcks?: readonly number[];
  readonly seedWolfInfectionRevealAcks?: readonly number[];
  readonly seedWolfInfectionResult?: GameState['seedWolfInfectionResult'];
  readonly bottomCards?: readonly RoleId[];
  readonly thiefSeat?: number;
  readonly treasureMasterSeat?: number;
  readonly sheriffElectionResult?: GameState['sheriffElectionResult'];
  readonly mvpUserId?: string;
}

function stepIndexFor(templateRoles: readonly RoleId[], stepId: string): number {
  const plan = buildNightPlan(templateRoles);
  const index = plan.steps.findIndex((step) => step.stepId === stepId);
  if (index < 0) throw new Error(`Fixture error: step ${stepId} not in plan`);
  return index;
}

function createState(spec: StateSpec): GameState {
  const templateRoles = spec.templateRoles ?? spec.roles.filter((r): r is RoleId => r !== null);
  const players: Record<number, { seat: number; hasViewedRole: boolean; role: RoleId } | null> = {};
  const roster: Record<number, WerewolfHumanSeat | { seat: number; kind: 'bot' }> = {};
  const playerProfiles: Record<string, { displayName: string }> = {};

  spec.roles.forEach((role, seat) => {
    if (role === null) {
      players[seat] = null;
      return;
    }
    players[seat] = {
      seat,
      hasViewedRole: !spec.unviewedSeats?.includes(seat),
      role,
    };
    if (spec.botSeats?.includes(seat)) {
      roster[seat] = { seat, kind: 'bot' };
      playerProfiles[`bot-${seat}`] = { displayName: `BotProfile${seat}` };
    } else {
      roster[seat] = { seat, userId: `p${seat}` };
      playerProfiles[`p${seat}`] = { displayName: `P${seat}` };
    }
  });

  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host',
    status: spec.status ?? GameStatus.Ongoing,
    templateRoles: [...templateRoles],
    players,
    roster,
    playerProfiles,
    currentStepIndex: spec.stepId ? stepIndexFor(templateRoles, spec.stepId) : -1,
    ...(spec.stepId ? { currentStepId: spec.stepId } : {}),
    isAudioPlaying: false,
    actions: [],
    resolvedNightEffects: [],
    pendingRevealAcks: [],
    hypnotizedSeats: spec.hypnotizedSeats ? [...spec.hypnotizedSeats] : [],
    piperRevealAcks: spec.piperRevealAcks ? [...spec.piperRevealAcks] : [],
    conversionRevealAcks: spec.conversionRevealAcks ? [...spec.conversionRevealAcks] : [],
    seedWolfInfectionRevealAcks: spec.seedWolfInfectionRevealAcks
      ? [...spec.seedWolfInfectionRevealAcks]
      : [],
    cupidLoversRevealAcks: spec.cupidLoversRevealAcks ? [...spec.cupidLoversRevealAcks] : [],
    currentNightResults: spec.currentNightResults ?? {},
    ...(spec.confirmStatus ? { confirmStatus: spec.confirmStatus } : {}),
    ...(spec.loverSeats !== undefined ? { loverSeats: spec.loverSeats } : {}),
    ...(spec.convertedSeat !== undefined ? { convertedSeat: spec.convertedSeat } : {}),
    ...(spec.seedWolfInfectionResult
      ? { seedWolfInfectionResult: spec.seedWolfInfectionResult }
      : {}),
    ...(spec.bottomCards ? { bottomCards: [...spec.bottomCards] } : {}),
    ...(spec.thiefSeat !== undefined ? { thiefSeat: spec.thiefSeat } : {}),
    ...(spec.treasureMasterSeat !== undefined
      ? { treasureMasterSeat: spec.treasureMasterSeat }
      : {}),
    ...(spec.sheriffElectionResult ? { sheriffElectionResult: spec.sheriffElectionResult } : {}),
    ...(spec.mvpUserId ? { mvpUserId: spec.mvpUserId } : {}),
  };
}

// =============================================================================
// Wolf meeting snapshot: full view model for every seat + spectator
// =============================================================================

const WOLF_MEETING_ROLES: readonly RoleId[] = [
  'wolf',
  'wolf',
  'darkWolfKing',
  'gargoyle',
  'wolfRobot',
  'seer',
  'villager',
  'witch',
];
const WOLF_MEETING_VOTES = { '0': 5, '2': -1 } as const;
// Seats whose (effective) role is a wolf that can see the pack:
// wolf x2 + darkWolfKing. Gargoyle / wolfRobot have canSeeWolves = false.
const WOLF_PACK = [0, 1, 2] as const;

function wolfMeetingState(): GameState {
  return createState({
    roles: WOLF_MEETING_ROLES,
    stepId: 'wolfKill',
    botSeats: [7],
    unviewedSeats: [6],
    currentNightResults: { wolfVotesBySeat: { ...WOLF_MEETING_VOTES } },
  });
}

function expectedSeat(
  seat: number,
  role: RoleId,
  viewerSeat: number | null,
  pack: readonly number[] | null,
): WerewolfSeatView {
  return {
    seat,
    displayName: seat === 7 ? '机器人8号' : `P${seat}`,
    isBot: seat === 7,
    visibleRole: seat === viewerSeat ? role : null,
    isWolfPackPeer: pack !== null && pack.includes(seat),
    hasViewedRole: seat !== 6,
  };
}

function expectedWolfMeetingVm(
  viewerSeat: number | null,
  pack: readonly number[] | null,
): WerewolfViewModel {
  const myRole = viewerSeat === null ? null : WOLF_MEETING_ROLES[viewerSeat]!;
  return {
    status: GameStatus.Ongoing,
    mySeat: viewerSeat,
    myRole,
    myEffectiveRole: myRole,
    seats: WOLF_MEETING_ROLES.map((role, seat) => expectedSeat(seat, role, viewerSeat, pack)),
    wolfPackSeats: pack,
    viewedSeats: [0, 1, 2, 3, 4, 5, 7],
    night: {
      stepSchemaKind: 'wolfVote',
      confirmStatus: null,
      reveals: [],
      wolfVotesBySeat: pack ? { ...WOLF_MEETING_VOTES } : null,
    },
    day: { sheriffSeat: null, mvpSeat: null },
  };
}

describe('getWerewolfViewModel — wolf meeting snapshot', () => {
  it.each([0, 1, 2])('pack member seat %i sees the pack and the wolf votes', (seat) => {
    expect(getWerewolfViewModel(wolfMeetingState(), seat)).toEqual(
      expectedWolfMeetingVm(seat, WOLF_PACK),
    );
  });

  it.each([3, 4, 5, 6, 7])('non-pack seat %i sees neither pack nor votes', (seat) => {
    expect(getWerewolfViewModel(wolfMeetingState(), seat)).toEqual(
      expectedWolfMeetingVm(seat, null),
    );
  });

  it('spectator (null) sees no roles, no pack, no votes', () => {
    expect(getWerewolfViewModel(wolfMeetingState(), null)).toEqual(
      expectedWolfMeetingVm(null, null),
    );
  });

  it('a non-meeting step hides the pack even from wolves (cross-check: client golden wolf x seerCheck)', () => {
    const state = createState({
      roles: WOLF_MEETING_ROLES,
      stepId: 'seerCheck',
      currentNightResults: { wolfVotesBySeat: { ...WOLF_MEETING_VOTES } },
    });
    const wolfVm = getWerewolfViewModel(state, 0);
    expect(wolfVm.night.stepSchemaKind).toBe('chooseSeat');
    expect(wolfVm.wolfPackSeats).toBeNull();
    expect(wolfVm.night.wolfVotesBySeat).toBeNull();
    expect(getWerewolfViewModel(state, 5).myRole).toBe('seer');
  });
});

// =============================================================================
// Bottom-card snapshot (mirrors the Slice 0 client golden board exactly)
// =============================================================================

describe('getWerewolfViewModel — bottom-card board at wolfKill', () => {
  const bottomCardState = (): GameState =>
    createState({
      roles: ['wolf', 'thief', 'treasureMaster', 'gargoyle', 'wolfRobot', 'seer'],
      templateRoles: [
        'wolf',
        'thief',
        'treasureMaster',
        'gargoyle',
        'wolfRobot',
        'seer',
        'wolf',
        'villager',
      ],
      stepId: 'wolfKill',
      bottomCards: ['wolf', 'villager'],
      thiefSeat: 1,
      treasureMasterSeat: 2,
      currentNightResults: {
        thiefChosenCard: 'wolf',
        treasureMasterChosenCard: 'wolf',
        wolfVotesBySeat: { '0': 5, '1': -1 },
      },
    });

  it('wolf sees pack [0, 1] (cross-check: client golden isWolf seats)', () => {
    const vm = getWerewolfViewModel(bottomCardState(), 0);
    expect(vm.myRole).toBe('wolf');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toEqual([0, 1]);
    expect(vm.seats.map((s) => s.isWolfPackPeer)).toEqual([true, true, false, false, false, false]);
    expect(vm.night.wolfVotesBySeat).toEqual({ '0': 5, '1': -1 });
  });

  it('thief who chose the wolf card joins the pack with effective role wolf', () => {
    const vm = getWerewolfViewModel(bottomCardState(), 1);
    expect(vm.myRole).toBe('thief');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toEqual([0, 1]);
    expect(vm.seats[1]!.visibleRole).toBe('thief');
  });

  it('treasureMaster who chose the wolf card sees the pack but is not in it (client golden quirk)', () => {
    const vm = getWerewolfViewModel(bottomCardState(), 2);
    expect(vm.myRole).toBe('treasureMaster');
    expect(vm.myEffectiveRole).toBe('wolf');
    // Matching-role branch of determineActionerState: showWolves = true...
    expect(vm.wolfPackSeats).toEqual([0, 1]);
    expect(vm.night.wolfVotesBySeat).toEqual({ '0': 5, '1': -1 });
    // ...yet the seat board exclusion keeps the treasureMaster seat itself
    // out of the pack (client golden isWolf[2] === false).
    expect(vm.seats[2]!.isWolfPackPeer).toBe(false);
  });

  it('seer sees neither pack nor votes', () => {
    const vm = getWerewolfViewModel(bottomCardState(), 5);
    expect(vm.wolfPackSeats).toBeNull();
    expect(vm.night.wolfVotesBySeat).toBeNull();
    expect(vm.seats.every((s) => !s.isWolfPackPeer)).toBe(true);
  });
});

// =============================================================================
// Confirm status gating (cross-check: promptExecutor golden)
// =============================================================================

describe('getWerewolfViewModel — confirmStatus gating', () => {
  const hunterState = (stepId: SchemaId): GameState =>
    createState({
      roles: ['wolf', 'villager', 'villager', 'seer', 'witch', 'hunter'],
      stepId,
      confirmStatus: { role: 'hunter', canShoot: false },
    });

  it('only the hunter seat receives the hunter confirm status', () => {
    const state = hunterState('hunterConfirm');
    expect(getWerewolfViewModel(state, 5).night.confirmStatus).toEqual({
      role: 'hunter',
      canShoot: false,
    });
    expect(getWerewolfViewModel(state, 5).night.stepSchemaKind).toBe('confirm');
    expect(getWerewolfViewModel(state, 0).night.confirmStatus).toBeNull();
    expect(getWerewolfViewModel(state, null).night.confirmStatus).toBeNull();
  });

  it('a stored status is not exposed on a different step', () => {
    const state = hunterState('wolfKill');
    expect(getWerewolfViewModel(state, 5).night.confirmStatus).toBeNull();
  });

  it('hiddenWolf receives the wolf teammate list; wolves do not', () => {
    const state = createState({
      roles: ['hiddenWolf', 'wolf', 'wolf', 'villager'],
      stepId: 'hiddenWolfReveal',
      confirmStatus: { role: 'hiddenWolf', wolfTeammates: [1, 2] },
    });
    expect(getWerewolfViewModel(state, 0).night.confirmStatus).toEqual({
      role: 'hiddenWolf',
      wolfTeammates: [1, 2],
    });
    expect(getWerewolfViewModel(state, 1).night.confirmStatus).toBeNull();
  });

  it('seedWolf status reaches the thief seat that took the seedWolf card', () => {
    const state = createState({
      roles: ['thief', 'wolf', 'villager', 'villager'],
      templateRoles: ['thief', 'wolf', 'villager', 'villager', 'seedWolf', 'villager'],
      stepId: 'seedWolfInfect',
      bottomCards: ['seedWolf', 'villager'],
      thiefSeat: 0,
      currentNightResults: { thiefChosenCard: 'seedWolf' },
      confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 2 },
    });
    const vm = getWerewolfViewModel(state, 0);
    expect(vm.myEffectiveRole).toBe('seedWolf');
    expect(vm.night.confirmStatus).toEqual({
      role: 'seedWolf',
      availability: 'available',
      targetSeat: 2,
    });
    expect(getWerewolfViewModel(state, 2).night.confirmStatus).toBeNull();
  });
});

// =============================================================================
// Group confirm reveals (cross-check: groupConfirmExecutor golden)
// =============================================================================

describe('getWerewolfViewModel — groupConfirm reveals', () => {
  it('piper reveal: hypnotized viewers get the full subject list, others do not', () => {
    const state = createState({
      roles: ['piper', 'villager', 'villager', 'villager', 'villager', 'villager'],
      stepId: 'piperHypnotizedReveal',
      hypnotizedSeats: [1, 3],
      piperRevealAcks: [0, 1],
    });
    expect(getWerewolfViewModel(state, 1).night.reveals).toEqual([
      {
        stepId: 'piperHypnotizedReveal',
        ackedSeats: [0, 1],
        hasAcked: true,
        isSubject: true,
        partnerSeat: null,
        subjectSeats: [1, 3],
      },
    ]);
    expect(getWerewolfViewModel(state, 2).night.reveals).toEqual([
      {
        stepId: 'piperHypnotizedReveal',
        ackedSeats: [0, 1],
        hasAcked: false,
        isSubject: false,
        partnerSeat: null,
        subjectSeats: null,
      },
    ]);
    expect(getWerewolfViewModel(state, null).night.reveals[0]).toMatchObject({
      ackedSeats: [0, 1],
      hasAcked: false,
      isSubject: false,
      subjectSeats: null,
    });
    expect(getWerewolfViewModel(state, 1).night.stepSchemaKind).toBe('groupConfirm');
  });

  it('cupid reveal: lovers learn each other, nobody else learns anything', () => {
    const state = createState({
      roles: ['cupid', 'villager', 'villager', 'villager', 'villager'],
      stepId: 'cupidLoversReveal',
      loverSeats: [1, 4],
      cupidLoversRevealAcks: [4],
    });
    expect(getWerewolfViewModel(state, 1).night.reveals[0]).toEqual({
      stepId: 'cupidLoversReveal',
      ackedSeats: [4],
      hasAcked: false,
      isSubject: true,
      partnerSeat: 4,
      subjectSeats: null,
    });
    expect(getWerewolfViewModel(state, 4).night.reveals[0]).toMatchObject({
      hasAcked: true,
      isSubject: true,
      partnerSeat: 1,
    });
    expect(getWerewolfViewModel(state, 0).night.reveals[0]).toMatchObject({
      isSubject: false,
      partnerSeat: null,
    });
  });

  it('gargoyle reveal: only the converted seat is the subject', () => {
    const state = createState({
      roles: ['gargoyle', 'villager', 'villager', 'villager', 'awakenedGargoyle'],
      stepId: 'awakenedGargoyleConvertReveal',
      convertedSeat: 2,
      conversionRevealAcks: [2, 3],
    });
    expect(getWerewolfViewModel(state, 2).night.reveals[0]).toMatchObject({
      stepId: 'awakenedGargoyleConvertReveal',
      ackedSeats: [2, 3],
      hasAcked: true,
      isSubject: true,
    });
    expect(getWerewolfViewModel(state, 3).night.reveals[0]).toMatchObject({
      hasAcked: true,
      isSubject: false,
    });
  });

  it('seedWolf reveal: converted target is the subject; failed infection has none', () => {
    const converted = createState({
      roles: ['seedWolf', 'villager', 'villager', 'villager'],
      stepId: 'seedWolfInfectReveal',
      seedWolfInfectionResult: { outcome: 'converted', targetSeat: 2 },
    });
    expect(getWerewolfViewModel(converted, 2).night.reveals[0]).toMatchObject({
      stepId: 'seedWolfInfectReveal',
      isSubject: true,
    });
    expect(getWerewolfViewModel(converted, 1).night.reveals[0]).toMatchObject({
      isSubject: false,
    });

    const failed = createState({
      roles: ['seedWolf', 'villager', 'villager', 'villager'],
      stepId: 'seedWolfInfectReveal',
      seedWolfInfectionResult: { outcome: 'failed', targetSeat: 2 },
    });
    expect(getWerewolfViewModel(failed, 2).night.reveals[0]).toMatchObject({
      isSubject: false,
    });
  });

  it('no reveal outside a groupConfirm step', () => {
    const state = createState({
      roles: ['piper', 'villager', 'villager'],
      stepId: 'piperHypnotize',
      hypnotizedSeats: [1],
      piperRevealAcks: [0],
    });
    expect(getWerewolfViewModel(state, 1).night.reveals).toEqual([]);
  });
});

// =============================================================================
// Day fields, lifecycle states, fail-fast
// =============================================================================

describe('getWerewolfViewModel — day fields and lifecycle', () => {
  it('projects sheriff seat and MVP seat from the day results', () => {
    const state = createState({
      roles: ['villager', 'villager', 'villager', 'villager', 'villager'],
      status: GameStatus.Ended,
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 3 },
      mvpUserId: 'p4',
    });
    const vm = getWerewolfViewModel(state, 0);
    expect(vm.day).toEqual({ sheriffSeat: 3, mvpSeat: 4 });
    expect(vm.night.stepSchemaKind).toBeNull();
  });

  it('no-sheriff result and missing MVP project to null', () => {
    const state = createState({
      roles: ['villager', 'villager', 'villager'],
      status: GameStatus.Ended,
      sheriffElectionResult: { kind: 'noSheriff', reason: 'noCandidates' },
    });
    expect(getWerewolfViewModel(state, null).day).toEqual({
      sheriffSeat: null,
      mvpSeat: null,
    });
  });

  it('assigned state (before the night) projects roles but no night step', () => {
    const state = createState({
      roles: WOLF_MEETING_ROLES,
      status: GameStatus.Assigned,
    });
    const vm = getWerewolfViewModel(state, 0);
    expect(vm.status).toBe(GameStatus.Assigned);
    expect(vm.myRole).toBe('wolf');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toBeNull();
    expect(vm.night).toEqual({
      stepSchemaKind: null,
      confirmStatus: null,
      reveals: [],
      wolfVotesBySeat: null,
    });
  });

  it('throws fail-fast when a seated player has no roster occupant', () => {
    const state = createState({ roles: ['wolf', 'villager'] });
    const broken: GameState = { ...state, roster: {} };
    expect(() => getWerewolfViewModel(broken, 0)).toThrow(
      '[FAIL-FAST] Werewolf seat 0 has game data without an occupant',
    );
  });
});
