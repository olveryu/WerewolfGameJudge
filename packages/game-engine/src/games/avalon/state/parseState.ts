/** Strict Avalon persistence and transport codec. */

import { type AudioEffect, parseAudioBatchId } from '../../../platform/audio';
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
  parseSeat,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
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
  type AvalonBallot,
  type AvalonConfig,
  type AvalonLadyCheckRecord,
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
      automatic: parseBoolean(raw.automatic, `${path}.automatic`),
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
      automatic: parseBoolean(raw.automatic, `${path}.automatic`),
      result: parseChoice(raw.result, `${path}.result`, ['success', 'fail'] as const),
      successCount: parseInteger(raw.successCount, `${path}.successCount`),
      failCount: parseInteger(raw.failCount, `${path}.failCount`),
    },
    path,
  );
}

function ladyHistoryRecord(value: unknown, path: string): AvalonLadyCheckRecord {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      afterRound: parseChoice(raw.afterRound, `${path}.afterRound`, AVALON_LADY_ROUNDS),
      holderSeat: parseSeat(raw.holderSeat, `${path}.holderSeat`),
      targetSeat: parseSeat(raw.targetSeat, `${path}.targetSeat`),
    },
    path,
  );
}

function audioEffect(value: unknown, path: string): AudioEffect {
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
      automatic: parseBoolean(raw.automatic, `${path}.automatic`),
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
          preselectedSeats: parseArray(raw.preselectedSeats, `${path}.preselectedSeats`, parseSeat),
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
          deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
        },
        path,
      );
    case 'voteResult':
      return finishObject(
        raw,
        {
          kind: 'voteResult' as const,
          round: questRound(raw.round, `${path}.round`),
          proposedSeats: parseArray(raw.proposedSeats, `${path}.proposedSeats`, parseSeat),
          deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
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
          deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
          ballots: ballotRecord(raw.ballots, `${path}.ballots`),
          approveCount: parseInteger(raw.approveCount, `${path}.approveCount`),
          rejectCount: parseInteger(raw.rejectCount, `${path}.rejectCount`),
          abstainCount: parseInteger(raw.abstainCount, `${path}.abstainCount`),
          automatic: parseBoolean(raw.automatic, `${path}.automatic`),
        },
        path,
      );
    case 'questResult':
      return finishObject(
        raw,
        {
          kind: 'questResult' as const,
          round: questRound(raw.round, `${path}.round`),
          deadlineAt: parseNullable(raw.deadlineAt, `${path}.deadlineAt`, parseInteger),
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
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseAvalonConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
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
        ladyHistory: parseArray(raw.ladyHistory, `${path}.ladyHistory`, ladyHistoryRecord),
        lastVoteResult: parseNullable(raw.lastVoteResult, `${path}.lastVoteResult`, lastVoteResult),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        reviewCompletedUserIds: parseArray(
          raw.reviewCompletedUserIds,
          `${path}.reviewCompletedUserIds`,
          parseNonEmptyString,
        ),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
        pendingAudioEffects: parseArray(
          raw.pendingAudioEffects,
          `${path}.pendingAudioEffects`,
          audioEffect,
        ),
        isAudioPlaying: parseBoolean(raw.isAudioPlaying, `${path}.isAudioPlaying`),
        audioBatchId: parseAudioBatchId(raw.audioBatchId, `${path}.audioBatchId`),
      },
      path,
    ),
  );
}
