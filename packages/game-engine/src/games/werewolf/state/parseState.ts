/** Runtime decoder for persisted and transported Werewolf state. */

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
import type { RosterEntry } from '../../../platform/room/roster';
import type { DeathReason } from '../domain/DeathCalculator';
import { GameStatus } from '../domain/models/GameStatus';
import { isValidRoleId, type RoleId } from '../domain/models/roles';
import type { WolfKillOverride } from '../domain/models/roles/spec/schema.types';
import { isValidSchemaId } from '../domain/models/roles/spec/schemas';
import { Team } from '../domain/models/roles/spec/types';
import type { GameRuleOverrides } from '../domain/models/Template';
import type {
  AudioEffect,
  BoardNomination,
  ConfirmStatus,
  GameState,
  Player,
  ProtocolAction,
} from '../domain/protocol/types';
import type { CurrentNightResults } from '../domain/resolvers/types';
import { type Complete, normalizeState } from '../domain/state/normalize';
import { WEREWOLF_STATE_VERSION } from './version';

function parseSeatOrNoTarget(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < -1) return fail(path, 'a seat number or -1');
  return parsed;
}

function parseSeatPair(value: unknown, path: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return fail(path, 'a two-seat tuple');
  }
  return [parseSeat(value[0], `${path}[0]`), parseSeat(value[1], `${path}[1]`)];
}

function parseRoleId(value: unknown, path: string): RoleId {
  if (typeof value !== 'string' || !isValidRoleId(value)) {
    return fail(path, 'a registered role ID');
  }
  return value;
}

function parseRoleIds(value: unknown, path: string): RoleId[] {
  return parseArray(value, path, parseRoleId);
}

function parseSchemaId(value: unknown, path: string): ProtocolAction['schemaId'] {
  if (typeof value !== 'string' || !isValidSchemaId(value)) {
    return fail(path, 'a registered schema ID');
  }
  return value;
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
    case GameStatus.Ended:
      return GameStatus.Ended;
    default:
      return fail(path, 'a valid Werewolf game status');
  }
}

function parseTeam(value: unknown, path: string): Team {
  switch (value) {
    case Team.Wolf:
      return Team.Wolf;
    case Team.Good:
      return Team.Good;
    case Team.Third:
      return Team.Third;
    default:
      return fail(path, 'a valid team');
  }
}

function parseRules(value: unknown, path: string): GameRuleOverrides {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      isPlagueMode: parseOptional(raw.isPlagueMode, `${path}.isPlagueMode`, parseBoolean),
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
      userId: parseNonEmptyString(raw.userId, `${path}.userId`),
      seat: parseSeat(raw.seat, `${path}.seat`),
      role: parseOptional(raw.role, `${path}.role`, (role, rolePath) =>
        parseNullable(role, rolePath, parseRoleId),
      ),
      hasViewedRole: parseBoolean(raw.hasViewedRole, `${path}.hasViewedRole`),
      isBot: parseOptional(raw.isBot, `${path}.isBot`, parseBoolean),
    },
    path,
  );
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
    {
      displayName: parseString(raw.displayName, `${path}.displayName`),
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

function parseRoster(value: unknown, path: string): Record<string, RosterEntry> {
  const raw = parseObject(value, path);
  const roster: Record<string, RosterEntry> = {};
  for (const [userId, entry] of Object.entries(raw)) {
    if (userId.length === 0) fail(`${path}.${userId}`, 'a non-empty user ID key');
    roster[userId] = parseRosterEntry(entry, `${path}.${userId}`);
  }
  return roster;
}

function parseProtocolAction(value: unknown, path: string): ProtocolAction {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      schemaId: parseSchemaId(raw.schemaId, `${path}.schemaId`),
      actorSeat: parseSeat(raw.actorSeat, `${path}.actorSeat`),
      targetSeat: parseOptional(raw.targetSeat, `${path}.targetSeat`, parseSeat),
      timestamp: parseInteger(raw.timestamp, `${path}.timestamp`),
    },
    path,
  );
}

