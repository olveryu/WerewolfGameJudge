/**
 * Night review projection — characterization suite ported from the client
 * NightReview.helpers tests. Assertions are unchanged; fixtures are complete
 * GameState values (players as a seat record, recorded actions as protocol
 * actions) instead of the deleted LocalGameState.
 */

import { describe, expect, it } from 'vitest';

import { WEREWOLF_STATE_IDENTITY } from '../../../state/version';
import type { DeathReason } from '../../DeathCalculator';
import { GameStatus, ROLE_SPECS, type RoleId } from '../../models';
import { NIGHT_STEPS, type RoleSpec } from '../../models/roles/spec';
import { getRoleStepId } from '../../models/roles/spec/nightSteps';
import type {
  GameState,
  Player,
  ProtocolAction,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
} from '../../protocol/types';
import {
  buildActionEntries,
  buildIdentityEntries,
  deriveDeathNotes,
  deriveNightReportStats,
  deriveSheriffSection,
  deriveWolfTargetSaveNote,
  deriveWolfVerdict,
  getNightReviewOutcome,
  getWerewolfNightReview,
  type NightReviewActionEntry,
  nightReviewActorRoleId,
  type WerewolfNightReview,
} from '../nightReview';

type Players = Map<number, Player | null>;

/** A recorded single-target action, in the fixture's role-keyed form. */
function makeActionTarget(targetSeat: number): {
  readonly kind: 'target';
  readonly targetSeat: number;
} {
  return { kind: 'target', targetSeat };
}

/** Role-keyed fixture actions → protocol actions (the actor seat is the role's seat). */
function toProtocolActions(
  actions: ReadonlyMap<RoleId, ReturnType<typeof makeActionTarget>>,
  players: Players,
): ProtocolAction[] {
  const result: ProtocolAction[] = [];
  let timestamp = 1;
  for (const [roleId, action] of actions) {
    const actorSeat = [...players.entries()].find(([, p]) => p?.role === roleId)?.[0];
    if (actorSeat === undefined) {
      throw new Error(`Fixture records an action for ${roleId} with no seated player`);
    }
    result.push({
      schemaId: getRoleStepId(roleId),
      actorSeat,
      targetSeat: action.targetSeat,
      timestamp,
    });
    timestamp += 1;
  }
  return result;
}

function toPlayersRecord(players: Players): GameState['players'] {
  const record: Record<number, Player | null> = {};
  for (const [seat, player] of players) record[seat] = player;
  return record;
}

