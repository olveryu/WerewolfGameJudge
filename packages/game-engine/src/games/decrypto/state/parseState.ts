/** Strict Decrypto persistence and transport codec. */

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
import { normalizeDecryptoState } from './normalize';
import {
  DECRYPTO_CODES,
  DECRYPTO_ENCRYPTOR_MODES,
  DECRYPTO_GAME_TYPE,
  DECRYPTO_PHASES,
  DECRYPTO_TEAMS,
  type DecryptoAssignments,
  type DecryptoClueTriple,
  type DecryptoCode,
  type DecryptoConfig,
  type DecryptoEncryptors,
  type DecryptoGame,
  type DecryptoGuess,
  type DecryptoHistory,
  type DecryptoHistoryEntry,
  type DecryptoKeywords,
  type DecryptoKeywordSets,
  type DecryptoMarks,
  type DecryptoPhase,
  type DecryptoState,
  type DecryptoTeam,
  isValidDecryptoConfig,
} from './types';

function tuple<T>(
  value: unknown,
  path: string,
  decoder: (value: unknown, path: string) => T,
): [T, T, T] {
  const items = parseArray(value, path, decoder);
  if (items.length !== 3) failDecode(path, 'a three-item tuple');
  return [items[0]!, items[1]!, items[2]!];
}

function keywordTuple(value: unknown, path: string): DecryptoKeywords {
  const items = parseArray(value, path, parseNonEmptyString);
  if (items.length !== 4) failDecode(path, 'a four-item keyword tuple');
  return [items[0]!, items[1]!, items[2]!, items[3]!];
}

function parseCode(value: unknown, path: string): DecryptoCode {
  return tuple(value, path, (item, itemPath) => parseChoice(item, itemPath, DECRYPTO_CODES));
}

function parseGuess(value: unknown, path: string): DecryptoGuess {
  return parseCode(value, path);
}

function parseTeamRecord<T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, itemPath: string) => T,
): Record<DecryptoTeam, T> {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      blue: parseItem(raw.blue, `${path}.blue`),
      purple: parseItem(raw.purple, `${path}.purple`),
    },
    path,
  );
}

function parseAssignments(value: unknown, path: string): DecryptoAssignments {
  const raw = parseObject(value, path);
  const assignments: Record<number, DecryptoTeam> = {};
  for (const [seat, team] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(seat)) failDecode(`${path}.${seat}`, 'a seat key');
    assignments[Number(seat)] = parseChoice(team, `${path}.${seat}`, DECRYPTO_TEAMS);
  }
  return assignments;
}

function parseNullableSeat(value: unknown, path: string): number | null {
  return parseNullable(value, path, parseSeat);
}

function parseKeywordSets(value: unknown, path: string): DecryptoKeywordSets {
  return parseTeamRecord(value, path, keywordTuple);
}

function parseEncryptors(value: unknown, path: string): DecryptoEncryptors {
  return parseTeamRecord(value, path, parseSeat);
}

function parseNullableEncryptors(value: unknown, path: string): DecryptoEncryptors | null {
  return parseNullable(value, path, parseEncryptors);
}

function parseClues(value: unknown, path: string) {
  const parseClueTriple = (item: unknown, itemPath: string): DecryptoClueTriple =>
    tuple(item, itemPath, parseNonEmptyString);
  return parseTeamRecord(value, path, (item, itemPath) =>
    parseNullable(item, itemPath, (clues, cluesPath) => parseClueTriple(clues, cluesPath)),
  );
}

function parseNullableGuess(value: unknown, path: string): DecryptoGuess | null {
  return parseNullable(value, path, parseGuess);
}

function parseHistoryEntry(value: unknown, path: string): DecryptoHistoryEntry {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      round: parseInteger(raw.round, `${path}.round`),
      team: parseChoice(raw.team, `${path}.team`, DECRYPTO_TEAMS),
      code: parseCode(raw.code, `${path}.code`),
      clues: tuple(raw.clues, `${path}.clues`, parseNonEmptyString),
      decode: parseGuess(raw.decode, `${path}.decode`),
      intercept: parseNullable(raw.intercept, `${path}.intercept`, parseGuess),
    },
    path,
  );
}

function parseHistory(value: unknown, path: string): DecryptoHistory {
  return parseTeamRecord(value, path, (item, itemPath) =>
    parseArray(item, itemPath, parseHistoryEntry),
  );
}

function parseMarks(value: unknown, path: string): DecryptoMarks {
  return parseTeamRecord(value, path, parseInteger);
}

function parseNullableKeywords(value: unknown, path: string): DecryptoKeywords | null {
  return parseNullable(value, path, keywordTuple);
}