function parseWolfKillOverride(value: unknown, path: string): WolfKillOverride {
  const raw = parseObject(value, path);
  const source = (() => {
    if (raw.source === 'nightmare' || raw.source === 'poisoner') return raw.source;
    return fail(`${path}.source`, 'nightmare or poisoner');
  })();
  const uiRaw = parseObject(raw.ui, `${path}.ui`);
  const ui = finishObject(
    uiRaw,
    {
      promptTitle: parseString(uiRaw.promptTitle, `${path}.ui.promptTitle`),
      promptMessage: parseString(uiRaw.promptMessage, `${path}.ui.promptMessage`),
      emptyVoteText: parseString(uiRaw.emptyVoteText, `${path}.ui.emptyVoteText`),
      rejectMessage: parseString(uiRaw.rejectMessage, `${path}.ui.rejectMessage`),
    },
    `${path}.ui`,
  );
  return finishObject(raw, { source, ui }, path);
}

function parseCurrentNightResults(value: unknown, path: string): CurrentNightResults {
  const raw = parseObject(value, path);
  const parsed = {
    wolfVotesBySeat: parseOptional(
      raw.wolfVotesBySeat,
      `${path}.wolfVotesBySeat`,
      parseSeatNumberRecord,
    ),
    blockedSeat: parseOptional(raw.blockedSeat, `${path}.blockedSeat`, parseSeat),
    wolfKillOverride: parseOptional(
      raw.wolfKillOverride,
      `${path}.wolfKillOverride`,
      parseWolfKillOverride,
    ),
    guardedSeat: parseOptional(raw.guardedSeat, `${path}.guardedSeat`, parseSeat),
    savedSeat: parseOptional(raw.savedSeat, `${path}.savedSeat`, parseSeat),
    poisonedSeat: parseOptional(raw.poisonedSeat, `${path}.poisonedSeat`, parseSeat),
    dreamingSeat: parseOptional(raw.dreamingSeat, `${path}.dreamingSeat`, parseSeat),
    charmedSeat: parseOptional(raw.charmedSeat, `${path}.charmedSeat`, parseSeat),
    swappedSeats: parseOptional(raw.swappedSeats, `${path}.swappedSeats`, parseSeatPair),
    silencedSeat: parseOptional(raw.silencedSeat, `${path}.silencedSeat`, parseSeat),
    votebannedSeat: parseOptional(raw.votebannedSeat, `${path}.votebannedSeat`, parseSeat),
    cursedSeat: parseOptional(raw.cursedSeat, `${path}.cursedSeat`, parseSeat),
    shelteredSeat: parseOptional(raw.shelteredSeat, `${path}.shelteredSeat`, parseSeat),
    hypnotizedSeats: parseOptional(raw.hypnotizedSeats, `${path}.hypnotizedSeats`, (seats, p) =>
      parseArray(seats, p, parseSeat),
    ),
    convertedSeat: parseOptional(raw.convertedSeat, `${path}.convertedSeat`, parseSeat),
    shadowMimicTarget: parseOptional(raw.shadowMimicTarget, `${path}.shadowMimicTarget`, parseSeat),
    avengerFaction: parseOptional(raw.avengerFaction, `${path}.avengerFaction`, parseTeam),
    treasureMasterChosenCard: parseOptional(
      raw.treasureMasterChosenCard,
      `${path}.treasureMasterChosenCard`,
      parseRoleId,
    ),
    thiefChosenCard: parseOptional(raw.thiefChosenCard, `${path}.thiefChosenCard`, parseRoleId),
    loverSeats: parseOptional(raw.loverSeats, `${path}.loverSeats`, parseSeatPair),
  } satisfies Complete<CurrentNightResults>;
  return finishObject(raw, parsed, path);
}

