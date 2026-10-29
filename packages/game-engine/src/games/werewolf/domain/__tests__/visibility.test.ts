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
import {
  createTemplateFromRoles,
  GameStatus,
  type RoleId,
  type SchemaId,
  SCHEMAS,
} from '../models';
import type { ConfirmStatus, GameState, WerewolfHumanSeat } from '../protocol/types';
import type { CurrentNightResults } from '../resolvers/types';
import {
  getWerewolfViewModel,
  type WerewolfSeatView,
  type WerewolfViewer,
  type WerewolfViewModel,
} from '../visibility';

/** A non-host viewer at `seat` (null = unseated spectator). */
function player(seat: number | null): WerewolfViewer {
  return { seat, isHost: false };
}

/** The host viewing as `seat` (own seat or a controlled bot seat; null = unseated host). */
function host(seat: number | null): WerewolfViewer {
  return { seat, isHost: true };
}

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

function createState(spec: StateSpec): GameState {
  const templateRoles = spec.templateRoles ?? spec.roles.filter((r): r is RoleId => r !== null);
  const players: Record<number, { seat: number; role: RoleId } | null> = {};
  const roleViewedSeats: number[] = [];
  const roster: Record<number, WerewolfHumanSeat | { seat: number; kind: 'bot' }> = {};

  spec.roles.forEach((role, seat) => {
    if (role === null) {
      players[seat] = null;
      return;
    }
    players[seat] = {
      seat,
      role,
    };
    if (!spec.unviewedSeats?.includes(seat)) roleViewedSeats.push(seat);
    if (spec.botSeats?.includes(seat)) {
      roster[seat] = { seat, kind: 'bot' };
    } else {
      roster[seat] = { seat, userId: `p${seat}`, profile: { displayName: `P${seat}` } };
    }
  });

  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST',
    hostUserId: 'host',
    status: spec.status ?? GameStatus.Ongoing,
    templateRoles: [...templateRoles],
    players,
    roleViewedSeats,
    roster,
    nightStep: spec.stepId ? { kind: 'inStep', stepId: spec.stepId } : null,
    isAudioPlaying: false,
    audioBatchId: 0,
    pendingAudioEffects: [],
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
    disabledReason: null,
  };
}

function expectedWolfMeetingVm(
  viewerSeat: number | null,
  pack: readonly number[] | null,
): WerewolfViewModel {
  const myRole = viewerSeat === null ? null : WOLF_MEETING_ROLES[viewerSeat]!;
  const myVote =
    viewerSeat === null
      ? null
      : ((WOLF_MEETING_VOTES as Readonly<Record<string, number>>)[String(viewerSeat)] ?? null);
  return {
    status: GameStatus.Ongoing,
    mySeat: viewerSeat,
    myRole,
    myEffectiveRole: myRole,
    template: createTemplateFromRoles([...WOLF_MEETING_ROLES]),
    seats: WOLF_MEETING_ROLES.map((role, seat) => expectedSeat(seat, role, viewerSeat, pack)),
    wolfPackSeats: pack,
    viewedSeats: [0, 1, 2, 3, 4, 5, 7],
    night: {
      actionSchema: SCHEMAS.wolfKill,
      currentActionRole: 'wolf',
      isActioner: pack !== null,
      confirmStatus: null,
      reveals: [],
      wolfVote: pack ? { votes: { ...WOLF_MEETING_VOTES }, myVote, deadlineAt: null } : null,
      pendingReveal: null,
      rejection: null,
      witchContext: null,
      wolfRobot: null,
      chooseCard: null,
      actorHint: null,
    },
    day: { sheriffSeat: null, mvpSeat: null },
  };
}

