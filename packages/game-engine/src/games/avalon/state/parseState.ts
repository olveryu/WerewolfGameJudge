/** Strict Avalon persistence and transport codec; v1 payloads migrate through migratePersistedAvalonState. */

import { materializeLegacyRoster } from '../../../platform/protocol/legacyRoster';
import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import type { BotSeatOccupant } from '../../../platform/room/seating';
import { normalizeAvalonState } from './normalize';
import {
  AVALON_BALLOTS,
  AVALON_END_REASONS,
  AVALON_GAME_TYPE,
  AVALON_LADY_ROUNDS,
  AVALON_NIGHT_STEPS,
  AVALON_PHASES,
  AVALON_PLAYS,
  AVALON_QUEST_ROUNDS,
  AVALON_ROLES,
  AVALON_VOTE_MODES,
  type AvalonAudioEffect,
  type AvalonBallot,
  type AvalonConfig,
  type AvalonHumanSeat,
  type AvalonLadyCheckResult,
  type AvalonLastVoteResult,
  type AvalonNightInfo,
  type AvalonPhase,
  type AvalonPlay,
  type AvalonProposalRecord,
  type AvalonQuestHistoryEntry,
  type AvalonQuestRecord,
  type AvalonQuestRound,
  type AvalonRoleId,
  type AvalonRoundRecord,
  type AvalonState,
  isAvalonPlayerCount,
  isAvalonVetoLimit,
} from './types';
import { AVALON_STATE_VERSION } from './version';