function parseSeatNumberRecord(value: unknown, path: string): Readonly<Record<string, number>> {
  const raw = parseObject(value, path);
  const result: Record<string, number> = {};
  for (const [key, target] of Object.entries(raw)) {
    parseSeatKey(key, `${path}.${key}`);
    result[key] = parseSeatOrNoTarget(target, `${path}.${key}`);
  }
  return result;
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
    case 'reflection':
    case 'magicianSwap':
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

function parseTargetFactionReveal(
  value: unknown,
  path: string,
): { targetSeat: number; result: '好人' | '狼人' } {
  const raw = parseObject(value, path);
  const result = (() => {
    if (raw.result === '好人' || raw.result === '狼人') return raw.result;
    return fail(`${path}.result`, '好人 or 狼人');
  })();
  return finishObject(
    raw,
    { targetSeat: parseSeat(raw.targetSeat, `${path}.targetSeat`), result },
    path,
  );
}

function parseTargetStringReveal(
  value: unknown,
  path: string,
): { targetSeat: number; result: string } {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      targetSeat: parseSeat(raw.targetSeat, `${path}.targetSeat`),
      result: parseString(raw.result, `${path}.result`),
    },
    path,
  );
}

function parseWolfRobotReveal(
  value: unknown,
  path: string,
): NonNullable<GameState['wolfRobotReveal']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      targetSeat: parseSeat(raw.targetSeat, `${path}.targetSeat`),
      result: parseString(raw.result, `${path}.result`),
      learnedRoleId: parseRoleId(raw.learnedRoleId, `${path}.learnedRoleId`),
      canShootAsHunter: parseOptional(
        raw.canShootAsHunter,
        `${path}.canShootAsHunter`,
        parseBoolean,
      ),
    },
    path,
  );
}

function parseWolfRobotContext(
  value: unknown,
  path: string,
): NonNullable<GameState['wolfRobotContext']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      learnedSeat: parseSeat(raw.learnedSeat, `${path}.learnedSeat`),
      disguisedRole: parseRoleId(raw.disguisedRole, `${path}.disguisedRole`),
    },
    path,
  );
}

function parseWitchContext(value: unknown, path: string): NonNullable<GameState['witchContext']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      killedSeat: parseSeatOrNoTarget(raw.killedSeat, `${path}.killedSeat`),
      canSave: parseBoolean(raw.canSave, `${path}.canSave`),
      canPoison: parseBoolean(raw.canPoison, `${path}.canPoison`),
    },
    path,
  );
}

function parseConfirmStatus(value: unknown, path: string): ConfirmStatus {
  const raw = parseObject(value, path);
  if (raw.role === 'hunter' || raw.role === 'darkWolfKing') {
    return finishObject(
      raw,
      {
        role: raw.role,
        canShoot: parseBoolean(raw.canShoot, `${path}.canShoot`),
      },
      path,
    );
  }
  if (raw.role === 'avenger') {
    return finishObject(
      raw,
      {
        role: 'avenger',
        faction: parseTeam(raw.faction, `${path}.faction`),
      },
      path,
    );
  }
  if (raw.role === 'hiddenWolf') {
    return finishObject(
      raw,
      {
        role: 'hiddenWolf',
        wolfTeammates: parseArray(raw.wolfTeammates, `${path}.wolfTeammates`, parseSeat),
      },
      path,
    );
  }
  return fail(`${path}.role`, 'a supported confirmation role');
}

function parseActionRejected(
  value: unknown,
  path: string,
): NonNullable<GameState['actionRejected']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      action: parseString(raw.action, `${path}.action`),
      reason: parseString(raw.reason, `${path}.reason`),
      targetUserId: parseNonEmptyString(raw.targetUserId, `${path}.targetUserId`),
      rejectionId: parseNonEmptyString(raw.rejectionId, `${path}.rejectionId`),
    },
    path,
  );
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

function parseUi(value: unknown, path: string): NonNullable<GameState['ui']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      currentActorHint: parseOptional(
        raw.currentActorHint,
        `${path}.currentActorHint`,
        (hint, hintPath) => parseNullable(hint, hintPath, parseCurrentActorHint),
      ),
    },
    path,
  );
}