describe('getWerewolfViewModel — wolf meeting snapshot', () => {
  it.each([0, 1, 2])('pack member seat %i sees the pack and the wolf votes', (seat) => {
    expect(getWerewolfViewModel(wolfMeetingState(), player(seat))).toEqual(
      expectedWolfMeetingVm(seat, WOLF_PACK),
    );
  });

  it.each([3, 4, 5, 6, 7])('non-pack seat %i sees neither pack nor votes', (seat) => {
    expect(getWerewolfViewModel(wolfMeetingState(), player(seat))).toEqual(
      expectedWolfMeetingVm(seat, null),
    );
  });

  it('spectator (null) sees no roles, no pack, no votes', () => {
    expect(getWerewolfViewModel(wolfMeetingState(), player(null))).toEqual(
      expectedWolfMeetingVm(null, null),
    );
  });

  it('a non-meeting step hides the pack even from wolves (cross-check: client golden wolf x seerCheck)', () => {
    const state = createState({
      roles: WOLF_MEETING_ROLES,
      stepId: 'seerCheck',
      currentNightResults: { wolfVotesBySeat: { ...WOLF_MEETING_VOTES } },
    });
    const wolfVm = getWerewolfViewModel(state, player(0));
    expect(wolfVm.night.actionSchema?.kind).toBe('chooseSeat');
    expect(wolfVm.wolfPackSeats).toBeNull();
    expect(wolfVm.night.wolfVote).toBeNull();
    expect(getWerewolfViewModel(state, player(5)).myRole).toBe('seer');
  });
});

// =============================================================================
// Bottom-card snapshot (mirrors the Slice 0 client golden board exactly)
// =============================================================================