function parseNullableJudgements(value: unknown, path: string): readonly boolean[] | null {
  return parseNullable(value, path, (item, itemPath) => {
    const judgements = parseArray(item, itemPath, parseBoolean);
    if (judgements.length !== 4) failDecode(itemPath, 'a four-item judgement tuple');
    return judgements;
  });
}

function parseGame(value: unknown, path: string): DecryptoGame {
  const raw = parseObject(value, path);
  return finishObject(
    raw,
    {
      keywords: parseNullable(raw.keywords, `${path}.keywords`, parseKeywordSets),
      encryptors: parseNullableEncryptors(raw.encryptors, `${path}.encryptors`),
      assignments: parseAssignments(raw.assignments, `${path}.assignments`),
      round: parseInteger(raw.round, `${path}.round`),
      step: parseChoice(raw.step, `${path}.step`, [
        'encrypt',
        'guess',
        'reveal',
        'continue',
        'tiebreakSubmit',
        'tiebreakJudge',
      ]),
      activeTeam: parseNullable(raw.activeTeam, `${path}.activeTeam`, (team, teamPath) =>
        parseChoice(team, teamPath, DECRYPTO_TEAMS),
      ),
      codes: parseTeamRecord(raw.codes, `${path}.codes`, parseCode),
      clues: parseClues(raw.clues, `${path}.clues`),
      decoded: parseTeamRecord(raw.decoded, `${path}.decoded`, parseNullableGuess),
      intercepted: parseTeamRecord(raw.intercepted, `${path}.intercepted`, parseNullableGuess),
      revealSequence: parseArray(raw.revealSequence, `${path}.revealSequence`, (item, itemPath) =>
        parseChoice(item, itemPath, ['intercept', 'decode', 'code'] as const),
      ),
      revealIndex: parseInteger(raw.revealIndex, `${path}.revealIndex`),
      revealAt: parseNullable(raw.revealAt, `${path}.revealAt`, parseInteger),
      history: parseHistory(raw.history, `${path}.history`),
      interceptions: parseMarks(raw.interceptions, `${path}.interceptions`),
      miscommunications: parseMarks(raw.miscommunications, `${path}.miscommunications`),
      tiebreakGuesses: parseTeamRecord(
        raw.tiebreakGuesses,
        `${path}.tiebreakGuesses`,
        parseNullableKeywords,
      ),
      tiebreakJudgements: parseTeamRecord(
        raw.tiebreakJudgements,
        `${path}.tiebreakJudgements`,
        parseNullableJudgements,
      ),
      outcome: parseNullable(raw.outcome, `${path}.outcome`, (item, itemPath) =>
        parseChoice(item, itemPath, [...DECRYPTO_TEAMS, 'shared'] as const),
      ),
    },
    path,
  );
}

function parseNullableEncryptorChoices(value: unknown, path: string) {
  return parseTeamRecord(value, path, parseNullableSeat);
}

function phase(value: unknown, path: string): DecryptoPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, DECRYPTO_PHASES);
  switch (kind) {
    case 'lobby':
      return finishObject(raw, { kind: 'lobby' as const }, path);
    case 'teams':
      return finishObject(
        raw,
        {
          kind,
          assignments: parseAssignments(raw.assignments, `${path}.assignments`),
          encryptors: parseNullableEncryptorChoices(raw.encryptors, `${path}.encryptors`),
        },
        path,
      );
    case 'preparing':
      return finishObject(
        raw,
        {
          kind,
          assignments: parseAssignments(raw.assignments, `${path}.assignments`),
          encryptors: parseEncryptors(raw.encryptors, `${path}.encryptors`),
          requestId: parseNonEmptyString(raw.requestId, `${path}.requestId`),
        },
        path,
      );
    case 'playing':
    case 'ended':
      return finishObject(raw, { kind, game: parseGame(raw.game, `${path}.game`) }, path);
  }
}

/** Parses only supported Decrypto lobby settings. */
export function parseDecryptoConfig(value: unknown, path = 'DecryptoConfig'): DecryptoConfig {
  const raw = parseObject(value, path);
  const config: DecryptoConfig = finishObject(
    raw,
    {
      numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`),
      encryptorMode: parseChoice(
        raw.encryptorMode,
        `${path}.encryptorMode`,
        DECRYPTO_ENCRYPTOR_MODES,
      ),
    },
    path,
  );
  if (!isValidDecryptoConfig(config))
    failDecode(`${path}.numberOfPlayers`, 'a supported player count');
  return config;
}

/** Restores complete authoritative state and rejects unknown or malformed fields. */
export function parseDecryptoState(value: unknown): DecryptoState {
  const path = 'DecryptoState';
  const raw = parseObject(value, path);
  return normalizeDecryptoState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [DECRYPTO_GAME_TYPE]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseDecryptoConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
      },
      path,
    ),
  );
}
