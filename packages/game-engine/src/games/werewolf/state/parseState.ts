/** Runtime decoder for persisted and transported Werewolf state. */

import { type AudioEffect, parseAudioBatchId } from '../../../platform/audio';
import { WEREWOLF_GAME_TYPE } from '../../../platform/protocol/gameTypes';
import {
  failDecode as fail,
  finishObject,
  parseArray,
  parseBoolean,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
  parseOptional,
  parseSeat,
  parseString,
} from '../../../platform/protocol/runtimeDecoder';
import { buildRoomSeatProfile, type RosterEntry } from '../../../platform/room/roster';
import type { BotSeatOccupant } from '../../../platform/room/seating';
import { GameStatus } from '../domain/models/GameStatus';
import { isValidRoleId, type RoleId } from '../domain/models/roles';
import type { GameRuleOverrides } from '../domain/models/Template';
import type {
  BoardNomination,
  GameState,
  Player,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
  SheriffSpeakingDirection,
  WerewolfHumanSeat,
} from '../domain/protocol/types';
import { type Complete, normalizeState } from '../domain/state/normalize';
import type { DeathReason } from '../roles/deathEffects';
import { parseWerewolfNightState } from '../roles/nightState';

function parseRoleId(value: unknown, path: string): RoleId {
  if (typeof value !== 'string' || !isValidRoleId(value)) {
    return fail(path, 'a registered role ID');
  }
  return value;
}

function parseRoleIds(value: unknown, path: string): RoleId[] {
  return parseArray(value, path, parseRoleId);
}

function parseSheriffSpeakingDirection(value: unknown, path: string): SheriffSpeakingDirection {
  if (value === 'clockwise' || value === 'counterclockwise') return value;
  return fail(path, 'clockwise or counterclockwise');
}

function parseGameStatus(value: unknown, path: string): GameStatus {
  switch (value) {
    case GameStatus.Unseated:
      return GameStatus.Unseated;
    case GameStatus.Seated:
      return GameStatus.Seated;
    case GameStatus.Assigned:
      return GameStatus.Assigned;
    case GameStatus.Ready:
      return GameStatus.Ready;
    case GameStatus.Ongoing:
      return GameStatus.Ongoing;
    case GameStatus.Day:
      return GameStatus.Day;
    case GameStatus.Ended:
      return GameStatus.Ended;
    default:
      return fail(path, 'a valid Werewolf game status');
  }
}

function parseGameSequence(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < 0) return fail(path, 'a non-negative integer');
  return parsed;
}

function parseRules(value: unknown, path: string): GameRuleOverrides {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      isPlagueMode: parseOptional(raw.isPlagueMode, `${path}.isPlagueMode`, parseBoolean),
      isSheriffElectionEnabled: parseOptional(
        raw.isSheriffElectionEnabled,
        `${path}.isSheriffElectionEnabled`,
        parseBoolean,
      ),
      witchCanSelfHeal: parseOptional(
        raw.witchCanSelfHeal,
        `${path}.witchCanSelfHeal`,
        parseBoolean,
      ),
    },
    path,
  );
}

function parsePlayer(value: unknown, path: string): Player {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      seat: parseSeat(raw.seat, `${path}.seat`),
      role: parseOptional(raw.role, `${path}.role`, (role, rolePath) =>
        parseNullable(role, rolePath, parseRoleId),
      ),
    },
    path,
  );
}

function parseRevealEffect(value: unknown, path: string): string {
  return parseNonEmptyString(value, path);
}

function parseSeatKey(key: string, path: string): number {
  if (!/^\d+$/.test(key)) return fail(path, 'a non-negative integer key');
  return parseSeat(Number(key), path);
}

function parsePlayers(value: unknown, path: string): Record<number, Player | null> {
  const raw = parseObject(value, path);
  const players: Record<number, Player | null> = {};
  for (const [key, player] of Object.entries(raw)) {
    const seat = parseSeatKey(key, `${path}.${key}`);
    players[seat] = parseNullable(player, `${path}.${key}`, parsePlayer);
  }
  return players;
}

function parseRosterEntry(value: unknown, path: string): RosterEntry {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    buildRoomSeatProfile({
      displayName: parseString(raw.displayName, `${path}.displayName`),
      avatarUrl: parseOptional(raw.avatarUrl, `${path}.avatarUrl`, parseString),
      avatarFrame: parseOptional(raw.avatarFrame, `${path}.avatarFrame`, parseString),
      seatFlair: parseOptional(raw.seatFlair, `${path}.seatFlair`, parseString),
      seatAnimation: parseOptional(raw.seatAnimation, `${path}.seatAnimation`, parseString),
      nameStyle: parseOptional(raw.nameStyle, `${path}.nameStyle`, parseString),
      revealEffect: parseOptional(raw.revealEffect, `${path}.revealEffect`, parseRevealEffect),
      level: parseOptional(raw.level, `${path}.level`, parseInteger),
    }),
    path,
  );
}