describe('getWerewolfViewModel — bottom-card boards at wolfKill', () => {
  // One bottom-card actor per board: the template factory rejects a board
  // with both a thief and a treasureMaster (getPlayerCount invariant).
  const thiefBoard = (): GameState =>
    createState({
      roles: ['wolf', 'thief', 'gargoyle', 'wolfRobot', 'seer'],
      templateRoles: ['wolf', 'thief', 'gargoyle', 'wolfRobot', 'seer', 'wolf', 'villager'],
      stepId: 'wolfKill',
      bottomCards: ['wolf', 'villager'],
      thiefSeat: 1,
      currentNightResults: { thiefChosenCard: 'wolf', wolfVotesBySeat: { '0': 4, '1': -1 } },
    });
  const treasureMasterBoard = (): GameState =>
    createState({
      roles: ['wolf', 'treasureMaster', 'gargoyle', 'wolfRobot', 'seer'],
      templateRoles: [
        'wolf',
        'treasureMaster',
        'gargoyle',
        'wolfRobot',
        'seer',
        'wolf',
        'villager',
      ],
      stepId: 'wolfKill',
      bottomCards: ['wolf', 'villager'],
      treasureMasterSeat: 1,
      currentNightResults: { treasureMasterChosenCard: 'wolf', wolfVotesBySeat: { '0': 4 } },
    });

  it('wolf sees pack [0, 1] (cross-check: client golden isWolf seats)', () => {
    const vm = getWerewolfViewModel(thiefBoard(), player(0));
    expect(vm.myRole).toBe('wolf');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toEqual([0, 1]);
    expect(vm.seats.map((s) => s.isWolfPackPeer)).toEqual([true, true, false, false, false]);
    expect(vm.night.wolfVote?.votes).toEqual({ '0': 4, '1': -1 });
  });

  it('thief who chose the wolf card joins the pack with effective role wolf', () => {
    const vm = getWerewolfViewModel(thiefBoard(), player(1));
    expect(vm.myRole).toBe('thief');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toEqual([0, 1]);
    expect(vm.seats[1]!.visibleRole).toBe('thief');
    expect(vm.night.isActioner).toBe(true);
  });

  it('treasureMaster who chose the wolf card sees the pack but is not in it (client golden quirk)', () => {
    const vm = getWerewolfViewModel(treasureMasterBoard(), player(1));
    expect(vm.myRole).toBe('treasureMaster');
    expect(vm.myEffectiveRole).toBe('wolf');
    // Matching-role branch of the former determineActionerState: showWolves = true...
    expect(vm.wolfPackSeats).toEqual([0]);
    expect(vm.night.wolfVote?.votes).toEqual({ '0': 4 });
    // ...yet the seat board exclusion keeps the treasureMaster seat itself
    // out of the pack (client golden isWolf[1] === false), and the bottom-card
    // wolf-vote exclusion keeps them from acting.
    expect(vm.seats[1]!.isWolfPackPeer).toBe(false);
    expect(vm.night.isActioner).toBe(true);
  });

  it('seer sees neither pack nor votes', () => {
    const vm = getWerewolfViewModel(thiefBoard(), player(4));
    expect(vm.wolfPackSeats).toBeNull();
    expect(vm.night.wolfVote).toBeNull();
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
    expect(getWerewolfViewModel(state, player(5)).night.confirmStatus).toEqual({
      role: 'hunter',
      canShoot: false,
    });
    expect(getWerewolfViewModel(state, player(5)).night.actionSchema?.kind).toBe('confirm');
    expect(getWerewolfViewModel(state, player(0)).night.confirmStatus).toBeNull();
    expect(getWerewolfViewModel(state, player(null)).night.confirmStatus).toBeNull();
  });

  it('a stored status is not exposed on a different step', () => {
    const state = hunterState('wolfKill');
    expect(getWerewolfViewModel(state, player(5)).night.confirmStatus).toBeNull();
  });

  it('hiddenWolf receives the wolf teammate list; wolves do not', () => {
    const state = createState({
      roles: ['hiddenWolf', 'wolf', 'wolf', 'villager'],
      stepId: 'hiddenWolfReveal',
      confirmStatus: { role: 'hiddenWolf', wolfTeammates: [1, 2] },
    });
    expect(getWerewolfViewModel(state, player(0)).night.confirmStatus).toEqual({
      role: 'hiddenWolf',
      wolfTeammates: [1, 2],
    });
    expect(getWerewolfViewModel(state, player(1)).night.confirmStatus).toBeNull();
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
    const vm = getWerewolfViewModel(state, player(0));
    expect(vm.myEffectiveRole).toBe('seedWolf');
    expect(vm.night.confirmStatus).toEqual({
      role: 'seedWolf',
      availability: 'available',
      targetSeat: 2,
    });
    expect(getWerewolfViewModel(state, player(2)).night.confirmStatus).toBeNull();
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
    expect(getWerewolfViewModel(state, player(1)).night.reveals).toEqual([
      {
        stepId: 'piperHypnotizedReveal',
        ackedSeats: [0, 1],
        hasAcked: true,
        isSubject: true,
        partnerSeat: null,
        subjectSeats: [1, 3],
      },
    ]);
    expect(getWerewolfViewModel(state, player(2)).night.reveals).toEqual([
      {
        stepId: 'piperHypnotizedReveal',
        ackedSeats: [0, 1],
        hasAcked: false,
        isSubject: false,
        partnerSeat: null,
        subjectSeats: null,
      },
    ]);
    expect(getWerewolfViewModel(state, player(null)).night.reveals[0]).toMatchObject({
      ackedSeats: [0, 1],
      hasAcked: false,
      isSubject: false,
      subjectSeats: null,
    });
    expect(getWerewolfViewModel(state, player(1)).night.actionSchema?.kind).toBe('groupConfirm');
  });

  it('cupid reveal: lovers learn each other, nobody else learns anything', () => {
    const state = createState({
      roles: ['cupid', 'villager', 'villager', 'villager', 'villager'],
      stepId: 'cupidLoversReveal',
      loverSeats: [1, 4],
      cupidLoversRevealAcks: [4],
    });
    expect(getWerewolfViewModel(state, player(1)).night.reveals[0]).toEqual({
      stepId: 'cupidLoversReveal',
      ackedSeats: [4],
      hasAcked: false,
      isSubject: true,
      partnerSeat: 4,
      subjectSeats: null,
    });
    expect(getWerewolfViewModel(state, player(4)).night.reveals[0]).toMatchObject({
      hasAcked: true,
      isSubject: true,
      partnerSeat: 1,
    });
    expect(getWerewolfViewModel(state, player(0)).night.reveals[0]).toMatchObject({
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
    expect(getWerewolfViewModel(state, player(2)).night.reveals[0]).toMatchObject({
      stepId: 'awakenedGargoyleConvertReveal',
      ackedSeats: [2, 3],
      hasAcked: true,
      isSubject: true,
    });
    expect(getWerewolfViewModel(state, player(3)).night.reveals[0]).toMatchObject({
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
    expect(getWerewolfViewModel(converted, player(2)).night.reveals[0]).toMatchObject({
      stepId: 'seedWolfInfectReveal',
      isSubject: true,
    });
    expect(getWerewolfViewModel(converted, player(1)).night.reveals[0]).toMatchObject({
      isSubject: false,
    });

    const failed = createState({
      roles: ['seedWolf', 'villager', 'villager', 'villager'],
      stepId: 'seedWolfInfectReveal',
      seedWolfInfectionResult: { outcome: 'failed', targetSeat: 2 },
    });
    expect(getWerewolfViewModel(failed, player(2)).night.reveals[0]).toMatchObject({
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
    expect(getWerewolfViewModel(state, player(1)).night.reveals).toEqual([]);
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
    const vm = getWerewolfViewModel(state, player(0));
    expect(vm.day).toEqual({ sheriffSeat: 3, mvpSeat: 4 });
    expect(vm.night.actionSchema).toBeNull();
    expect(vm.night.isActioner).toBe(false);
  });

  it('no-sheriff result and missing MVP project to null', () => {
    const state = createState({
      roles: ['villager', 'villager', 'villager'],
      status: GameStatus.Ended,
      sheriffElectionResult: { kind: 'noSheriff', reason: 'noCandidates' },
    });
    expect(getWerewolfViewModel(state, player(null)).day).toEqual({
      sheriffSeat: null,
      mvpSeat: null,
    });
  });

  it('assigned state (before the night) projects roles but no night step', () => {
    const state = createState({
      roles: WOLF_MEETING_ROLES,
      status: GameStatus.Assigned,
    });
    const vm = getWerewolfViewModel(state, player(0));
    expect(vm.status).toBe(GameStatus.Assigned);
    expect(vm.myRole).toBe('wolf');
    expect(vm.myEffectiveRole).toBe('wolf');
    expect(vm.wolfPackSeats).toBeNull();
    expect(vm.night).toEqual({
      actionSchema: null,
      currentActionRole: null,
      isActioner: false,
      confirmStatus: null,
      reveals: [],
      wolfVote: null,
      pendingReveal: null,
      rejection: null,
      witchContext: null,
      wolfRobot: null,
      chooseCard: null,
      actorHint: null,
    });
  });

  it('seat displayName falls back to 玩家 for an empty profile name', () => {
    const state = createState({ roles: ['wolf', 'villager', 'seer'] });
    const emptyName = (seat: number): WerewolfHumanSeat => ({
      seat,
      userId: `p${seat}`,
      profile: { displayName: '' },
    });
    const mutated: GameState = {
      ...state,
      roster: { ...state.roster, 1: emptyName(1), 2: emptyName(2) },
    };
    const vm = getWerewolfViewModel(mutated, player(null));
    expect(vm.seats.map((seat) => seat.displayName)).toEqual(['P0', '玩家', '玩家']);
  });

  it('throws fail-fast when a seated player has no roster occupant', () => {
    const state = createState({ roles: ['wolf', 'villager'] });
    const broken: GameState = { ...state, roster: {} };
    expect(() => getWerewolfViewModel(broken, player(0))).toThrow(
      '[FAIL-FAST] Werewolf seat 0 has game data without an occupant',
    );
  });
});

// =============================================================================
// Viewer-owned night facts (the rule half of the former client room hooks)
// =============================================================================

describe('getWerewolfViewModel — viewer and host visibility', () => {
  it('host sees bot seats’ roles; a player does not', () => {
    const state = createState({ roles: ['wolf', 'seer', 'villager'], botSeats: [1, 2] });
    const asHost = getWerewolfViewModel(state, host(0));
    expect(asHost.seats.map((s) => s.visibleRole)).toEqual(['wolf', 'seer', 'villager']);
    const asPlayer = getWerewolfViewModel(state, player(0));
    expect(asPlayer.seats.map((s) => s.visibleRole)).toEqual(['wolf', null, null]);
    const unseatedHost = getWerewolfViewModel(state, host(null));
    expect(unseatedHost.seats.map((s) => s.visibleRole)).toEqual([null, 'seer', 'villager']);
  });

  it('template is derived from templateRoles', () => {
    const state = createState({ roles: ['wolf', 'seer', 'villager'] });
    expect(getWerewolfViewModel(state, player(null)).template).toEqual(
      createTemplateFromRoles(['wolf', 'seer', 'villager']),
    );
  });
});

describe('getWerewolfViewModel — isActioner and seat constraints', () => {
  const seerStep = (actions: GameState['actions'] = []): GameState => ({
    ...createState({ roles: ['wolf', 'seer', 'villager'], stepId: 'seerCheck' }),
    actions,
  });

  it('the seer acts in seerCheck; others do not; the seer’s own seat is NotSelf-disabled', () => {
    const vm = getWerewolfViewModel(seerStep(), player(1));
    expect(vm.night.isActioner).toBe(true);
    expect(vm.night.currentActionRole).toBe('seer');
    expect(vm.seats.map((s) => s.disabledReason)).toEqual([null, '不能选择自己', null]);
    expect(getWerewolfViewModel(seerStep(), player(0)).night.isActioner).toBe(false);
    expect(getWerewolfViewModel(seerStep(), player(2)).night.isActioner).toBe(false);
    expect(getWerewolfViewModel(seerStep(), player(null)).night.isActioner).toBe(false);
  });

  it('constraints are not projected to non-actioners', () => {
    const vm = getWerewolfViewModel(seerStep(), player(0));
    expect(vm.seats.every((s) => s.disabledReason === null)).toBe(true);
  });

  it('a non-wolf role stops being the actioner once its action is recorded', () => {
    const acted = seerStep([{ schemaId: 'seerCheck', actorSeat: 1, targetSeat: 0, timestamp: 1 }]);
    expect(getWerewolfViewModel(acted, player(1)).night.isActioner).toBe(false);
  });

  it('wolves stay actioners during the meeting after voting (revote)', () => {
    const vm = getWerewolfViewModel(wolfMeetingState(), player(0));
    expect(vm.night.isActioner).toBe(true);
    expect(vm.night.wolfVote).toEqual({
      votes: { ...WOLF_MEETING_VOTES },
      myVote: 5,
      deadlineAt: null,
    });
    expect(getWerewolfViewModel(wolfMeetingState(), player(1)).night.wolfVote?.myVote).toBeNull();
  });

  it('wolf vote exposes the armed step deadline', () => {
    const state = wolfMeetingState();
    const armed: GameState = {
      ...state,
      nightStep: { kind: 'inStep', stepId: 'wolfKill', stepDeadline: 123_456 },
    };
    expect(getWerewolfViewModel(armed, player(0)).night.wolfVote?.deadlineAt).toBe(123_456);
  });

  it('groupConfirm: every seated viewer acts until they ack', () => {
    const state = createState({
      roles: ['wolf', 'piper', 'villager'],
      stepId: 'piperHypnotizedReveal',
      hypnotizedSeats: [2],
      piperRevealAcks: [0],
    });
    expect(getWerewolfViewModel(state, player(0)).night.isActioner).toBe(false);
    expect(getWerewolfViewModel(state, player(1)).night.isActioner).toBe(true);
    expect(getWerewolfViewModel(state, player(2)).night.isActioner).toBe(true);
  });
});

describe('getWerewolfViewModel — pendingReveal, rejection, witch, wolfRobot, chooseCard, hint', () => {
  it('pendingReveal names the recorded actor only', () => {
    const base = createState({ roles: ['wolf', 'seer', 'villager'], stepId: 'seerCheck' });
    const state: GameState = {
      ...base,
      actions: [{ schemaId: 'seerCheck', actorSeat: 1, targetSeat: 0, timestamp: 1 }],
      pendingRevealAcks: ['seerCheck'],
    };
    expect(getWerewolfViewModel(state, player(1)).night.pendingReveal).toEqual({
      schemaId: 'seerCheck',
      revealKind: SCHEMAS.seerCheck.ui!.revealKind,
    });
    expect(getWerewolfViewModel(state, player(0)).night.pendingReveal).toBeNull();
    expect(getWerewolfViewModel(state, player(null)).night.pendingReveal).toBeNull();
  });

  it('rejection is addressed to targetSeat only', () => {
    const base = createState({ roles: ['wolf', 'seer', 'villager'], stepId: 'seerCheck' });
    const state: GameState = {
      ...base,
      actionRejected: { action: 'seerCheck', reason: 'blocked', targetSeat: 1, rejectionId: 'r1' },
    };
    expect(getWerewolfViewModel(state, player(1)).night.rejection).toEqual({
      rejectionId: 'r1',
      action: 'seerCheck',
      reason: 'blocked',
    });
    expect(getWerewolfViewModel(state, player(0)).night.rejection).toBeNull();
  });

  it('witchContext reaches only the acting witch', () => {
    const base = createState({ roles: ['wolf', 'witch', 'villager'], stepId: 'witchAction' });
    const state: GameState = {
      ...base,
      witchContext: { killedSeat: 2, canSave: true, canPoison: true },
    };
    expect(getWerewolfViewModel(state, player(1)).night.witchContext).toEqual({
      killedSeat: 2,
      canSave: true,
      canPoison: true,
    });
    expect(getWerewolfViewModel(state, player(0)).night.witchContext).toBeNull();
  });

  it('wolfRobot view reaches only the wolf robot, with the hunter gate', () => {
    const base = createState({ roles: ['wolf', 'wolfRobot', 'hunter'], stepId: 'wolfRobotLearn' });
    const state: GameState = {
      ...base,
      wolfRobotReveal: {
        targetSeat: 2,
        result: 'hunter',
        learnedRoleId: 'hunter',
        canShootAsHunter: true,
      },
      wolfRobotHunterStatusViewed: false,
    };
    const vm = getWerewolfViewModel(state, player(1));
    expect(vm.night.wolfRobot).toEqual({
      targetSeat: 2,
      learnedRoleId: 'hunter',
      canShootAsHunter: true,
      isHunterStatusGatePending: true,
    });
    // Learn is done: no seat is pickable, so no constraint is projected.
    expect(vm.seats.every((s) => s.disabledReason === null)).toBe(true);
    expect(getWerewolfViewModel(state, player(0)).night.wolfRobot).toBeNull();
  });

  it('chooseCard: thief must take the wolf card; treasureMaster may not', () => {
    const thiefState = createState({
      roles: ['thief', 'wolf', 'villager'],
      templateRoles: ['thief', 'wolf', 'villager', 'wolf', 'seer'],
      stepId: 'thiefChoose',
      bottomCards: ['wolf', 'seer'],
      thiefSeat: 0,
    });
    expect(getWerewolfViewModel(thiefState, player(0)).night.chooseCard).toEqual({
      cards: [
        { roleId: 'wolf', isSelectable: true, reason: null },
        { roleId: 'seer', isSelectable: false, reason: '底牌中有狼人阵营的牌，必须选择狼人' },
      ],
      hint: '底牌含狼人阵营',
    });
    expect(getWerewolfViewModel(thiefState, player(1)).night.chooseCard).toBeNull();

    const tmState = createState({
      roles: ['treasureMaster', 'wolf', 'villager'],
      templateRoles: ['treasureMaster', 'wolf', 'villager', 'wolf', 'seer'],
      stepId: 'treasureMasterChoose',
      bottomCards: ['wolf', 'seer'],
      treasureMasterSeat: 0,
    });
    expect(getWerewolfViewModel(tmState, player(0)).night.chooseCard).toEqual({
      cards: [
        { roleId: 'wolf', isSelectable: false, reason: '不可选择狼人阵营底牌' },
        { roleId: 'seer', isSelectable: true, reason: null },
      ],
      hint: '你的阵营：狼人阵营',
    });
  });

  it('actorHint is addressed by effective role', () => {
    const base = createState({ roles: ['wolf', 'seer', 'villager'], stepId: 'wolfKill' });
    const hint = {
      kind: 'wolf_kill_disabled' as const,
      targetRoleIds: ['wolf' as RoleId],
      message: '今晚不能刀人',
      bottomAction: 'wolfEmptyOnly' as const,
    };
    const state: GameState = { ...base, ui: { currentActorHint: hint } };
    expect(getWerewolfViewModel(state, player(0)).night.actorHint).toEqual(hint);
    expect(getWerewolfViewModel(state, player(1)).night.actorHint).toBeNull();
  });
});