/** Parses only the supported lobby settings. */
export function parseAvalonConfig(value: unknown, path = 'AvalonConfig'): AvalonConfig {
  const raw = parseObject(value, path);
  const numberOfPlayers = parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`);
  if (!isAvalonPlayerCount(numberOfPlayers))
    failDecode(`${path}.numberOfPlayers`, 'a supported player count');
  const vetoLimit = parseInteger(raw.vetoLimit, `${path}.vetoLimit`);
  if (!isAvalonVetoLimit(vetoLimit)) failDecode(`${path}.vetoLimit`, 'a supported veto limit');
  return finishObject(
    raw,
    {
      numberOfPlayers,
      voteMode: parseChoice(raw.voteMode, `${path}.voteMode`, AVALON_VOTE_MODES),
      vetoLimit,
    },
    path,
  );
}

function profile(value: unknown, path: string): RoomSeatProfile {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      displayName: parseNonEmptyString(raw.displayName, `${path}.displayName`),
      avatarUrl: parseOptional(raw.avatarUrl, `${path}.avatarUrl`, parseString),
      avatarFrame: parseOptional(raw.avatarFrame, `${path}.avatarFrame`, parseString),
      seatFlair: parseOptional(raw.seatFlair, `${path}.seatFlair`, parseString),
      seatAnimation: parseOptional(raw.seatAnimation, `${path}.seatAnimation`, parseString),
      nameStyle: parseOptional(raw.nameStyle, `${path}.nameStyle`, parseString),
      revealEffect: parseOptional(raw.revealEffect, `${path}.revealEffect`, parseString),
      level: parseOptional(raw.level, `${path}.level`, parseInteger),
    },
    path,
  );
}

function rosterSeats(value: unknown, path: string): AvalonState['roster'] {
  const raw = parseObject(value, path);
  const result: Record<number, AvalonHumanSeat | BotSeatOccupant> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const rawSeat = parseObject(value, `${path}.${key}`);
    const seat = parseSeat(Number(key), `${path}.${key}`);
    if (rawSeat.kind === 'bot') {
      result[seat] = finishObject(
        rawSeat,
        { seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`), kind: 'bot' as const },
        `${path}.${key}`,
      );
    } else {
      result[seat] = finishObject(
        rawSeat,
        {
          seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`),
          userId: parseNonEmptyString(rawSeat.userId, `${path}.${key}.userId`),
          profile: profile(rawSeat.profile, `${path}.${key}.profile`),
        },
        `${path}.${key}`,
      );
    }
  }
  return result;
}

function legacyRealSeats(value: unknown, path: string): Readonly<Record<number, AvalonHumanSeat>> {
  const raw = parseObject(value, path);
  const result: Record<number, AvalonHumanSeat> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    const rawSeat = parseObject(value, `${path}.${key}`);
    result[parseSeat(Number(key), `${path}.${key}`)] = finishObject(
      rawSeat,
      {
        seat: parseSeat(rawSeat.seat, `${path}.${key}.seat`),
        userId: parseNonEmptyString(rawSeat.userId, `${path}.${key}.userId`),
        profile: profile(rawSeat.profile, `${path}.${key}.profile`),
      },
      `${path}.${key}`,
    );
  }
  return result;
}

function seatRecord<T>(value: unknown, path: string, decode: (value: unknown, path: string) => T) {
  const raw = parseObject(value, path);
  const result: Record<number, T> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = decode(item, `${path}.${key}`);
  }
  return result;
}

function roles(value: unknown, path: string): Readonly<Record<number, AvalonRoleId>> {
  return seatRecord(value, path, (item, itemPath) => parseChoice(item, itemPath, AVALON_ROLES));
}

function nightInfo(value: unknown, path: string): AvalonNightInfo {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      evilPeers: seatRecord(raw.evilPeers, `${path}.evilPeers`, (item, itemPath) =>
        parseArray(item, itemPath, parseSeat),
      ),
      merlinSees: parseArray(raw.merlinSees, `${path}.merlinSees`, parseSeat),
      percivalSees: parseArray(raw.percivalSees, `${path}.percivalSees`, parseSeat),
    },
    path,
  );
}

function questRound(value: unknown, path: string): AvalonQuestRound {
  return parseChoice(value, path, AVALON_QUEST_ROUNDS);
}

function ballotRecord(value: unknown, path: string): Readonly<Record<number, AvalonBallot>> {
  return seatRecord(value, path, (item, itemPath) => parseChoice(item, itemPath, AVALON_BALLOTS));
}

function playRecord(value: unknown, path: string): Readonly<Record<number, AvalonPlay>> {
  return seatRecord(value, path, (item, itemPath) => parseChoice(item, itemPath, AVALON_PLAYS));
}

function proposalRecord(value: unknown, path: string): AvalonProposalRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      leaderSeat: parseSeat(raw.leaderSeat, `${path}.leaderSeat`),
      teamSeats: parseArray(raw.teamSeats, `${path}.teamSeats`, parseSeat),
      ballots: ballotRecord(raw.ballots, `${path}.ballots`),
      approveCount: parseInteger(raw.approveCount, `${path}.approveCount`),
      rejectCount: parseInteger(raw.rejectCount, `${path}.rejectCount`),
      abstainCount: parseInteger(raw.abstainCount, `${path}.abstainCount`),
      approved: parseBoolean(raw.approved, `${path}.approved`),
    },
    path,
  );
}

function questRecord(value: unknown, path: string): AvalonQuestRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      result: parseChoice(raw.result, `${path}.result`, ['success', 'fail'] as const),
      successCount: parseInteger(raw.successCount, `${path}.successCount`),
      failCount: parseInteger(raw.failCount, `${path}.failCount`),
    },
    path,
  );
}

function roundRecord(value: unknown, path: string): AvalonRoundRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      round: questRound(raw.round, `${path}.round`),
      proposals: parseArray(raw.proposals, `${path}.proposals`, proposalRecord),
      quest: parseNullable(raw.quest, `${path}.quest`, questRecord),
    },
    path,
  );
}

function historyEntry(value: unknown, path: string): AvalonQuestHistoryEntry {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      round: questRound(raw.round, `${path}.round`),
      leaderSeat: parseSeat(raw.leaderSeat, `${path}.leaderSeat`),
      teamSeats: parseArray(raw.teamSeats, `${path}.teamSeats`, parseSeat),
      ballots: ballotRecord(raw.ballots, `${path}.ballots`),
      approveCount: parseInteger(raw.approveCount, `${path}.approveCount`),
      rejectCount: parseInteger(raw.rejectCount, `${path}.rejectCount`),
      abstainCount: parseInteger(raw.abstainCount, `${path}.abstainCount`),
      result: parseChoice(raw.result, `${path}.result`, ['success', 'fail'] as const),
      successCount: parseInteger(raw.successCount, `${path}.successCount`),
      failCount: parseInteger(raw.failCount, `${path}.failCount`),
    },
    path,
  );
}

function ladyCheck(value: unknown, path: string): AvalonLadyCheckResult {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      holderSeat: parseSeat(raw.holderSeat, `${path}.holderSeat`),
      targetSeat: parseSeat(raw.targetSeat, `${path}.targetSeat`),
      faction: parseChoice(raw.faction, `${path}.faction`, ['good', 'evil'] as const),
    },
    path,
  );
}

function audioEffect(value: unknown, path: string): AvalonAudioEffect {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      audioKey: parseNonEmptyString(raw.audioKey, `${path}.audioKey`),
      isEndAudio:
        raw.isEndAudio === undefined
          ? undefined
          : parseBoolean(raw.isEndAudio, `${path}.isEndAudio`),
    },
    path,
  );
}

function lastVoteResult(value: unknown, path: string): AvalonLastVoteResult {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      approved: parseBoolean(raw.approved, `${path}.approved`),
      rejectStreak: parseInteger(raw.rejectStreak, `${path}.rejectStreak`),
      ballots: ballotRecord(raw.ballots, `${path}.ballots`),
      approveCount: parseInteger(raw.approveCount, `${path}.approveCount`),
      rejectCount: parseInteger(raw.rejectCount, `${path}.rejectCount`),
      abstainCount: parseInteger(raw.abstainCount, `${path}.abstainCount`),
    },
    path,
  );
}

function phase(value: unknown, path: string): AvalonPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, AVALON_PHASES);
  switch (kind) {
    case 'lobby':
      return finishObject(raw, { kind: 'lobby' as const }, path);
    case 'viewing':
      return finishObject(raw, { kind: 'viewing' as const }, path);
    case 'night':
      return finishObject(
        raw,
        {
          kind: 'night' as const,
          step: parseChoice(raw.step, `${path}.step`, AVALON_NIGHT_STEPS),
          confirmedSeats: parseArray(raw.confirmedSeats, `${path}.confirmedSeats`, parseSeat),
        },
        path,
      );
    case 'nominate':
      return finishObject(
        raw,
        {
          kind: 'nominate' as const,
          round: questRound(raw.round, `${path}.round`),
          requiredSize: parseInteger(raw.requiredSize, `${path}.requiredSize`),
        },
        path,
      );
    case 'vote':
      return finishObject(
        raw,
        {
          kind: 'vote' as const,
          round: questRound(raw.round, `${path}.round`),
          proposedSeats: parseArray(raw.proposedSeats, `${path}.proposedSeats`, parseSeat),
          ballots: ballotRecord(raw.ballots, `${path}.ballots`),
          deadlineAt:
            raw.deadlineAt === undefined
              ? null
              : parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
        },
        path,
      );
    case 'quest':
      return finishObject(
        raw,
        {
          kind: 'quest' as const,
          round: questRound(raw.round, `${path}.round`),
          teamSeats: parseArray(raw.teamSeats, `${path}.teamSeats`, parseSeat),
          plays: playRecord(raw.plays, `${path}.plays`),
          deadlineAt:
            raw.deadlineAt === undefined
              ? null
              : parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
          ballots: ballotRecord(raw.ballots, `${path}.ballots`),
          approveCount: parseInteger(raw.approveCount, `${path}.approveCount`),
          rejectCount: parseInteger(raw.rejectCount, `${path}.rejectCount`),
          abstainCount: parseInteger(raw.abstainCount, `${path}.abstainCount`),
        },
        path,
      );
    case 'lady':
      return finishObject(
        raw,
        {
          kind: 'lady' as const,
          afterRound: parseChoice(raw.afterRound, `${path}.afterRound`, AVALON_LADY_ROUNDS),
          holderSeat: parseSeat(raw.holderSeat, `${path}.holderSeat`),
          examinedSeats: parseArray(raw.examinedSeats, `${path}.examinedSeats`, parseSeat),
          targetSeat: parseNullable(raw.targetSeat, `${path}.targetSeat`, parseSeat),
        },
        path,
      );
    case 'assassin':
      return finishObject(
        raw,
        {
          kind: 'assassin' as const,
          accusedSeat: parseNullable(raw.accusedSeat, `${path}.accusedSeat`, parseSeat),
        },
        path,
      );
    case 'ended':
      return finishObject(
        raw,
        {
          kind: 'ended' as const,
          winner: parseChoice(raw.winner, `${path}.winner`, ['good', 'evil'] as const),
          reason: parseChoice(raw.reason, `${path}.reason`, AVALON_END_REASONS),
          accusedSeat: parseNullable(raw.accusedSeat, `${path}.accusedSeat`, parseSeat),
        },
        path,
      );
  }
}

/** Restores the complete authoritative state and rejects unknown or malformed fields.
 * @throws If the state identity, shape or domain invariants are invalid.
 */
export function parseAvalonState(value: unknown): AvalonState {
  const path = 'AvalonState';
  const raw = parseObject(value, path);
  return normalizeAvalonState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [AVALON_GAME_TYPE]),
        stateVersion: parseChoice(raw.stateVersion, `${path}.stateVersion`, [AVALON_STATE_VERSION]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseAvalonConfig(raw.config, `${path}.config`),
        roster: rosterSeats(raw.roster, `${path}.roster`),
        roles: roles(raw.roles, `${path}.roles`),
        nightInfo: nightInfo(raw.nightInfo, `${path}.nightInfo`),
        leaderSeat: parseInteger(raw.leaderSeat, `${path}.leaderSeat`),
        rejectStreak: parseInteger(raw.rejectStreak, `${path}.rejectStreak`),
        questResults: parseArray(raw.questResults, `${path}.questResults`, (item, itemPath) =>
          parseChoice(item, itemPath, ['success', 'fail'] as const),
        ),
        questHistory: parseArray(raw.questHistory, `${path}.questHistory`, historyEntry),
        roundHistory: parseArray(raw.roundHistory, `${path}.roundHistory`, roundRecord),
        ladyHolderSeat: parseNullable(raw.ladyHolderSeat, `${path}.ladyHolderSeat`, parseSeat),
        ladyExaminedSeats: parseArray(
          raw.ladyExaminedSeats,
          `${path}.ladyExaminedSeats`,
          parseSeat,
        ),
        roleViewedSeats: parseArray(raw.roleViewedSeats, `${path}.roleViewedSeats`, parseSeat),
        lastLadyCheck: parseNullable(raw.lastLadyCheck, `${path}.lastLadyCheck`, ladyCheck),
        lastVoteResult: parseNullable(raw.lastVoteResult, `${path}.lastVoteResult`, lastVoteResult),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
        pendingAudioEffects: parseArray(
          raw.pendingAudioEffects,
          `${path}.pendingAudioEffects`,
          audioEffect,
        ),
        isAudioPlaying: parseBoolean(raw.isAudioPlaying, `${path}.isAudioPlaying`),
      },
      path,
    ),
  );
}

/**
 * Derives the v6 round record from what pre-v6 payloads actually stored:
 * every settled quest (questHistory keeps its approved proposal and its
 * outcome) plus an in-flight quest (the quest phase itself still carries
 * the approved proposal). Rejected proposals of older rounds were never
 * persisted anywhere, so they stay absent — v6 settlements record all.
 * Runs on the raw payload so the strict parser (and its mirror
 * invariants) only ever sees the completed state.
 */
function deriveLegacyRoundHistory(
  raw: Readonly<Record<string, unknown>>,
): readonly AvalonRoundRecord[] {
  const questHistory =
    raw.questHistory === undefined
      ? []
      : parseArray(raw.questHistory, 'AvalonState.questHistory', historyEntry);
  const rounds: AvalonRoundRecord[] = questHistory.map((entry) => {
    const proposal: AvalonProposalRecord = {
      leaderSeat: entry.leaderSeat,
      teamSeats: entry.teamSeats,
      ballots: entry.ballots,
      approveCount: entry.approveCount,
      rejectCount: entry.rejectCount,
      abstainCount: entry.abstainCount,
      approved: true,
    };
    const quest: AvalonQuestRecord = {
      result: entry.result,
      successCount: entry.successCount,
      failCount: entry.failCount,
    };
    return { round: entry.round, proposals: [proposal], quest };
  });
  const rawPhase = phase(raw.phase, 'AvalonState.phase');
  if (rawPhase.kind === 'quest' && !rounds.some((record) => record.round === rawPhase.round)) {
    rounds.push({
      round: rawPhase.round,
      proposals: [
        {
          leaderSeat: parseInteger(raw.leaderSeat, 'AvalonState.leaderSeat'),
          teamSeats: rawPhase.teamSeats,
          ballots: rawPhase.ballots,
          approveCount: rawPhase.approveCount,
          rejectCount: rawPhase.rejectCount,
          abstainCount: rawPhase.abstainCount,
          approved: true,
        },
      ],
      quest: null,
    });
  }
  return rounds;
}

/**
 * Upgrades stored v1/v2 rooms. v1 predates role viewing, so its record
 * starts empty. v2 stored the roster as realSeats plus the implicit-bot
 * derivation inputs; the v3 roster materializes exactly the seats the
 * old derivation would have called bots.
 * @throws When the stored state is malformed or invalid after migration.
 */
export function migratePersistedAvalonState(value: unknown): AvalonState {
  const raw = parseObject(value, 'AvalonState');
  // v3/v4 predate the viewing stage; their phases all exist unchanged
  // in v5 (a v4 game is either undealt or already past the deal), so
  // migration is a pure version bump with field-for-field equivalence.
  // v5 -> v6 adds roundHistory, derived from what the old state stored
  // (see deriveLegacyRoundHistory); v3/v4 take the same derivation.
  if (raw.stateVersion === 3 || raw.stateVersion === 4 || raw.stateVersion === 5) {
    return parseAvalonState({
      ...raw,
      stateVersion: AVALON_STATE_VERSION,
      roundHistory: deriveLegacyRoundHistory(raw),
    });
  }
  if (raw.stateVersion !== 1 && raw.stateVersion !== 2) return parseAvalonState(raw);
  if (raw.stateVersion === 1 && 'roleViewedSeats' in raw)
    return failDecode('AvalonState.roleViewedSeats', 'absent from version 1 states');
  const config = parseAvalonConfig(raw.config, 'AvalonState.config');
  const humans = legacyRealSeats(raw.realSeats, 'AvalonState.realSeats');
  const fill = parseBoolean(raw.fillEmptySeatsWithBots, 'AvalonState.fillEmptySeatsWithBots');
  const excluded = parseArray(raw.excludedBotSeats, 'AvalonState.excludedBotSeats', parseSeat);
  const roster = materializeLegacyRoster({
    humans,
    fillEmptySeatsWithBots: fill,
    excludedBotSeats: excluded,
    numberOfPlayers: config.numberOfPlayers,
  });
  const {
    realSeats: _legacyRealSeats,
    fillEmptySeatsWithBots: _legacyFill,
    excludedBotSeats: _legacyExcluded,
    ...rest
  } = raw;
  return parseAvalonState({
    ...rest,
    stateVersion: AVALON_STATE_VERSION,
    roleViewedSeats: raw.stateVersion === 1 ? [] : raw.roleViewedSeats,
    roster,
    roundHistory: deriveLegacyRoundHistory(rest),
  });
}