function parseSeatRoster(
  value: unknown,
  path: string,
): Record<number, WerewolfHumanSeat | BotSeatOccupant> {
  const raw = parseObject(value, path);
  const roster: Record<number, WerewolfHumanSeat | BotSeatOccupant> = {};
  for (const [key, occupant] of Object.entries(raw)) {
    const seat = parseSeatKey(key, `${path}.${key}`);
    const rawOccupant = parseObject(occupant, `${path}.${key}`);
    roster[seat] =
      rawOccupant.kind === 'bot'
        ? finishObject(
            rawOccupant,
            { seat: parseSeat(rawOccupant.seat, `${path}.${key}.seat`), kind: 'bot' as const },
            `${path}.${key}`,
          )
        : finishObject(
            rawOccupant,
            {
              seat: parseSeat(rawOccupant.seat, `${path}.${key}.seat`),
              userId: parseNonEmptyString(rawOccupant.userId, `${path}.${key}.userId`),
              profile: parseRosterEntry(rawOccupant.profile, `${path}.${key}.profile`),
            },
            `${path}.${key}`,
          );
  }
  return roster;
}

function parseDeathReason(value: unknown, path: string): DeathReason {
  switch (value) {
    case 'wolfKill':
    case 'poison':
    case 'checkDeath':
    case 'wolfQueenLink':
    case 'bondedLink':
    case 'coupleLink':
    case 'dreamcatcherLink':
    case 'scarletLink':
    case 'reflection':
      return value;
    default:
      return fail(path, 'a valid death reason');
  }
}

function parseDeathReasons(value: unknown, path: string): Readonly<Record<number, DeathReason>> {
  const raw = parseObject(value, path);
  const result: Record<number, DeathReason> = {};
  for (const [key, reason] of Object.entries(raw)) {
    const seat = parseSeatKey(key, `${path}.${key}`);
    result[seat] = parseDeathReason(reason, `${path}.${key}`);
  }
  return result;
}

function parseAudioEffect(value: unknown, path: string): AudioEffect {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      audioKey: parseNonEmptyString(raw.audioKey, `${path}.audioKey`),
      isEndAudio: parseOptional(raw.isEndAudio, `${path}.isEndAudio`, parseBoolean),
    },
    path,
  );
}

function parseStringNumberRecord(value: unknown, path: string): Readonly<Record<string, number>> {
  const raw = parseObject(value, path);
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(raw)) {
    result[key] = parseInteger(item, `${path}.${key}`);
  }
  return result;
}

function parseBoardNomination(value: unknown, path: string): BoardNomination {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      displayName: parseString(raw.displayName, `${path}.displayName`),
      roles: parseRoleIds(raw.roles, `${path}.roles`),
      upvoters: parseArray(raw.upvoters, `${path}.upvoters`, parseNonEmptyString),
    },
    path,
  );
}

function parseBoardNominations(
  value: unknown,
  path: string,
): Readonly<Record<string, BoardNomination>> {
  const raw = parseObject(value, path);
  const result: Record<string, BoardNomination> = {};
  for (const [userId, nomination] of Object.entries(raw)) {
    if (userId.length === 0) fail(`${path}.${userId}`, 'a non-empty user ID key');
    result[userId] = parseBoardNomination(nomination, `${path}.${userId}`);
  }
  return result;
}

function parseSheriffBallots(
  value: unknown,
  path: string,
): Readonly<Record<number, number | null>> {
  const raw = parseObject(value, path);
  const result: Record<number, number | null> = {};
  for (const [key, target] of Object.entries(raw)) {
    const seat = parseSeatKey(key, `${path}.${key}`);
    result[seat] = parseNullable(target, `${path}.${key}`, parseSeat);
  }
  return result;
}

function parseSheriffVoteCounts(value: unknown, path: string): Readonly<Record<number, number>> {
  const raw = parseObject(value, path);
  const result: Record<number, number> = {};
  for (const [key, countValue] of Object.entries(raw)) {
    const seat = parseSeatKey(key, `${path}.${key}`);
    const count = parseInteger(countValue, `${path}.${key}`);
    if (count < 0) return fail(`${path}.${key}`, 'a non-negative vote count');
    result[seat] = count;
  }
  return result;
}