function parseCurrentActorHint(
  value: unknown,
  path: string,
): NonNullable<NonNullable<GameState['ui']>['currentActorHint']> {
  const raw = parseObject(value, path);
  const kind = (() => {
    switch (raw.kind) {
      case 'blocked_by_nightmare':
      case 'wolf_kill_disabled':
      case 'wolf_unanimity_required':
      case 'wolf_tie_random':
        return raw.kind;
      default:
        return fail(`${path}.kind`, 'a supported actor hint kind');
    }
  })();
  const bottomAction = parseOptional(raw.bottomAction, `${path}.bottomAction`, (action, p) => {
    if (action === 'skipOnly' || action === 'wolfEmptyOnly') return action;
    return fail(p, 'skipOnly or wolfEmptyOnly');
  });
  const promptOverride = parseOptional(
    raw.promptOverride,
    `${path}.promptOverride`,
    (override, overridePath) => {
      const overrideRaw = parseObject(override, overridePath);
      return finishObject(
        overrideRaw,
        {
          title: parseOptional(overrideRaw.title, `${overridePath}.title`, parseString),
          text: parseOptional(overrideRaw.text, `${overridePath}.text`, parseString),
        },
        overridePath,
      );
    },
  );
  return finishObject(
    raw,
    {
      kind,
      targetRoleIds: parseRoleIds(raw.targetRoleIds, `${path}.targetRoleIds`),
      message: parseString(raw.message, `${path}.message`),
      bottomAction,
      promptOverride,
    },
    path,
  );
}

function parseDebugMode(value: unknown, path: string): NonNullable<GameState['debugMode']> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    { botsEnabled: parseBoolean(raw.botsEnabled, `${path}.botsEnabled`) },
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

