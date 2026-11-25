/**
 * getWerewolfViewModel — what each viewer may see of the room.
 *
 * The current step's presentation is pinned by the board scenarios; this
 * file pins the viewer-relative cropping around it: own role, bot roles
 * for the host, wolf recognition, and the day fields.
 */

import { describe, expect, it } from 'vitest';

import { createGame } from '../../__tests__/boards/gameFactory';
import { executeStepsUntil } from '../../__tests__/boards/nightDriver';
import { createTemplateFromRoles, GameStatus, type RoleId } from '../models';
import type { GameState, WerewolfHumanSeat } from '../protocol/types';
import { getWerewolfViewModel, type WerewolfViewer } from '../visibility';

/** A non-host viewer at `seat` (null = unseated spectator). */
function player(seat: number | null): WerewolfViewer {
  return { seat, isHost: false };
}

/** The host viewing as `seat` (own seat or a controlled bot seat; null = unseated host). */
function host(seat: number | null): WerewolfViewer {
  return { seat, isHost: true };
}

interface StateSpec {
  readonly roles: readonly RoleId[];
  readonly status?: GameStatus;
  readonly botSeats?: readonly number[];
  readonly sheriffElectionResult?: GameState['sheriffElectionResult'];
  readonly mvpUserId?: string;
}

/** A dealt room outside the night; the view model reads it without validating it. */
function createState(spec: StateSpec): GameState {
  const players: GameState['players'] = {};
  const roster: Record<number, WerewolfHumanSeat | { seat: number; kind: 'bot' }> = {};
  spec.roles.forEach((role, seat) => {
    players[seat] = { seat, role };
    roster[seat] = spec.botSeats?.includes(seat)
      ? { seat, kind: 'bot' }
      : { seat, userId: `p${seat}`, profile: { displayName: `P${seat}` } };
  });
  return {
    gameType: 'werewolf',
    roomCode: 'TEST',
    hostUserId: 'host',
    status: spec.status ?? GameStatus.Assigned,
    templateRoles: [...spec.roles],
    players,
    roleViewedSeats: spec.roles.map((_, seat) => seat),
    roster,
    nightState: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    sheriffElectionResult: spec.sheriffElectionResult,
    mvpUserId: spec.mvpUserId,
  };
}

/** A real night on `roles` (seat order), played up to `stepId`. */
function nightAt(roles: readonly RoleId[], stepId: string): GameState {
  const context = createGame([...roles], new Map(roles.map((role, seat) => [seat, role])));
  if (!executeStepsUntil(context, stepId, {})) {
    throw new Error(`[TEST] The night ended before ${stepId}`);
  }
  return context.getGameState();
}

function packSeenBy(state: GameState, seat: number | null): readonly number[] | null {
  return getWerewolfViewModel(state, player(seat)).wolfPackSeats;
}

describe('getWerewolfViewModel — wolf recognition', () => {
  const MEETING_ROLES: readonly RoleId[] = [
    'wolf',
    'wolf',
    'seer',
    'witch',
    'villager',
    'villager',
  ];

  it('shows the pack to its members during the wolf meeting, and to nobody else', () => {
    const state = nightAt(MEETING_ROLES, 'wolfKill');

    expect(packSeenBy(state, 0)).toEqual([0, 1]);
    expect(packSeenBy(state, 1)).toEqual([0, 1]);
    expect(packSeenBy(state, 2)).toBeNull();
    expect(packSeenBy(state, null)).toBeNull();

    const asWolf = getWerewolfViewModel(state, player(0));
    expect(asWolf.seats.filter((seat) => seat.isWolfPackPeer).map((seat) => seat.seat)).toEqual([
      0, 1,
    ]);
    const asSeer = getWerewolfViewModel(state, player(2));
    expect(asSeer.seats.some((seat) => seat.isWolfPackPeer)).toBe(false);
  });

  it('hides the pack from wolves outside the meeting', () => {
    const state = nightAt(MEETING_ROLES, 'seerCheck');

    expect(packSeenBy(state, 0)).toBeNull();
    expect(packSeenBy(state, 2)).toBeNull();
  });

  it('shows the pack to the Wolf Girl alone while she confesses', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolfGirl', 'seer', 'villager', 'villager'];
    const state = nightAt(roles, 'wolfGirlConfess');

    expect(packSeenBy(state, 1)).toEqual([0, 1]);
    expect(packSeenBy(state, 0)).toBeNull();
    expect(packSeenBy(state, 2)).toBeNull();
  });
});

describe('getWerewolfViewModel — day fields and lifecycle', () => {
  it('projects sheriff seat and MVP seat from the day results', () => {
    const state = createState({
      roles: ['villager', 'villager', 'villager', 'villager', 'villager'],
      status: GameStatus.Ended,
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 3 },
      mvpUserId: 'p4',
    });

    const view = getWerewolfViewModel(state, player(0));

    expect(view.day).toEqual({ sheriffSeat: 3, mvpSeat: 4 });
    expect(view.step).toBeNull();
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

  it('a dealt room before the night shows the own role and no step', () => {
    const state = createState({ roles: ['wolf', 'wolf', 'seer', 'villager'] });

    const view = getWerewolfViewModel(state, player(0));

    expect(view.status).toBe(GameStatus.Assigned);
    expect(view.myRole).toBe('wolf');
    expect(view.wolfPackSeats).toBeNull();
    expect(view.step).toBeNull();
    expect(view.stepSeatStatuses).toEqual({});
    expect(view.personalDaytimeViews).toEqual([]);
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

    const view = getWerewolfViewModel(mutated, player(null));

    expect(view.seats.map((seat) => seat.displayName)).toEqual(['P0', '玩家', '玩家']);
  });

  it('throws fail-fast when a seated player has no roster occupant', () => {
    const state = createState({ roles: ['wolf', 'villager'] });
    const broken: GameState = { ...state, roster: {} };

    expect(() => getWerewolfViewModel(broken, player(0))).toThrow(
      '[FAIL-FAST] Werewolf seat 0 has game data without an occupant',
    );
  });
});

describe('getWerewolfViewModel — viewer and host visibility', () => {
  it('host sees bot seats’ roles; a player does not', () => {
    const state = createState({ roles: ['wolf', 'seer', 'villager'], botSeats: [1, 2] });

    const asHost = getWerewolfViewModel(state, host(0));
    expect(asHost.seats.map((seat) => seat.visibleRole)).toEqual(['wolf', 'seer', 'villager']);
    const asPlayer = getWerewolfViewModel(state, player(0));
    expect(asPlayer.seats.map((seat) => seat.visibleRole)).toEqual(['wolf', null, null]);
    const unseatedHost = getWerewolfViewModel(state, host(null));
    expect(unseatedHost.seats.map((seat) => seat.visibleRole)).toEqual([null, 'seer', 'villager']);
  });

  it('template is derived from templateRoles', () => {
    const state = createState({ roles: ['wolf', 'seer', 'villager'] });

    expect(getWerewolfViewModel(state, player(null)).template).toEqual(
      createTemplateFromRoles(['wolf', 'seer', 'villager']),
    );
  });
});