function parseSheriffRoundResult(value: unknown, path: string): SheriffElectionRoundResult {
  const raw = parseObject(value, path);
  const round = (() => {
    if (raw.round === 'first' || raw.round === 'runoff') return raw.round;
    return fail(`${path}.round`, 'first or runoff');
  })();
  return finishObject(
    raw,
    {
      round,
      candidateSeats: parseArray(raw.candidateSeats, `${path}.candidateSeats`, parseSeat),
      eligibleVoterSeats: parseArray(
        raw.eligibleVoterSeats,
        `${path}.eligibleVoterSeats`,
        parseSeat,
      ),
      ballots: parseSheriffBallots(raw.ballots, `${path}.ballots`),
      voteCounts: parseSheriffVoteCounts(raw.voteCounts, `${path}.voteCounts`),
      abstainingSeats: parseArray(raw.abstainingSeats, `${path}.abstainingSeats`, parseSeat),
    },
    path,
  );
}

function parseSheriffElection(value: unknown, path: string): SheriffElectionState {
  const raw = parseObject(value, path);
  const common = {
    registeredSeats: parseArray(raw.registeredSeats, `${path}.registeredSeats`, parseSeat),
    withdrawnSeats: parseArray(raw.withdrawnSeats, `${path}.withdrawnSeats`, parseSeat),
    completedRounds: parseArray(
      raw.completedRounds,
      `${path}.completedRounds`,
      parseSheriffRoundResult,
    ),
  };
  switch (raw.phase) {
    case 'registration':
    case 'completed':
      return finishObject(raw, { ...common, phase: raw.phase }, path);
    case 'candidateSpeech': {
      return finishObject(
        raw,
        {
          ...common,
          phase: raw.phase,
          speakingStartSeat: parseSeat(raw.speakingStartSeat, `${path}.speakingStartSeat`),
          speakingDirection: parseSheriffSpeakingDirection(
            raw.speakingDirection,
            `${path}.speakingDirection`,
          ),
        },
        path,
      );
    }
    case 'firstVote':
    case 'runoffVote':
      return finishObject(
        raw,
        {
          ...common,
          phase: raw.phase,
          candidateSeats: parseArray(raw.candidateSeats, `${path}.candidateSeats`, parseSeat),
          eligibleVoterSeats: parseArray(
            raw.eligibleVoterSeats,
            `${path}.eligibleVoterSeats`,
            parseSeat,
          ),
          ballots: parseSheriffBallots(raw.ballots, `${path}.ballots`),
          deadline: parseOptional(raw.deadline, `${path}.deadline`, parseInteger),
        },
        path,
      );
    case 'runoffSpeech': {
      return finishObject(
        raw,
        {
          ...common,
          phase: raw.phase,
          candidateSeats: parseArray(raw.candidateSeats, `${path}.candidateSeats`, parseSeat),
          speakingStartSeat: parseSeat(raw.speakingStartSeat, `${path}.speakingStartSeat`),
          speakingDirection: parseSheriffSpeakingDirection(
            raw.speakingDirection,
            `${path}.speakingDirection`,
          ),
        },
        path,
      );
    }
    case 'result': {
      const next = parseObject(raw.next, `${path}.next`);
      const parsedNext =
        next.kind === 'final'
          ? finishObject(
              next,
              {
                kind: 'final' as const,
                result: parseSheriffElectionResult(next.result, `${path}.next.result`),
              },
              `${path}.next`,
            )
          : next.kind === 'runoff'
            ? finishObject(
                next,
                {
                  kind: 'runoff' as const,
                  candidateSeats: parseArray(
                    next.candidateSeats,
                    `${path}.next.candidateSeats`,
                    parseSeat,
                  ),
                  speakingStartSeat: parseSeat(
                    next.speakingStartSeat,
                    `${path}.next.speakingStartSeat`,
                  ),
                  speakingDirection: parseSheriffSpeakingDirection(
                    next.speakingDirection,
                    `${path}.next.speakingDirection`,
                  ),
                },
                `${path}.next`,
              )
            : fail(`${path}.next.kind`, 'final or runoff');
      return finishObject(
        raw,
        {
          ...common,
          phase: 'result' as const,
          deadline: parseInteger(raw.deadline, `${path}.deadline`),
          next: parsedNext,
        },
        path,
      );
    }
    default:
      return fail(`${path}.phase`, 'a valid sheriff election phase');
  }
}