/** Decode unknown JSON and reject state that does not match the current Werewolf state version. */
export function parseWerewolfState(value: unknown): GameState {
  const raw = parseObject(value, 'GameState');
  const parsed = {
    gameType: (() => {
      if (raw.gameType !== WEREWOLF_GAME_TYPE) {
        return fail('GameState.gameType', WEREWOLF_GAME_TYPE);
      }
      return WEREWOLF_GAME_TYPE;
    })(),
    stateVersion: (() => {
      if (raw.stateVersion !== WEREWOLF_STATE_VERSION) {
        return fail('GameState.stateVersion', String(WEREWOLF_STATE_VERSION));
      }
      return WEREWOLF_STATE_VERSION;
    })(),
    roomCode: parseNonEmptyString(raw.roomCode, 'GameState.roomCode'),
    hostUserId: parseNonEmptyString(raw.hostUserId, 'GameState.hostUserId'),
    status: parseGameStatus(raw.status, 'GameState.status'),
    templateRoles: parseRoleIds(raw.templateRoles, 'GameState.templateRoles'),
    rules: parseOptional(raw.rules, 'GameState.rules', parseRules),
    players: parsePlayers(raw.players, 'GameState.players'),
    roster: parseRoster(raw.roster, 'GameState.roster'),
    currentStepIndex: parseInteger(raw.currentStepIndex, 'GameState.currentStepIndex'),
    isAudioPlaying: parseBoolean(raw.isAudioPlaying, 'GameState.isAudioPlaying'),
    roleRevealRandomNonce: parseOptional(
      raw.roleRevealRandomNonce,
      'GameState.roleRevealRandomNonce',
      parseString,
    ),
    currentStepId: parseOptional(raw.currentStepId, 'GameState.currentStepId', parseSchemaId),
    actions: parseArray(raw.actions, 'GameState.actions', parseProtocolAction),
    currentNightResults: parseOptional(
      raw.currentNightResults,
      'GameState.currentNightResults',
      parseCurrentNightResults,
    ),
    pendingRevealAcks: parseArray(
      raw.pendingRevealAcks,
      'GameState.pendingRevealAcks',
      parseNonEmptyString,
    ),
    lastNightDeaths: parseOptional(raw.lastNightDeaths, 'GameState.lastNightDeaths', (items, p) =>
      parseArray(items, p, parseSeat),
    ),
    deathReasons: parseOptional(raw.deathReasons, 'GameState.deathReasons', parseDeathReasons),
    nightmareBlockedSeat: parseOptional(
      raw.nightmareBlockedSeat,
      'GameState.nightmareBlockedSeat',
      parseSeat,
    ),
    wolfKillOverride: parseOptional(
      raw.wolfKillOverride,
      'GameState.wolfKillOverride',
      parseWolfKillOverride,
    ),
    wolfRobotContext: parseOptional(
      raw.wolfRobotContext,
      'GameState.wolfRobotContext',
      parseWolfRobotContext,
    ),
    witchContext: parseOptional(raw.witchContext, 'GameState.witchContext', parseWitchContext),
    seerReveal: parseOptional(raw.seerReveal, 'GameState.seerReveal', parseTargetFactionReveal),
    mirrorSeerReveal: parseOptional(
      raw.mirrorSeerReveal,
      'GameState.mirrorSeerReveal',
      parseTargetFactionReveal,
    ),
    drunkSeerReveal: parseOptional(
      raw.drunkSeerReveal,
      'GameState.drunkSeerReveal',
      parseTargetFactionReveal,
    ),
    psychicReveal: parseOptional(
      raw.psychicReveal,
      'GameState.psychicReveal',
      parseTargetStringReveal,
    ),
    gargoyleReveal: parseOptional(
      raw.gargoyleReveal,
      'GameState.gargoyleReveal',
      parseTargetStringReveal,
    ),
    pureWhiteReveal: parseOptional(
      raw.pureWhiteReveal,
      'GameState.pureWhiteReveal',
      parseTargetStringReveal,
    ),
    wolfWitchReveal: parseOptional(
      raw.wolfWitchReveal,
      'GameState.wolfWitchReveal',
      parseTargetStringReveal,
    ),
    wolfRobotReveal: parseOptional(
      raw.wolfRobotReveal,
      'GameState.wolfRobotReveal',
      parseWolfRobotReveal,
    ),
    wolfRobotHunterStatusViewed: parseOptional(
      raw.wolfRobotHunterStatusViewed,
      'GameState.wolfRobotHunterStatusViewed',
      parseBoolean,
    ),
    confirmStatus: parseOptional(raw.confirmStatus, 'GameState.confirmStatus', parseConfirmStatus),
    actionRejected: parseOptional(
      raw.actionRejected,
      'GameState.actionRejected',
      parseActionRejected,
    ),
    stepDeadline: parseOptional(raw.stepDeadline, 'GameState.stepDeadline', parseInteger),
    pendingAudioEffects: parseOptional(
      raw.pendingAudioEffects,
      'GameState.pendingAudioEffects',
      (effects, p) => parseArray(effects, p, parseAudioEffect),
    ),
    ui: parseOptional(raw.ui, 'GameState.ui', parseUi),
    debugMode: parseOptional(raw.debugMode, 'GameState.debugMode', parseDebugMode),
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
    hypnotizedSeats: parseArray(raw.hypnotizedSeats, 'GameState.hypnotizedSeats', parseSeat),
    piperRevealAcks: parseArray(raw.piperRevealAcks, 'GameState.piperRevealAcks', parseSeat),
    convertedSeat: parseOptional(raw.convertedSeat, 'GameState.convertedSeat', parseSeat),
    conversionRevealAcks: parseArray(
      raw.conversionRevealAcks,
      'GameState.conversionRevealAcks',
      parseSeat,
    ),
    bottomCards: parseOptional(raw.bottomCards, 'GameState.bottomCards', parseRoleIds),
    treasureMasterSeat: parseOptional(
      raw.treasureMasterSeat,
      'GameState.treasureMasterSeat',
      parseSeat,
    ),
    thiefSeat: parseOptional(raw.thiefSeat, 'GameState.thiefSeat', parseSeat),
    loverSeats: parseOptional(raw.loverSeats, 'GameState.loverSeats', parseSeatPair),
    cupidSeat: parseOptional(raw.cupidSeat, 'GameState.cupidSeat', parseSeat),
    cupidLoversRevealAcks: parseArray(
      raw.cupidLoversRevealAcks,
      'GameState.cupidLoversRevealAcks',
      parseSeat,
    ),
    boardNominations: parseOptional(
      raw.boardNominations,
      'GameState.boardNominations',
      parseBoardNominations,
    ),
  } satisfies Complete<GameState>;

  finishObject(raw, parsed, 'GameState');
  return normalizeState(parsed);
}