function toRoster(players: Players): GameState['roster'] {
  const roster: Record<number, { seat: number; userId: string; profile: { displayName: string } }> =
    {};
  for (const [seat, player] of players) {
    if (player)
      roster[seat] = { seat, userId: `uid-${seat}`, profile: { displayName: `P${seat}` } };
  }
  return roster;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a complete GameState for the review projection. */
function makeGameState(
  overrides: Partial<{
    currentNightResults: NonNullable<GameState['currentNightResults']>;
    lastNightDeaths: number[];
    deathReasons: Record<number, DeathReason>;
    players: Players;
    actions: Map<RoleId, ReturnType<typeof makeActionTarget>>;
    seerReveal: { targetSeat: number; result: '好人' | '狼人' };
    wolfRobotReveal: { targetSeat: number; result: string; learnedRoleId: string };
    bottomCards: readonly RoleId[];
    treasureMasterChosenCard: RoleId;
    thiefChosenCard: RoleId;
    witchContext: { killedSeat: number; canSave: boolean; canPoison: boolean };
    loverSeats: readonly [number, number];
    seedWolfInfectionResult: GameState['seedWolfInfectionResult'];
    sheriffElection: SheriffElectionState;
    sheriffElectionResult: SheriffElectionResult;
    resolvedWolfKillTarget: number | null;
    resolvedWolfKillVerdict: GameState['resolvedWolfKillVerdict'];
    mirrorSeerReveal: GameState['mirrorSeerReveal'];
    drunkSeerReveal: GameState['drunkSeerReveal'];
    psychicReveal: GameState['psychicReveal'];
    gargoyleReveal: GameState['gargoyleReveal'];
    pureWhiteReveal: GameState['pureWhiteReveal'];
    wolfWitchReveal: GameState['wolfWitchReveal'];
  }> = {},
): GameState {
  const players: Players = overrides.players ?? new Map<number, Player | null>();
  const state: GameState = {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'REVIEW',
    hostUserId: 'host',
    status: GameStatus.Day,
    templateRoles: [],
    players: toPlayersRecord(players),
    roleViewedSeats: [],
    roster: toRoster(players),
    nightStep: null,
    isAudioPlaying: false,
    audioBatchId: 0,
    gameSequence: 0,
    pendingAudioEffects: [],
    actions: toProtocolActions(overrides.actions ?? new Map(), players),
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    currentNightResults: {
      ...(overrides.currentNightResults ?? {}),
      ...(overrides.treasureMasterChosenCard
        ? { treasureMasterChosenCard: overrides.treasureMasterChosenCard }
        : {}),
      ...(overrides.thiefChosenCard ? { thiefChosenCard: overrides.thiefChosenCard } : {}),
    },
    lastNightDeaths: overrides.lastNightDeaths ?? [],
  };
  const optional: Partial<GameState> = {};
  if (overrides.deathReasons) optional.deathReasons = overrides.deathReasons;
  if (overrides.seerReveal) optional.seerReveal = overrides.seerReveal;
  if (overrides.mirrorSeerReveal) optional.mirrorSeerReveal = overrides.mirrorSeerReveal;
  if (overrides.drunkSeerReveal) optional.drunkSeerReveal = overrides.drunkSeerReveal;
  if (overrides.psychicReveal) optional.psychicReveal = overrides.psychicReveal;
  if (overrides.gargoyleReveal) optional.gargoyleReveal = overrides.gargoyleReveal;
  if (overrides.pureWhiteReveal) optional.pureWhiteReveal = overrides.pureWhiteReveal;
  if (overrides.wolfWitchReveal) optional.wolfWitchReveal = overrides.wolfWitchReveal;
  if (overrides.wolfRobotReveal) {
    optional.wolfRobotReveal = {
      ...overrides.wolfRobotReveal,
      learnedRoleId: overrides.wolfRobotReveal.learnedRoleId as RoleId,
    };
  }
  if (overrides.bottomCards) optional.bottomCards = overrides.bottomCards;
  if (overrides.witchContext) optional.witchContext = overrides.witchContext;
  if (overrides.loverSeats) optional.loverSeats = overrides.loverSeats;
  if (overrides.seedWolfInfectionResult) {
    optional.seedWolfInfectionResult = overrides.seedWolfInfectionResult;
  }
  if (overrides.sheriffElection) optional.sheriffElection = overrides.sheriffElection;
  if (overrides.sheriffElectionResult) {
    optional.sheriffElectionResult = overrides.sheriffElectionResult;
  }
  if (overrides.resolvedWolfKillTarget !== undefined) {
    optional.resolvedWolfKillTarget = overrides.resolvedWolfKillTarget;
  }
  if (overrides.resolvedWolfKillVerdict !== undefined) {
    optional.resolvedWolfKillVerdict = overrides.resolvedWolfKillVerdict;
  }
  return { ...state, ...optional };
}

function makePlayer(seat: number, role: string | null): Player {
  return { seat, role: role as RoleId | null };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NightReview.helpers', () => {
  describe('buildActionEntries', () => {
    it('returns peaceful night when no deaths and no actions', () => {
      const entries = buildActionEntries(makeGameState());
      expect(entries).toEqual([{ kind: 'peacefulNight' }]);
    });

    it('shows wolf votes', () => {
      const entries = buildActionEntries(
        makeGameState({
          currentNightResults: {
            wolfVotesBySeat: { '2': 4, '3': 4 },
          },
        }),
      );
      expect(entries[0]).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 2, targetSeat: 4 },
          { voterSeat: 3, targetSeat: 4 },
        ],
        abstainSeats: [],
      });
    });

    it('shows guard protection', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'guard')]]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { guardedSeat: 1 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'guard', actorSeat: 0, targetSeat: 1 }),
      );
    });

    it('shows witch save and poison', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'witch')]]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { savedSeat: 3, poisonedSeat: 5 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'save', actorSeat: 0, targetSeat: 3 }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'poison',
          actorSeat: 0,
          actorRoleId: 'witch',
          targetSeat: 5,
        }),
      );
    });

    it('shows nightmare block', () => {
      const players = new Map<number, Player | null>([[1, makePlayer(1, 'nightmare')]]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'nightmareBlock',
          actorSeat: 1,
          targetSeat: 0,
          targetRoleId: null,
        }),
      );
    });

    it('shows dreamcatcher protection', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'dreamcatcher')]]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { dreamingSeat: 2 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'dream', actorSeat: 0, targetSeat: 2 }),
      );
    });

    it('shows magician swap', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'magician')]]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { swappedSeats: [1, 4] } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'swap', actorSeat: 0, seats: [1, 4] }),
      );
    });

    it('shows seer reveal', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'seer')]]);
      const entries = buildActionEntries(
        makeGameState({ players, seerReveal: { targetSeat: 2, result: '狼人' } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'check',
          actorSeat: 0,
          actorRoleId: 'seer',
          targetSeat: 2,
          result: '狼人',
        }),
      );
    });

    it('shows wolf robot learn', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'wolfRobot')]]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          wolfRobotReveal: { targetSeat: 5, result: '猎人', learnedRoleId: 'hunter' },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'learn',
          actorSeat: 0,
          targetSeat: 5,
          learnedRoleId: 'hunter',
        }),
      );
    });

    it('shows death list', () => {
      const entries = buildActionEntries(makeGameState({ lastNightDeaths: [0, 3] }));
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'deaths',
          deaths: [
            { seat: 0, reason: null },
            { seat: 3, reason: null },
          ],
        }),
      );
    });

    it('shows death list with reason labels when deathReasons present', () => {
      const entries = buildActionEntries(
        makeGameState({
          lastNightDeaths: [0, 3],
          deathReasons: { 0: 'wolfKill', 3: 'poison' },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'deaths',
          deaths: [
            { seat: 0, reason: 'wolfKill' },
            { seat: 3, reason: 'poison' },
          ],
        }),
      );
    });

    it('shows death list without labels when deathReasons is undefined', () => {
      const entries = buildActionEntries(makeGameState({ lastNightDeaths: [0, 3] }));
      const deaths = entries.find((entry) => entry.kind === 'deaths');
      expect(deaths).toEqual(
        expect.objectContaining({
          deaths: [
            { seat: 0, reason: null },
            { seat: 3, reason: null },
          ],
        }),
      );
    });

    it('shows all death reason types correctly', () => {
      const entries = buildActionEntries(
        makeGameState({
          lastNightDeaths: [0, 1, 2],
          deathReasons: { 0: 'wolfKill', 1: 'coupleLink', 2: 'magicianSwap' },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'deaths',
          deaths: [
            { seat: 0, reason: 'wolfKill' },
            { seat: 1, reason: 'coupleLink' },
            { seat: 2, reason: 'magicianSwap' },
          ],
        }),
      );
    });

    it('shows wolf kill disabled', () => {
      const entries = buildActionEntries(
        makeGameState({
          currentNightResults: {
            wolfKillOverride: {
              source: 'nightmare',
              ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
            },
          },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'wolfGiveUp', reason: 'nightmareBlock' }),
      );
    });

    it('shows bottom cards composition', () => {
      const entries = buildActionEntries(
        makeGameState({
          bottomCards: ['seer', 'guard', 'villager'],
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'bottomCards',
          roleIds: ['seer', 'guard', 'villager'],
        }),
      );
    });

    it('shows treasureMaster chosen card', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'treasureMaster')]]);
      const entries = buildActionEntries(
        makeGameState({ players, treasureMasterChosenCard: 'seer' }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'cardChoice',
          actorSeat: 0,
          actorRoleId: 'treasureMaster',
          chosenRoleId: 'seer',
        }),
      );
    });

    it('shows slacker idol choice', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'slacker')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['slacker', makeActionTarget(3)],
      ]);
      const entries = buildActionEntries(makeGameState({ players, actions }));
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'idolChoice',
          actorSeat: 0,
          actorRoleId: 'slacker',
          targetSeat: 3,
        }),
      );
    });

    it('shows wildChild idol choice', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'wildChild')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['wildChild', makeActionTarget(1)],
      ]);
      const entries = buildActionEntries(makeGameState({ players, actions }));
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'idolChoice',
          actorSeat: 0,
          actorRoleId: 'wildChild',
          targetSeat: 1,
        }),
      );
    });

    it('shows wolfQueen charm', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'wolfQueen')]]);
      const actions: Map<RoleId, ReturnType<typeof makeActionTarget>> = new Map([
        ['wolfQueen', makeActionTarget(4)],
      ]);
      const entries = buildActionEntries(makeGameState({ players, actions }));
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'charm', actorSeat: 0, targetSeat: 4 }),
      );
    });

    it('shows successful Seed Wolf infection', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'seedWolf')]]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 3 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'infectConverted', actorSeat: 0, targetSeat: 3 }),
      );
    });

    it('shows failed Seed Wolf infection', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'seedWolf')]]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          seedWolfInfectionResult: { outcome: 'failed', targetSeat: 3 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'infectFailed', actorSeat: 0, targetSeat: 3 }),
      );
    });

    it('shows unused Seed Wolf infection', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, 'seedWolf')]]);
      const entries = buildActionEntries(
        makeGameState({ players, seedWolfInfectionResult: { outcome: 'notUsed' } }),
      );
      expect(entries).toContainEqual(expect.objectContaining({ kind: 'infectIdle', actorSeat: 0 }));
    });

    it('shows hunter can shoot when not poisoned', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: true,
        }),
      );
    });

    it('shows hunter cannot shoot when poisoned', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'witch')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { poisonedSeat: 0 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: false,
        }),
      );
    });

    it('shows darkWolfKing can shoot when not poisoned', () => {
      const players = new Map<number, Player | null>([[2, makePlayer(2, 'darkWolfKing')]]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 2,
          actorRoleId: 'darkWolfKing',
          canShoot: true,
        }),
      );
    });

    it('shows darkWolfKing cannot shoot when poisoned', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [2, makePlayer(2, 'darkWolfKing')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { poisonedSeat: 2 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 2,
          actorRoleId: 'darkWolfKing',
          canShoot: false,
        }),
      );
    });

    it('shows hunter cannot shoot when dream-linked death (dreamcatcher killed)', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'dreamcatcher')],
        [2, makePlayer(2, 'witch')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: { dreamingSeat: 0, poisonedSeat: 1 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: false,
        }),
      );
    });

    it('shows hunter can shoot when dream target but dreamcatcher alive', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'dreamcatcher')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: { dreamingSeat: 0 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: true,
        }),
      );
    });

    it('shows hunter cannot shoot when wolfQueen charm victim (wolfQueen killed)', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'wolfQueen')],
        [2, makePlayer(2, 'witch')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: { charmedSeat: 0, poisonedSeat: 1 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: false,
        }),
      );
    });

    it('shows hunter cannot shoot when couple death (partner wolf-killed)', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'hunter')],
        [1, makePlayer(1, 'villager')],
        [2, makePlayer(2, 'cupid')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          loverSeats: [0, 1],
          witchContext: { killedSeat: 1, canSave: true, canPoison: true },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'shootStatus',
          actorSeat: 0,
          actorRoleId: 'hunter',
          canShoot: false,
        }),
      );
    });

    // ── P3: Wolf empty kill (empty knife) ──

    it('shows wolf empty kill when wolves present but no votes and no override', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(expect.objectContaining({ kind: 'wolfNoTarget' }));
    });

    it('does not show wolf empty kill when wolfKillOverride is present', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: {
            wolfKillOverride: {
              source: 'nightmare',
              ui: { promptTitle: 't', promptMessage: 'm', emptyVoteText: 'e', rejectMessage: 'r' },
            },
          },
        }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('wolfNoTarget');
      expect(kinds).toContain('wolfGiveUp');
    });

    it('does not show wolf empty kill when no wolves in game', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'villager')],
        [1, makePlayer(1, 'seer')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('wolfNoTarget');
    });

    // ── P2: Nightmare block role name ──

    it('shows nightmare block with role name', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'nightmareBlock',
          actorSeat: 1,
          targetSeat: 0,
          targetRoleId: 'guard',
        }),
      );
    });

    // ── P1: Guard "did nothing" ──

    it('shows guard did nothing when guard present but not guarding', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(expect.objectContaining({ kind: 'guardIdle', actorSeat: 0 }));
    });

    it('does not show guard did nothing when guard is blocked by nightmare', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'guard')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('guardIdle');
    });

    // ── P1: Witch "did nothing" ──

    it('shows witch did nothing when witch present and used neither potion', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'witchIdleAll', actorSeat: 0 }),
      );
    });

    it('shows witch did not use save when witch saved nothing but poisoned', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'witchNoSave', actorSeat: 0 }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('witchIdleAll');
    });

    it('shows witch did not use poison when witch saved but did not poison', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { savedSeat: 1 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'witchNoPoison', actorSeat: 0 }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('witchNoSave');
    });

    it('does not show witch did nothing when witch is blocked by nightmare', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'nightmare')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { blockedSeat: 0 } }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('witchIdleAll');
      expect(kinds).not.toContain('witchNoSave');
      expect(kinds).not.toContain('witchNoPoison');
    });

    it('shows poisoner did nothing when poisoner present but did not poison', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'poisoner')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'poisonerNoPoison', actorSeat: 0 }),
      );
    });

    it('witch does not show poison unused when poisoner owns the poison', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'poisoner')],
      ]);
      const entries = buildActionEntries(makeGameState({ players }));
      // Witch shows "did not use save", NOT "did not use poison" (poisoner owns poison)
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'witchNoSave', actorSeat: 0 }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'poisonerNoPoison', actorSeat: 1 }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('witchNoPoison');
      expect(kinds).not.toContain('witchIdleAll');
    });

    // ── P2: double-save warning ──

    it('shows 同守同救 warning when guard and witch both save wolf target', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 3 },
            guardedSeat: 3,
            savedSeat: 3,
          },
          lastNightDeaths: [3],
          resolvedWolfKillTarget: 3,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 3 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'guardSaveConflict', targetSeat: 3 }),
      );
    });

    // ── P3: Poison immunity warning ──

    it('shows poison immunity warning when poisoned target is immune', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'witcher')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'poisonImmune',
          targetSeat: 1,
          targetRoleId: 'witcher',
        }),
      );
    });

    it('does not show poison immunity for non-immune target', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'witch')],
        [1, makePlayer(1, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({ players, currentNightResults: { poisonedSeat: 1 } }),
      );
      const kinds = entries.map((entry) => entry.kind);
      expect(kinds).not.toContain('poisonImmune');
    });

    // ── P3: Damage reflection warning ──

    it('shows reflection warning when seer checks a reflectsDamage target', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'seer')],
        [1, makePlayer(1, 'spiritKnight')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          seerReveal: { targetSeat: 1, result: '狼人' },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          kind: 'reflectDamage',
          checkerRoleId: 'seer',
          targetSeat: 1,
          targetRoleId: 'spiritKnight',
        }),
      );
    });
  });

  describe('buildIdentityEntries', () => {
    it('returns empty for no players', () => {
      expect(buildIdentityEntries({}, new Set())).toEqual([]);
    });

    it('builds identity list sorted by seat', () => {
      const players = new Map<number, Player | null>([
        [2, makePlayer(2, 'seer')],
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'villager')],
      ]);
      expect(buildIdentityEntries(toPlayersRecord(players), new Set())).toEqual([
        { seat: 0, roleId: 'wolf', isEmptySeat: false, isAlive: true },
        { seat: 1, roleId: 'villager', isEmptySeat: false, isAlive: true },
        { seat: 2, roleId: 'seer', isEmptySeat: false, isAlive: true },
      ]);
    });

    it('shows empty seat', () => {
      const players = new Map<number, Player | null>([[0, null]]);
      expect(buildIdentityEntries(toPlayersRecord(players), new Set())).toEqual([
        { seat: 0, roleId: null, isEmptySeat: true, isAlive: true },
      ]);
    });

    it('shows unassigned role', () => {
      const players = new Map<number, Player | null>([[0, makePlayer(0, null)]]);
      expect(buildIdentityEntries(toPlayersRecord(players), new Set())).toEqual([
        { seat: 0, roleId: null, isEmptySeat: false, isAlive: true },
      ]);
    });
  });

  describe('contract: every NIGHT_STEPS role produces an entry', () => {
    it('buildActionEntries covers all night-action roles', () => {
      // Build a maximal game state with ALL roles' night actions populated
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'nightmare')],
        [2, makePlayer(2, 'guard')],
        [3, makePlayer(3, 'witch')],
        [4, makePlayer(4, 'dreamcatcher')],
        [5, makePlayer(5, 'magician')],
        [6, makePlayer(6, 'hunter')],
        [7, makePlayer(7, 'darkWolfKing')],
        [8, makePlayer(8, 'seer')],
        [9, makePlayer(9, 'mirrorSeer')],
        [10, makePlayer(10, 'drunkSeer')],
        [11, makePlayer(11, 'psychic')],
        [12, makePlayer(12, 'gargoyle')],
        [13, makePlayer(13, 'pureWhite')],
        [14, makePlayer(14, 'wolfWitch')],
        [15, makePlayer(15, 'wolfRobot')],
        [16, makePlayer(16, 'wolfQueen')],
        [17, makePlayer(17, 'slacker')],
        [18, makePlayer(18, 'wildChild')],
        [19, makePlayer(19, 'silenceElder')],
        [20, makePlayer(20, 'votebanElder')],
        [21, makePlayer(21, 'piper')],
        [22, makePlayer(22, 'awakenedGargoyle')],
        [23, makePlayer(23, 'shadow')],
        [24, makePlayer(24, 'avenger')],
        [25, makePlayer(25, 'crow')],
        [26, makePlayer(26, 'poisoner')],
        [27, makePlayer(27, 'treasureMaster')],
        [28, makePlayer(28, 'thief')],
        [29, makePlayer(29, 'cupid')],
        [30, makePlayer(30, 'eclipseWolfQueen')],
        [31, makePlayer(31, 'hiddenWolf')],
        [32, makePlayer(32, 'seedWolf')],
      ]);

      const actions = new Map<RoleId, ReturnType<typeof makeActionTarget>>([
        ['slacker', makeActionTarget(0)],
        ['wildChild', makeActionTarget(1)],
        ['wolfQueen', makeActionTarget(2)],
      ]);

      const gs = makeGameState({
        currentNightResults: {
          wolfVotesBySeat: { '0': 8 },
          blockedSeat: 3,
          guardedSeat: 4,
          silencedSeat: 19,
          votebannedSeat: 20,
          savedSeat: 5,
          poisonedSeat: 99, // non-existent seat so hunter/darkWolfKing can shoot
          dreamingSeat: 6,
          swappedSeats: [7, 8],
          hypnotizedSeats: [2, 10],
          convertedSeat: 11,
          shadowMimicTarget: 3,
          cursedSeat: 12,
          shelteredSeat: 13,
          treasureMasterChosenCard: 'seer',
        },
        lastNightDeaths: [8],
        players,
        actions,
        seerReveal: { targetSeat: 0, result: '好人' },
        mirrorSeerReveal: { targetSeat: 1, result: '狼人' },
        drunkSeerReveal: { targetSeat: 2, result: '好人' },
        psychicReveal: { targetSeat: 3, result: '女巫' },
        gargoyleReveal: { targetSeat: 4, result: '预言家' },
        pureWhiteReveal: { targetSeat: 5, result: '守卫' },
        wolfWitchReveal: { targetSeat: 6, result: '猎人' },
        wolfRobotReveal: { targetSeat: 7, result: '猎人', learnedRoleId: 'hunter' },
        loverSeats: [28, 29],
      });

      const { treasureMasterChosenCard: _tm, ...withoutTreasureCard } = gs.currentNightResults!;
      const thiefState: GameState = {
        ...gs,
        currentNightResults: { ...withoutTreasureCard, thiefChosenCard: 'villager' },
      };
      const entries = [...buildActionEntries(gs), ...buildActionEntries(thiefState)];
      const roles = new Set<RoleId>();
      for (const entry of entries) {
        const actor = nightReviewActorRoleId(entry);
        if (actor !== null) roles.add(actor);
        if (
          entry.kind === 'wolfAttack' ||
          entry.kind === 'wolfNoTarget' ||
          entry.kind === 'wolfGiveUp'
        ) {
          roles.add('wolf');
        }
        if (entry.kind === 'bottomCards') {
          for (const roleId of entry.roleIds) roles.add(roleId);
        }
        if (entry.kind === 'reflectDamage') {
          roles.add(entry.checkerRoleId);
          roles.add(entry.targetRoleId);
        }
        if (entry.kind === 'poisonImmune') roles.add(entry.targetRoleId);
      }

      // Every NIGHT_STEPS role must produce an entry that names it as actor
      // (or, for the wolf team, as the team behind a wolf entry).
      for (const step of NIGHT_STEPS) {
        expect(roles.has(step.roleId)).toBe(true);
      }
    });
  });

  describe('contract: skipped actions — every canSkip role still produces an entry', () => {
    /**
     * Derive all roles that have canSkip: true from ROLE_SPECS.
     * When a role skips its action, it must still produce an entry.
     */
    it('buildActionEntries covers all canSkip roles when they skip', () => {
      // Collect all roles with canSkip: true
      const canSkipRoleIds: RoleId[] = [];
      for (const [roleId, spec] of Object.entries(ROLE_SPECS)) {
        const abilities = (spec as RoleSpec).abilities;
        if (abilities?.some((a) => a.type === 'active' && a.canSkip)) {
          canSkipRoleIds.push(roleId as RoleId);
        }
      }
      // Sanity: we expect a meaningful number of canSkip roles
      expect(canSkipRoleIds.length).toBeGreaterThanOrEqual(15);

      // Build players map with all canSkip roles, each on a separate seat
      const players = new Map<number, Player | null>();
      canSkipRoleIds.forEach((roleId, idx) => {
        players.set(idx, makePlayer(idx, roleId));
      });

      // Empty night results + empty actions = all roles skipped
      const gs = makeGameState({
        players,
        currentNightResults: {},
      });

      const entries = buildActionEntries(gs);
      const roles = new Set<RoleId>();
      for (const entry of entries) {
        const actor = nightReviewActorRoleId(entry);
        if (actor !== null) roles.add(actor);
        if (
          entry.kind === 'wolfAttack' ||
          entry.kind === 'wolfNoTarget' ||
          entry.kind === 'wolfGiveUp'
        ) {
          roles.add('wolf');
        }
      }

      for (const roleId of canSkipRoleIds) {
        expect(roles.has(roleId)).toBe(true);
      }
    });
  });

  describe('buildWerewolfNightReview', () => {
    it('returns both sections', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'seer')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [0],
        }),
      );
      expect(data.actions.length).toBeGreaterThan(0);
      expect(data.identities.length).toBe(2);
      // Seat 0 died last night (lastNightDeaths: [0]); seat 1 is alive.
      expect(data.identities[0]).toEqual({
        seat: 0,
        roleId: 'wolf',
        isEmptySeat: false,
        isAlive: false,
      });
      expect(data.identities[1]).toEqual({
        seat: 1,
        roleId: 'seer',
        isEmptySeat: false,
        isAlive: true,
      });
    });
  });

  describe('structured entries', () => {
    it('emits exactly one peacefulNight entry for an empty night', () => {
      expect(buildActionEntries(makeGameState())).toEqual([{ kind: 'peacefulNight' }]);
    });

    it('carries wolf votes as structured voter/target pairs', () => {
      const entries = buildActionEntries(
        makeGameState({ currentNightResults: { wolfVotesBySeat: { '2': 4, '3': 4 } } }),
      );
      expect(entries[0]).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 2, targetSeat: 4 },
          { voterSeat: 3, targetSeat: 4 },
        ],
        abstainSeats: [],
      });
    });

    it('splits abstain votes (engine sentinel -1) out of the wolfAttack votes', () => {
      const entries = buildActionEntries(
        makeGameState({
          currentNightResults: { wolfVotesBySeat: { '6': 5, '7': 5, '11': -1, '8': 4 } },
        }),
      );
      expect(entries[0]).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 6, targetSeat: 5 },
          { voterSeat: 7, targetSeat: 5 },
          { voterSeat: 8, targetSeat: 4 },
        ],
        abstainSeats: [11],
      });
    });

    it('keeps an all-abstain night as a wolfAttack entry with empty votes', () => {
      const entries = buildActionEntries(
        makeGameState({ currentNightResults: { wolfVotesBySeat: { '0': -1, '1': -1 } } }),
      );
      expect(entries[0]).toEqual({ kind: 'wolfAttack', votes: [], abstainSeats: [0, 1] });
    });

    it('fails fast on an invalid negative wolf vote target', () => {
      expect(() =>
        buildActionEntries(
          makeGameState({ currentNightResults: { wolfVotesBySeat: { '0': -3 } } }),
        ),
      ).toThrow(/Invalid wolf vote target/);
    });

    it('keeps abstentions as abstainSeats, never as seat 0', () => {
      const entries = buildActionEntries(
        makeGameState({
          currentNightResults: { wolfVotesBySeat: { '6': 5, '11': -1 } },
        }),
      );
      const attack = entries.find((entry) => entry.kind === 'wolfAttack');
      expect(attack).toEqual(
        expect.objectContaining({
          votes: [{ voterSeat: 6, targetSeat: 5 }],
          abstainSeats: [11],
        }),
      );
    });

    it('does not let an abstention manufacture a tie for the guard-save conflict', () => {
      // One real vote on seat 4 (index 3) plus one abstention: the engine
      // verdict still names seat 3 as the wolf target, so the 同守同救
      // annotation (guard + save on that target) stays reachable.
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'guard')],
        [3, makePlayer(3, 'villager')],
        [4, makePlayer(4, 'witch')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 3, '1': -1 },
            guardedSeat: 3,
            savedSeat: 3,
          },
          lastNightDeaths: [3],
          resolvedWolfKillTarget: 3,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 3 },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({ kind: 'guardSaveConflict', targetSeat: 3 }),
      );
    });

    it('carries deaths with their reasons in order', () => {
      const entries = buildActionEntries(
        makeGameState({
          lastNightDeaths: [0, 3],
          deathReasons: { 0: 'wolfKill', 3: 'poison' },
        }),
      );
      expect(entries[entries.length - 1]).toEqual({
        kind: 'deaths',
        deaths: [
          { seat: 0, reason: 'wolfKill' },
          { seat: 3, reason: 'poison' },
        ],
      });
    });

    it('keeps the fact order of a composed night as an entry kind sequence', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'seer')],
        [4, makePlayer(4, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 4 },
            guardedSeat: 4,
            savedSeat: 4,
          },
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [4],
          deathReasons: { 4: 'wolfKill' },
          resolvedWolfKillTarget: 4,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 4 },
        }),
      );
      const kinds: NightReviewActionEntry['kind'][] = entries.map((entry) => entry.kind);
      expect(kinds).toEqual([
        'wolfAttack',
        'guard',
        'save',
        'witchNoPoison',
        'check',
        'guardSaveConflict',
        'deaths',
      ]);
    });

    it('builds identity entries for empty and unassigned seats', () => {
      const players = new Map<number, Player | null>([
        [0, null],
        [1, makePlayer(1, null)],
        [2, makePlayer(2, 'wolf')],
      ]);
      const entries = buildIdentityEntries(toPlayersRecord(players), new Set([2]));
      expect(entries).toEqual([
        { seat: 0, roleId: null, isEmptySeat: true, isAlive: true },
        { seat: 1, roleId: null, isEmptySeat: false, isAlive: true },
        { seat: 2, roleId: 'wolf', isEmptySeat: false, isAlive: false },
      ]);
    });
  });

  describe('getNightReviewOutcome', () => {
    it('derives the deaths outcome with seats and reasons from built data', () => {
      const data = getWerewolfNightReview(
        makeGameState({
          lastNightDeaths: [5, 2],
          deathReasons: { 5: 'poison', 2: 'wolfKill' },
        }),
      );
      expect(getNightReviewOutcome(data)).toEqual({
        type: 'deaths',
        deaths: [
          { seat: 5, reason: 'poison' },
          { seat: 2, reason: 'wolfKill' },
        ],
      });
    });

    it('derives the peaceful outcome when nobody died', () => {
      const data = getWerewolfNightReview(makeGameState({}));
      expect(getNightReviewOutcome(data)).toEqual({ type: 'peaceful' });
    });

    it('fails fast when the data carries no outcome entry', () => {
      const data: WerewolfNightReview = { actions: [{ kind: 'wolfNoTarget' }], identities: [] };
      expect(() => getNightReviewOutcome(data)).toThrow(/no outcome entry/);
    });

    it('fails fast when the data carries more than one outcome entry', () => {
      const data: WerewolfNightReview = {
        actions: [{ kind: 'peacefulNight' }, { kind: 'deaths', deaths: [] }],
        identities: [],
      };
      expect(() => getNightReviewOutcome(data)).toThrow(/more than one outcome entry/);
    });
  });

  // ── 2026 report fact layer: actorSeat on every action entry ────────────
  describe('actorSeat', () => {
    const roster = (...pairs: readonly (readonly [number, string])[]): Players =>
      new Map(pairs.map(([seat, role]) => [seat, makePlayer(seat, role)]));

    const cases: readonly {
      readonly name: string;
      readonly state: GameState;
      readonly kind: NightReviewActionEntry['kind'];
      readonly actorSeat: number;
      readonly actorRoleId: string;
    }[] = [
      {
        name: 'nightmareBlock',
        state: makeGameState({
          players: roster([0, 'villager'], [3, 'nightmare']),
          currentNightResults: { blockedSeat: 0 },
        }),
        kind: 'nightmareBlock',
        actorSeat: 3,
        actorRoleId: 'nightmare',
      },
      {
        name: 'nightmareIdle',
        state: makeGameState({ players: roster([3, 'nightmare']) }),
        kind: 'nightmareIdle',
        actorSeat: 3,
        actorRoleId: 'nightmare',
      },
      {
        name: 'shelter',
        state: makeGameState({
          players: roster([2, 'eclipseWolfQueen']),
          currentNightResults: { shelteredSeat: 5 },
        }),
        kind: 'shelter',
        actorSeat: 2,
        actorRoleId: 'eclipseWolfQueen',
      },
      {
        name: 'shelterIdle',
        state: makeGameState({ players: roster([2, 'eclipseWolfQueen']) }),
        kind: 'shelterIdle',
        actorSeat: 2,
        actorRoleId: 'eclipseWolfQueen',
      },
      {
        name: 'hiddenWolfConfirmed',
        state: makeGameState({ players: roster([4, 'hiddenWolf']) }),
        kind: 'hiddenWolfConfirmed',
        actorSeat: 4,
        actorRoleId: 'hiddenWolf',
      },
      {
        name: 'guard',
        state: makeGameState({
          players: roster([1, 'guard']),
          currentNightResults: { guardedSeat: 6 },
        }),
        kind: 'guard',
        actorSeat: 1,
        actorRoleId: 'guard',
      },
      {
        name: 'guardIdle',
        state: makeGameState({ players: roster([1, 'guard']) }),
        kind: 'guardIdle',
        actorSeat: 1,
        actorRoleId: 'guard',
      },
      {
        name: 'silence',
        state: makeGameState({
          players: roster([2, 'silenceElder']),
          currentNightResults: { silencedSeat: 6 },
        }),
        kind: 'silence',
        actorSeat: 2,
        actorRoleId: 'silenceElder',
      },
      {
        name: 'silenceIdle',
        state: makeGameState({ players: roster([2, 'silenceElder']) }),
        kind: 'silenceIdle',
        actorSeat: 2,
        actorRoleId: 'silenceElder',
      },
      {
        name: 'voteban',
        state: makeGameState({
          players: roster([2, 'votebanElder']),
          currentNightResults: { votebannedSeat: 6 },
        }),
        kind: 'voteban',
        actorSeat: 2,
        actorRoleId: 'votebanElder',
      },
      {
        name: 'votebanIdle',
        state: makeGameState({ players: roster([2, 'votebanElder']) }),
        kind: 'votebanIdle',
        actorSeat: 2,
        actorRoleId: 'votebanElder',
      },
      {
        name: 'save',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { savedSeat: 3 },
        }),
        kind: 'save',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poison by witch',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'poison',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poison by poisoner',
        state: makeGameState({
          players: roster([9, 'witch'], [6, 'poisoner']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'poison',
        actorSeat: 6,
        actorRoleId: 'poisoner',
      },
      {
        name: 'witchIdleAll',
        state: makeGameState({ players: roster([9, 'witch']) }),
        kind: 'witchIdleAll',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'witchNoSave',
        state: makeGameState({
          players: roster([9, 'witch'], [6, 'poisoner']),
          currentNightResults: { poisonedSeat: 11 },
        }),
        kind: 'witchNoSave',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'witchNoPoison',
        state: makeGameState({
          players: roster([9, 'witch']),
          currentNightResults: { savedSeat: 3 },
        }),
        kind: 'witchNoPoison',
        actorSeat: 9,
        actorRoleId: 'witch',
      },
      {
        name: 'poisonerNoPoison',
        state: makeGameState({ players: roster([6, 'poisoner']) }),
        kind: 'poisonerNoPoison',
        actorSeat: 6,
        actorRoleId: 'poisoner',
      },
      {
        name: 'curse',
        state: makeGameState({
          players: roster([7, 'crow']),
          currentNightResults: { cursedSeat: 2 },
        }),
        kind: 'curse',
        actorSeat: 7,
        actorRoleId: 'crow',
      },
      {
        name: 'curseIdle',
        state: makeGameState({ players: roster([7, 'crow']) }),
        kind: 'curseIdle',
        actorSeat: 7,
        actorRoleId: 'crow',
      },
      {
        name: 'dream',
        state: makeGameState({
          players: roster([4, 'dreamcatcher']),
          currentNightResults: { dreamingSeat: 2 },
        }),
        kind: 'dream',
        actorSeat: 4,
        actorRoleId: 'dreamcatcher',
      },
      {
        name: 'dreamIdle',
        state: makeGameState({ players: roster([4, 'dreamcatcher']) }),
        kind: 'dreamIdle',
        actorSeat: 4,
        actorRoleId: 'dreamcatcher',
      },
      {
        name: 'swap',
        state: makeGameState({
          players: roster([5, 'magician']),
          currentNightResults: { swappedSeats: [1, 2] },
        }),
        kind: 'swap',
        actorSeat: 5,
        actorRoleId: 'magician',
      },
      {
        name: 'swapIdle',
        state: makeGameState({ players: roster([5, 'magician']) }),
        kind: 'swapIdle',
        actorSeat: 5,
        actorRoleId: 'magician',
      },
      {
        name: 'cupidLink',
        state: makeGameState({ players: roster([8, 'cupid']), loverSeats: [1, 2] }),
        kind: 'cupidLink',
        actorSeat: 8,
        actorRoleId: 'cupid',
      },
      {
        name: 'cardChoice treasureMaster',
        state: makeGameState({
          players: roster([0, 'treasureMaster']),
          treasureMasterChosenCard: 'seer',
        }),
        kind: 'cardChoice',
        actorSeat: 0,
        actorRoleId: 'treasureMaster',
      },
      {
        name: 'cardChoice thief',
        state: makeGameState({ players: roster([0, 'thief']), thiefChosenCard: 'guard' }),
        kind: 'cardChoice',
        actorSeat: 0,
        actorRoleId: 'thief',
      },
      {
        name: 'idolChoice slacker',
        state: makeGameState({
          players: roster([3, 'slacker']),
          actions: new Map([['slacker', makeActionTarget(5)]]),
        }),
        kind: 'idolChoice',
        actorSeat: 3,
        actorRoleId: 'slacker',
      },
      {
        name: 'idolChoice wildChild',
        state: makeGameState({
          players: roster([3, 'wildChild']),
          actions: new Map([['wildChild', makeActionTarget(5)]]),
        }),
        kind: 'idolChoice',
        actorSeat: 3,
        actorRoleId: 'wildChild',
      },
      {
        name: 'mimic',
        state: makeGameState({
          players: roster([6, 'shadow']),
          currentNightResults: { shadowMimicTarget: 2 },
        }),
        kind: 'mimic',
        actorSeat: 6,
        actorRoleId: 'shadow',
      },
      {
        name: 'avengerConfirmed',
        state: makeGameState({ players: roster([6, 'avenger']) }),
        kind: 'avengerConfirmed',
        actorSeat: 6,
        actorRoleId: 'avenger',
      },
      {
        name: 'charm',
        state: makeGameState({
          players: roster([6, 'wolfQueen']),
          actions: new Map([['wolfQueen', makeActionTarget(2)]]),
        }),
        kind: 'charm',
        actorSeat: 6,
        actorRoleId: 'wolfQueen',
      },
      {
        name: 'charmIdle',
        state: makeGameState({ players: roster([6, 'wolfQueen']) }),
        kind: 'charmIdle',
        actorSeat: 6,
        actorRoleId: 'wolfQueen',
      },
      {
        name: 'convert',
        state: makeGameState({
          players: roster([6, 'awakenedGargoyle']),
          currentNightResults: { convertedSeat: 2 },
        }),
        kind: 'convert',
        actorSeat: 6,
        actorRoleId: 'awakenedGargoyle',
      },
      {
        name: 'hypnotize',
        state: makeGameState({
          players: roster([6, 'piper']),
          currentNightResults: { hypnotizedSeats: [1, 2] },
        }),
        kind: 'hypnotize',
        actorSeat: 6,
        actorRoleId: 'piper',
      },
      {
        name: 'hypnotizeIdle',
        state: makeGameState({ players: roster([6, 'piper']) }),
        kind: 'hypnotizeIdle',
        actorSeat: 6,
        actorRoleId: 'piper',
      },
      {
        name: 'check',
        state: makeGameState({
          players: roster([3, 'seer']),
          seerReveal: { targetSeat: 0, result: '狼人' },
        }),
        kind: 'check',
        actorSeat: 3,
        actorRoleId: 'seer',
      },
      {
        name: 'checkIdle',
        state: makeGameState({ players: roster([3, 'seer']) }),
        kind: 'checkIdle',
        actorSeat: 3,
        actorRoleId: 'seer',
      },
      {
        name: 'learn',
        state: makeGameState({
          players: roster([6, 'wolfRobot']),
          wolfRobotReveal: { targetSeat: 1, result: '猎人', learnedRoleId: 'hunter' },
        }),
        kind: 'learn',
        actorSeat: 6,
        actorRoleId: 'wolfRobot',
      },
      {
        name: 'learnIdle',
        state: makeGameState({ players: roster([6, 'wolfRobot']) }),
        kind: 'learnIdle',
        actorSeat: 6,
        actorRoleId: 'wolfRobot',
      },
      {
        name: 'shootStatus hunter',
        state: makeGameState({ players: roster([2, 'hunter']) }),
        kind: 'shootStatus',
        actorSeat: 2,
        actorRoleId: 'hunter',
      },
      {
        name: 'shootStatus darkWolfKing',
        state: makeGameState({ players: roster([2, 'darkWolfKing']) }),
        kind: 'shootStatus',
        actorSeat: 2,
        actorRoleId: 'darkWolfKing',
      },
      {
        name: 'infectConverted',
        state: makeGameState({
          players: roster([1, 'seedWolf']),
          seedWolfInfectionResult: { outcome: 'converted', targetSeat: 4 },
        }),
        kind: 'infectConverted',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
      {
        name: 'infectFailed',
        state: makeGameState({
          players: roster([1, 'seedWolf']),
          seedWolfInfectionResult: { outcome: 'failed', targetSeat: 4 },
        }),
        kind: 'infectFailed',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
      {
        name: 'infectIdle',
        state: makeGameState({ players: roster([1, 'seedWolf']) }),
        kind: 'infectIdle',
        actorSeat: 1,
        actorRoleId: 'seedWolf',
      },
    ];

    for (const testCase of cases) {
      it(`resolves the actor for ${testCase.name}`, () => {
        const entry = buildActionEntries(testCase.state).find(
          (candidate) => candidate.kind === testCase.kind,
        );
        if (entry === undefined) {
          throw new Error(`expected a ${testCase.kind} entry to be built`);
        }
        if (!('actorSeat' in entry)) {
          throw new Error(`expected ${testCase.kind} to carry an actorSeat`);
        }
        expect(entry.actorSeat).toBe(testCase.actorSeat);
        expect(nightReviewActorRoleId(entry)).toBe(testCase.actorRoleId);
      });
    }

    it('fails fast when a poison fact has no witch or poisoner to own it', () => {
      expect(() =>
        buildActionEntries(makeGameState({ currentNightResults: { poisonedSeat: 3 } })),
      ).toThrow(/cannot resolve an actor seat for role witch/);
    });

    it('fails fast when a guard fact has no guard to own it', () => {
      expect(() =>
        buildActionEntries(makeGameState({ currentNightResults: { guardedSeat: 1 } })),
      ).toThrow(/cannot resolve an actor seat for role guard/);
    });

    it('fails fast when a card choice has no treasure master to own it', () => {
      expect(() => buildActionEntries(makeGameState({ treasureMasterChosenCard: 'seer' }))).toThrow(
        /cannot resolve an actor seat for role treasureMaster/,
      );
    });

    it('team, setup and outcome entries carry no single actor', () => {
      expect(nightReviewActorRoleId({ kind: 'wolfNoTarget' })).toBeNull();
      expect(nightReviewActorRoleId({ kind: 'peacefulNight' })).toBeNull();
      expect(nightReviewActorRoleId({ kind: 'bottomCards', roleIds: ['seer'] })).toBeNull();
    });
  });

  // ── 2026 report fact layer: sheriff section state matrix ───────────────
  describe('sheriff section', () => {
    const FIRST_ROUND: SheriffElectionRoundResult = {
      round: 'first',
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 2, 2: 5, 3: 2, 4: null, 5: 2, 6: 5 },
      voteCounts: { 2: 4, 5: 2 },
      abstainingSeats: [4],
    };
    const FIRST_ROUND_DERIVED = {
      round: 'first',
      perCandidate: [
        { seat: 2, votes: 4, voterSeats: [0, 1, 3, 5] },
        { seat: 5, votes: 2, voterSeats: [2, 6] },
      ],
      abstainingSeats: [4],
    };
    const RUNOFF_TIE_ROUND: SheriffElectionRoundResult = {
      round: 'runoff',
      candidateSeats: [2, 5],
      eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
      ballots: { 0: 2, 1: 5, 2: 2, 3: 5, 4: 2, 5: 5, 6: null },
      voteCounts: { 2: 3, 5: 3 },
      abstainingSeats: [6],
    };

    it('is absent when the game held no election', () => {
      expect(getWerewolfNightReview(makeGameState()).sheriff).toBeUndefined();
      expect(deriveSheriffSection(makeGameState())).toBeUndefined();
    });

    it('registration exposes status only — no seats, no counts (secrecy)', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [1, 2],
            withdrawnSeats: [],
            completedRounds: [],
          },
        }),
      );
      expect(section).toEqual({ kind: 'registration' });
    });

    it('candidate speech exposes active candidates and withdrawals, no tallies', () => {
      const section = deriveSheriffSection(
        makeGameState({
          players: new Map([[2, makePlayer(2, 'villager')]]),
          sheriffElection: {
            phase: 'candidateSpeech',
            registeredSeats: [2, 5, 7],
            withdrawnSeats: [7],
            completedRounds: [],
            speakingStartSeat: 2,
            speakingDirection: 'clockwise',
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'candidateSpeech',
        registeredSeats: [2, 5, 7],
        candidateSeats: [2, 5],
        withdrawnSeats: [7],
        closedRounds: [],
        activeRound: null,
        voteProgress: null,
        speakingOrder: { startSeat: 2, direction: 'clockwise' },
      });
    });

    it('withdrawal exposes candidates and no speaking line', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'withdrawal',
            registeredSeats: [2, 5, 7],
            withdrawnSeats: [7],
            completedRounds: [],
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'withdrawal',
        registeredSeats: [2, 5, 7],
        candidateSeats: [2, 5],
        withdrawnSeats: [7],
        closedRounds: [],
        activeRound: null,
        voteProgress: null,
        speakingOrder: null,
      });
    });

    it('first vote in progress lists candidates and submission counts only — ballot targets are never exposed', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'firstVote',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [],
            candidateSeats: [2, 5],
            eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
            ballots: { 0: 2, 1: 5 },
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'firstVote',
        registeredSeats: [2, 5],
        candidateSeats: [2, 5],
        withdrawnSeats: [],
        closedRounds: [],
        activeRound: { round: 'first', candidateSeats: [2, 5] },
        voteProgress: { submittedCount: 2, eligibleCount: 7 },
        speakingOrder: null,
      });
      expect(JSON.stringify(section)).not.toContain('ballot');
      expect(JSON.stringify(section)).not.toContain('votes');
    });

    it('runoff speech shows the closed first round and the runoff candidates', () => {
      const section = deriveSheriffSection(
        makeGameState({
          players: new Map([[2, makePlayer(2, 'villager')]]),
          sheriffElection: {
            phase: 'runoffSpeech',
            registeredSeats: [2, 5, 9],
            withdrawnSeats: [9, 5],
            completedRounds: [FIRST_ROUND],
            candidateSeats: [2, 5],
            speakingStartSeat: 2,
            speakingDirection: 'clockwise',
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'runoffSpeech',
        registeredSeats: [2, 5, 9],
        candidateSeats: [2],
        withdrawnSeats: [9, 5],
        closedRounds: [FIRST_ROUND_DERIVED],
        activeRound: null,
        voteProgress: null,
        speakingOrder: { startSeat: 2, direction: 'clockwise' },
      });
    });

    it('runoff vote in progress keeps the closed round and hides the active ballots', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'runoffVote',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND],
            candidateSeats: [2, 5],
            eligibleVoterSeats: [0, 1, 2, 3, 4, 5, 6],
            ballots: { 0: 2 },
          },
        }),
      );
      expect(section).toEqual({
        kind: 'inProgress',
        phase: 'runoffVote',
        registeredSeats: [2, 5],
        candidateSeats: [2, 5],
        withdrawnSeats: [],
        closedRounds: [FIRST_ROUND_DERIVED],
        activeRound: { round: 'runoff', candidateSeats: [2, 5] },
        voteProgress: { submittedCount: 1, eligibleCount: 7 },
        speakingOrder: null,
      });
    });

    it('completed election derives every tally from the ballots', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND],
          },
          sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
        }),
      );
      expect(section).toEqual({
        kind: 'completed',
        registeredSeats: [2, 5],
        withdrawnSeats: [],
        activeCandidateSeats: [2, 5],
        rounds: [FIRST_ROUND_DERIVED],
        result: { kind: 'elected', sheriffSeat: 2 },
      });
    });

    it('completed no-sheriff keeps the closed rounds and the reason', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [2, 5],
            withdrawnSeats: [],
            completedRounds: [FIRST_ROUND, RUNOFF_TIE_ROUND],
          },
          sheriffElectionResult: { kind: 'noSheriff', reason: 'runoffTie' },
        }),
      );
      expect(section).toMatchObject({
        kind: 'completed',
        result: { kind: 'noSheriff', reason: 'runoffTie' },
      });
      if (section?.kind !== 'completed') throw new Error('expected a completed section');
      expect(section.rounds).toHaveLength(2);
      expect(section.rounds[1]).toEqual({
        round: 'runoff',
        perCandidate: [
          { seat: 2, votes: 3, voterSeats: [0, 2, 4] },
          { seat: 5, votes: 3, voterSeats: [1, 3, 5] },
        ],
        abstainingSeats: [6],
      });
    });

    it('completed with no candidates carries no rounds', () => {
      const section = deriveSheriffSection(
        makeGameState({
          sheriffElection: {
            phase: 'completed',
            registeredSeats: [],
            withdrawnSeats: [],
            completedRounds: [],
          },
          sheriffElectionResult: { kind: 'noSheriff', reason: 'noCandidates' },
        }),
      );
      expect(section).toEqual({
        kind: 'completed',
        registeredSeats: [],
        withdrawnSeats: [],
        activeCandidateSeats: [],
        rounds: [],
        result: { kind: 'noSheriff', reason: 'noCandidates' },
      });
    });

    it('fails fast when stored vote counts disagree with the ballots', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [2, 5],
              withdrawnSeats: [],
              completedRounds: [{ ...FIRST_ROUND, voteCounts: { 2: 3, 5: 2 } }],
            },
            sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
          }),
        ),
      ).toThrow(/disagrees with its ballots/);
    });

    it('fails fast when stored abstentions disagree with the ballots', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [2, 5],
              withdrawnSeats: [],
              completedRounds: [{ ...FIRST_ROUND, abstainingSeats: [] }],
            },
            sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
          }),
        ),
      ).toThrow(/abstaining seats disagree/);
    });

    it('fails fast on a result without an election state', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({ sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 } }),
        ),
      ).toThrow(/without an election state/);
    });

    it('fails fast on a completed election without a result', () => {
      expect(() =>
        deriveSheriffSection(
          makeGameState({
            sheriffElection: {
              phase: 'completed',
              registeredSeats: [],
              withdrawnSeats: [],
              completedRounds: [],
            },
          }),
        ),
      ).toThrow(/without a result/);
    });
  });

  // ── 2026 report fact layer: stats, wolf verdict, death annotations ────
  describe('report derivations', () => {
    it('maps all six engine wolf verdict states', () => {
      // The mapping is pure: the verdict field decides, the votes
      // are display only and are never tallied here.
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
          ],
          abstainSeats: [],
          verdict: { type: 'sharedTarget', targetSeat: 5 },
        }),
      ).toEqual({ type: 'sharedTarget', targetSeat: 5 });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
            { voterSeat: 2, targetSeat: 6 },
          ],
          abstainSeats: [],
          verdict: { type: 'splitKilled', targetSeat: 5 },
        }),
      ).toEqual({ type: 'splitKilled', targetSeat: 5 });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 6 },
          ],
          abstainSeats: [],
          verdict: { type: 'tiePicked', targetSeat: 5 },
        }),
      ).toEqual({ type: 'tiePicked', targetSeat: 5 });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 6 },
          ],
          abstainSeats: [],
          verdict: { type: 'splitTied' },
        }),
      ).toEqual({ type: 'splitTied' });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [],
          abstainSeats: [0, 1],
          verdict: { type: 'allAbstain' },
        }),
      ).toEqual({ type: 'allAbstain' });
    });

    it('does not invent a verdict from the votes without an engine verdict', () => {
      // Unanimous votes with no settlement recorded must not render
      // as a kill: the verdict is pending, not shared.
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
          ],
          abstainSeats: [],
        }),
      ).toEqual({ type: 'tiePending' });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 6 },
          ],
          abstainSeats: [],
        }),
      ).toEqual({ type: 'tiePending' });
      // A null verdict (wolf-kill override, no vote verdict) is also
      // never reported as splitTied.
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 6 },
          ],
          abstainSeats: [],
          verdict: null,
        }),
      ).toEqual({ type: 'tiePending' });
    });

    it('lets the engine verdict win over a contradicting tally', () => {
      // The engine is the authority: even a tally that would name
      // another target must not override the recorded verdict.
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes: [
            { voterSeat: 0, targetSeat: 5 },
            { voterSeat: 1, targetSeat: 5 },
          ],
          abstainSeats: [],
          verdict: { type: 'splitKilled', targetSeat: 6 },
        }),
      ).toEqual({ type: 'splitKilled', targetSeat: 6 });
    });

    it('renders a cupid 2-to-1 engine verdict as no kill and emits no wolf-target save note', () => {
      // Under cupid unanimity a 2-to-1 vote settles to splitTied
      // (no kill); the tally alone must not be read as a plurality
      // kill, and no "wolf target not saved" note may be derived
      // from it.
      const votes = [
        { voterSeat: 0, targetSeat: 5 },
        { voterSeat: 1, targetSeat: 5 },
        { voterSeat: 2, targetSeat: 6 },
      ];
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes,
          abstainSeats: [],
          verdict: { type: 'splitTied' },
        }),
      ).toEqual({ type: 'splitTied' });
      expect(
        deriveWolfVerdict({
          kind: 'wolfAttack',
          votes,
          abstainSeats: [],
          verdict: { type: 'splitKilled', targetSeat: 5 },
        }),
      ).toEqual({ type: 'splitKilled', targetSeat: 5 });

      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'wolf')],
        [3, makePlayer(3, 'witch')],
        [5, makePlayer(5, 'villager')],
        [6, makePlayer(6, 'villager')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 5, '2': 6 } },
          resolvedWolfKillTarget: null,
          resolvedWolfKillVerdict: { type: 'splitTied' },
        }),
      );
      const wolfEntry = data.actions.find((entry) => entry.kind === 'wolfAttack');
      expect(wolfEntry?.kind).toBe('wolfAttack');
      if (wolfEntry?.kind === 'wolfAttack') {
        expect(deriveWolfVerdict(wolfEntry)).toEqual({ type: 'splitTied' });
      }
      expect(deriveWolfTargetSaveNote(data)).toBeNull();
    });

    it('does not recover a verdict from a recorded save without an engine verdict', () => {
      // A recorded save proves the witch saved a seat, not how the
      // wolf vote resolved: with no engine verdict, the report must
      // show the vote as pending, never as a picked target.
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'wolf')],
        [2, makePlayer(2, 'witch')],
        [4, makePlayer(4, 'villager')],
        [5, makePlayer(5, 'villager')],
      ]);
      const entries = buildActionEntries(
        makeGameState({
          players,
          currentNightResults: { wolfVotesBySeat: { '0': 5, '1': 4 }, savedSeat: 5 },
        }),
      );
      const wolfEntry = entries.find((entry) => entry.kind === 'wolfAttack');
      expect(wolfEntry).toEqual({
        kind: 'wolfAttack',
        votes: [
          { voterSeat: 0, targetSeat: 5 },
          { voterSeat: 1, targetSeat: 4 },
        ],
        abstainSeats: [],
      });
      if (wolfEntry?.kind === 'wolfAttack') {
        expect(wolfEntry.verdict).toBeUndefined();
        expect(deriveWolfVerdict(wolfEntry)).toEqual({ type: 'tiePending' });
      }
    });

    it('derives stats from the entries and cross-checks them against the deaths', () => {
      const players = new Map<number, Player | null>([
        [3, makePlayer(3, 'seer')],
        [9, makePlayer(9, 'witch')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          currentNightResults: { savedSeat: 4, poisonedSeat: 11 },
          seerReveal: { targetSeat: 4, result: '好人' },
          lastNightDeaths: [11],
          deathReasons: { 11: 'poison' },
        }),
      );
      expect(deriveNightReportStats(data)).toEqual({
        wolfKills: 0,
        poisonKills: 1,
        saves: 1,
        checks: 1,
      });
    });

    it('does not count a save whose target died anyway', () => {
      const players = new Map<number, Player | null>([
        [0, makePlayer(0, 'wolf')],
        [1, makePlayer(1, 'guard')],
        [2, makePlayer(2, 'witch')],
        [3, makePlayer(3, 'seer')],
        [4, makePlayer(4, 'villager')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '0': 4 },
            guardedSeat: 4,
            savedSeat: 4,
          },
          seerReveal: { targetSeat: 0, result: '狼人' },
          lastNightDeaths: [4],
          deathReasons: { 4: 'wolfKill' },
        }),
      );
      expect(deriveNightReportStats(data)).toEqual({
        wolfKills: 1,
        poisonKills: 0,
        saves: 0,
        checks: 1,
      });
    });

    it('fails fast when the outcome lists a seat twice', () => {
      const data: WerewolfNightReview = {
        actions: [
          {
            kind: 'deaths',
            deaths: [
              { seat: 1, reason: 'wolfKill' },
              { seat: 1, reason: 'poison' },
            ],
          },
        ],
        identities: [],
      };
      expect(() => deriveNightReportStats(data)).toThrow(/more than once/);
    });

    it('annotates deaths with the locking wolf votes and the poison owner', () => {
      const players = new Map<number, Player | null>([
        [6, makePlayer(6, 'wolf')],
        [7, makePlayer(7, 'wolf')],
        [8, makePlayer(8, 'wolf')],
        [9, makePlayer(9, 'witch')],
        [11, makePlayer(11, 'wolf')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          currentNightResults: {
            wolfVotesBySeat: { '6': 5, '7': 5, '8': 4, '11': -1 },
            poisonedSeat: 11,
          },
          lastNightDeaths: [5, 11],
          deathReasons: { 5: 'wolfKill', 11: 'poison' },
          resolvedWolfKillTarget: 5,
          resolvedWolfKillVerdict: { type: 'splitKilled', targetSeat: 5 },
        }),
      );
      const notes = deriveDeathNotes(data);
      expect(notes.get(5)).toEqual({ kind: 'wolfVotes', votes: 2 });
      expect(notes.get(11)).toEqual({ kind: 'poisonedBy', actorRoleId: 'witch' });
      expect(deriveWolfTargetSaveNote(data)).toEqual({ wolfTargetSeat: 5 });
    });

    it('drops the save note once the witch saved the wolf target', () => {
      const players = new Map<number, Player | null>([
        [6, makePlayer(6, 'wolf')],
        [9, makePlayer(9, 'witch')],
      ]);
      const data = getWerewolfNightReview(
        makeGameState({
          players,
          currentNightResults: { wolfVotesBySeat: { '6': 5 }, savedSeat: 5 },
          resolvedWolfKillTarget: 5,
          resolvedWolfKillVerdict: { type: 'sharedTarget', targetSeat: 5 },
        }),
      );
      expect(deriveWolfTargetSaveNote(data)).toBeNull();
    });
  });
});