function parseSheriffElectionResult(value: unknown, path: string): SheriffElectionResult {
  const raw = parseObject(value, path);
  if (raw.kind === 'elected') {
    return finishObject(
      raw,
      { kind: raw.kind, sheriffSeat: parseSeat(raw.sheriffSeat, `${path}.sheriffSeat`) },
      path,
    );
  }
  if (raw.kind === 'noSheriff') {
    const reason = (() => {
      switch (raw.reason) {
        case 'noCandidates':
        case 'noVotes':
        case 'runoffTie':
        case 'selfDestruct':
          return raw.reason;
        default:
          return fail(`${path}.reason`, 'a valid no-sheriff reason');
      }
    })();
    return finishObject(raw, { kind: raw.kind, reason }, path);
  }
  return fail(`${path}.kind`, 'elected or noSheriff');
}

export function parseWerewolfState(value: unknown): GameState {
  const raw = parseObject(value, 'GameState');
  const parsed = {
    gameType: (() => {
      if (raw.gameType !== WEREWOLF_GAME_TYPE) {
        return fail('GameState.gameType', WEREWOLF_GAME_TYPE);
      }
      return WEREWOLF_GAME_TYPE;
    })(),
    roomCode: parseNonEmptyString(raw.roomCode, 'GameState.roomCode'),
    hostUserId: parseNonEmptyString(raw.hostUserId, 'GameState.hostUserId'),
    status: parseGameStatus(raw.status, 'GameState.status'),
    templateRoles: parseRoleIds(raw.templateRoles, 'GameState.templateRoles'),
    rules: parseOptional(raw.rules, 'GameState.rules', parseRules),
    players: parsePlayers(raw.players, 'GameState.players'),
    roleViewedSeats: parseArray(raw.roleViewedSeats, 'GameState.roleViewedSeats', parseSeat),
    mvpUserId: parseOptional(raw.mvpUserId, 'GameState.mvpUserId', parseNonEmptyString),
    startingParticipants: parseOptional(
      raw.startingParticipants,
      'GameState.startingParticipants',
      (value, path) =>
        parseArray(value, path, (item, itemPath) => {
          const participant = parseObject(item, itemPath);
          return finishObject(
            participant,
            {
              userId: parseNonEmptyString(participant.userId, `${itemPath}.userId`),
              seat: parseSeat(participant.seat, `${itemPath}.seat`),
            },
            itemPath,
          );
        }),
    ),
    roster: parseSeatRoster(raw.roster, 'GameState.roster'),
    nightState: parseNullable(raw.nightState, 'GameState.nightState', parseWerewolfNightState),
    isAudioPlaying: parseBoolean(raw.isAudioPlaying, 'GameState.isAudioPlaying'),
    audioBatchId: parseAudioBatchId(raw.audioBatchId, 'GameState.audioBatchId'),
    gameSequence: parseGameSequence(raw.gameSequence, 'GameState.gameSequence'),
    roleRevealRandomNonce: parseOptional(
      raw.roleRevealRandomNonce,
      'GameState.roleRevealRandomNonce',
      parseString,
    ),
    lastNightDeaths: parseOptional(raw.lastNightDeaths, 'GameState.lastNightDeaths', (items, p) =>
      parseArray(items, p, parseSeat),
    ),
    lastNightInfoConfirmed: parseOptional(
      raw.lastNightInfoConfirmed,
      'GameState.lastNightInfoConfirmed',
      parseBoolean,
    ),
    reviewCompletedUserIds: parseOptional(
      raw.reviewCompletedUserIds,
      'GameState.reviewCompletedUserIds',
      (items, path) => parseArray(items, path, parseNonEmptyString),
    ),
    deathReasons: parseOptional(raw.deathReasons, 'GameState.deathReasons', parseDeathReasons),
    sheriffElection: parseOptional(
      raw.sheriffElection,
      'GameState.sheriffElection',
      parseSheriffElection,
    ),
    sheriffElectionResult: parseOptional(
      raw.sheriffElectionResult,
      'GameState.sheriffElectionResult',
      parseSheriffElectionResult,
    ),
    pendingAudioEffects: parseArray(
      raw.pendingAudioEffects,
      'GameState.pendingAudioEffects',
      parseAudioEffect,
    ),
    seerLabelMap: parseOptional(
      raw.seerLabelMap,
      'GameState.seerLabelMap',
      parseStringNumberRecord,
    ),
    nightReviewAllowedSeats: parseOptional(
      raw.nightReviewAllowedSeats,
      'GameState.nightReviewAllowedSeats',
      (seats, p) => parseArray(seats, p, parseSeat),
    ),
    bottomCards: parseOptional(raw.bottomCards, 'GameState.bottomCards', parseRoleIds),
    boardNominations: parseOptional(
      raw.boardNominations,
      'GameState.boardNominations',
      parseBoardNominations,
    ),
  } satisfies Complete<GameState>;

  finishObject(raw, parsed, 'GameState');
  return normalizeState(parsed);
}
