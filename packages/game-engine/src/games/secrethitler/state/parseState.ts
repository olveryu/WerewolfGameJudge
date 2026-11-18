/** Strict Secrethitler persistence and transport codec. */

import { type AudioEffect, parseAudioBatchId } from '../../../platform/audio';
import {
  failDecode,
  finishObject,
  parseArray,
  parseBoolean,
  parseChoice,
  parseInteger,
  parseNonEmptyString,
  parseObject,
  parseSeat,
} from '../../../platform/protocol/runtimeDecoder';
import { parseRoomRoster } from '../../../platform/room/roster';
import { normalizeSecrethitlerState } from './normalize';
import {
  isValidSecrethitlerConfig,
  SECRETHITLER_GAME_TYPE,
  SECRETHITLER_PHASES,
  type SecrethitlerConfig,
  type SecrethitlerPhase,
  type SecrethitlerPolicy,
  type SecrethitlerRole,
  type SecrethitlerState,
  type SecrethitlerVote,
} from './types';
import { SECRETHITLER_STATE_VERSION } from './version';

/** Parses only the supported lobby settings. */
export function parseSecrethitlerConfig(
  value: unknown,
  path = 'SecrethitlerConfig',
): SecrethitlerConfig {
  const raw = parseObject(value, path);
  const config: SecrethitlerConfig = finishObject(
    raw,
    { numberOfPlayers: parseInteger(raw.numberOfPlayers, `${path}.numberOfPlayers`) },
    path,
  );
  if (!isValidSecrethitlerConfig(config))
    failDecode(`${path}.numberOfPlayers`, 'a supported player count');
  return config;
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

function audioEffects(value: unknown, path: string): readonly AudioEffect[] {
  if (!Array.isArray(value)) failDecode(path, 'an array');
  return value.map((item, index) => audioEffect(item, `${path}[${index}]`));
}

const ROLES = ['liberal', 'fascist', 'hitler'] as const;
const FACTIONS = ['liberal', 'fascist'] as const;
const POWERS = ['investigate', 'specialElection', 'execute', 'policyPeek'] as const;
const END_REASONS = [
  'liberalPolicies',
  'hitlerExecuted',
  'fascistPolicies',
  'hitlerElected',
] as const;

function nullableSeat(value: unknown, path: string): number | null {
  return value === null ? null : parseSeat(value, path);
}

function identities(value: unknown, path: string): Readonly<Record<number, SecrethitlerRole>> {
  const raw = parseObject(value, path);
  const result: Record<number, SecrethitlerRole> = {};
  for (const [key, identity] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = parseChoice(
      identity,
      `${path}.${key}`,
      ROLES,
    );
  }
  return result;
}

function policies(value: unknown, path: string): readonly SecrethitlerPolicy[] {
  return parseArray(value, path, (item, itemPath) => parseChoice(item, itemPath, FACTIONS));
}

function voteMap(value: unknown, path: string): Readonly<Record<number, SecrethitlerVote>> {
  const raw = parseObject(value, path);
  const result: Record<number, SecrethitlerVote> = {};
  for (const [key, vote] of Object.entries(raw)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) failDecode(`${path}.${key}`, 'a canonical seat key');
    result[parseSeat(Number(key), `${path}.${key}`)] = parseChoice(vote, `${path}.${key}`, [
      'ja',
      'nein',
    ]);
  }
  return result;
}

function history(value: unknown, path: string): SecrethitlerState['history'] {
  const raw = parseObject(value, path);
  const governments = parseArray(raw.governments, `${path}.governments`, (item, itemPath) => {
    const government = parseObject(item, itemPath);
    const votes =
      government.votes === null
        ? null
        : parseArray(government.votes, `${itemPath}.votes`, (voteItem, votePath) => {
            const vote = parseObject(voteItem, votePath);
            return finishObject(
              vote,
              {
                seat: parseSeat(vote.seat, `${votePath}.seat`),
                vote: parseChoice(vote.vote, `${votePath}.vote`, ['ja', 'nein']),
              },
              votePath,
            );
          });
    return finishObject(
      government,
      {
        presidentSeat: parseSeat(government.presidentSeat, `${itemPath}.presidentSeat`),
        chancellorSeat: parseSeat(government.chancellorSeat, `${itemPath}.chancellorSeat`),
        outcome: parseChoice(government.outcome, `${itemPath}.outcome`, [
          'pending',
          'passed',
          'rejected',
        ]),
        votes,
      },
      itemPath,
    );
  });
  const policiesHistory = parseArray(raw.policies, `${path}.policies`, (item, itemPath) => {
    const policy = parseObject(item, itemPath);
    return finishObject(
      policy,
      {
        policy: parseChoice(policy.policy, `${itemPath}.policy`, FACTIONS),
        source: parseChoice(policy.source, `${itemPath}.source`, ['government', 'chaos']),
      },
      itemPath,
    );
  });
  const actions = parseArray(raw.actions, `${path}.actions`, (item, itemPath) => {
    const action = parseObject(item, itemPath);
    return finishObject(
      action,
      {
        action: parseChoice(action.action, `${itemPath}.action`, POWERS),
        presidentSeat: parseSeat(action.presidentSeat, `${itemPath}.presidentSeat`),
        targetSeat: nullableSeat(action.targetSeat, `${itemPath}.targetSeat`),
      },
      itemPath,
    );
  });
  return finishObject(raw, { governments, policies: policiesHistory, actions }, path);
}

function phase(value: unknown, path: string): SecrethitlerPhase {
  const raw = parseObject(value, path);
  const kind = parseChoice(raw.kind, `${path}.kind`, SECRETHITLER_PHASES);
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
          step: parseInteger(raw.step, `${path}.step`),
          confirmedSeats: parseArray(raw.confirmedSeats, `${path}.confirmedSeats`, parseSeat),
        },
        path,
      );
    case 'election':
      return finishObject(
        raw,
        {
          kind: 'election' as const,
          presidentSeat: parseSeat(raw.presidentSeat, `${path}.presidentSeat`),
          returnToSeat: nullableSeat(raw.returnToSeat, `${path}.returnToSeat`),
        },
        path,
      );
    case 'voting':
      return finishObject(
        raw,
        {
          kind: 'voting' as const,
          presidentSeat: parseSeat(raw.presidentSeat, `${path}.presidentSeat`),
          chancellorSeat: parseSeat(raw.chancellorSeat, `${path}.chancellorSeat`),
          returnToSeat: nullableSeat(raw.returnToSeat, `${path}.returnToSeat`),
          votes: voteMap(raw.votes, `${path}.votes`),
        },
        path,
      );
    case 'legislativeChancellor':
      return finishObject(
        raw,
        {
          kind,
          presidentSeat: parseSeat(raw.presidentSeat, `${path}.presidentSeat`),
          chancellorSeat: parseSeat(raw.chancellorSeat, `${path}.chancellorSeat`),
          returnToSeat: nullableSeat(raw.returnToSeat, `${path}.returnToSeat`),
          hand: policies(raw.hand, `${path}.hand`),
          vetoRejected: parseBoolean(raw.vetoRejected, `${path}.vetoRejected`),
        },
        path,
      );
    case 'legislativePresident':
    case 'vetoResponse':
      return finishObject(
        raw,
        {
          kind,
          presidentSeat: parseSeat(raw.presidentSeat, `${path}.presidentSeat`),
          chancellorSeat: parseSeat(raw.chancellorSeat, `${path}.chancellorSeat`),
          returnToSeat: nullableSeat(raw.returnToSeat, `${path}.returnToSeat`),
          hand: policies(raw.hand, `${path}.hand`),
        },
        path,
      );
    case 'executive':
      return finishObject(
        raw,
        {
          kind: 'executive' as const,
          presidentSeat: parseSeat(raw.presidentSeat, `${path}.presidentSeat`),
          returnToSeat: nullableSeat(raw.returnToSeat, `${path}.returnToSeat`),
          power: parseChoice(raw.power, `${path}.power`, POWERS),
          preview: policies(raw.preview, `${path}.preview`),
        },
        path,
      );
    case 'ended':
      return finishObject(
        raw,
        {
          kind: 'ended' as const,
          winner: parseChoice(raw.winner, `${path}.winner`, FACTIONS),
          reason: parseChoice(raw.reason, `${path}.reason`, END_REASONS),
        },
        path,
      );
  }
}

/** Restores the complete authoritative state and rejects unknown or malformed fields. */
export function parseSecrethitlerState(value: unknown): SecrethitlerState {
  const path = 'SecrethitlerState';
  const raw = parseObject(value, path);
  return normalizeSecrethitlerState(
    finishObject(
      raw,
      {
        gameType: parseChoice(raw.gameType, `${path}.gameType`, [SECRETHITLER_GAME_TYPE]),
        stateVersion: parseChoice(raw.stateVersion, `${path}.stateVersion`, [
          SECRETHITLER_STATE_VERSION,
        ]),
        roomCode: parseNonEmptyString(raw.roomCode, `${path}.roomCode`),
        hostUserId: parseNonEmptyString(raw.hostUserId, `${path}.hostUserId`),
        phase: phase(raw.phase, `${path}.phase`),
        phaseRevision: parseInteger(raw.phaseRevision, `${path}.phaseRevision`),
        config: parseSecrethitlerConfig(raw.config, `${path}.config`),
        roster: parseRoomRoster(raw.roster, `${path}.roster`),
        identities: identities(raw.identities, `${path}.identities`),
        roleViewedSeats: parseArray(raw.roleViewedSeats, `${path}.roleViewedSeats`, parseSeat),
        gameSequence: parseInteger(raw.gameSequence, `${path}.gameSequence`),
        xpSettled: parseBoolean(raw.xpSettled, `${path}.xpSettled`),
        pendingAudioEffects: audioEffects(raw.pendingAudioEffects, `${path}.pendingAudioEffects`),
        isAudioPlaying: parseBoolean(raw.isAudioPlaying, `${path}.isAudioPlaying`),
        audioBatchId: parseAudioBatchId(raw.audioBatchId, `${path}.audioBatchId`),
        livingSeats: parseArray(raw.livingSeats, `${path}.livingSeats`, parseSeat),
        nextPresidentSeat: parseSeat(raw.nextPresidentSeat, `${path}.nextPresidentSeat`),
        electionTracker: parseInteger(raw.electionTracker, `${path}.electionTracker`),
        lastPresidentSeat: nullableSeat(raw.lastPresidentSeat, `${path}.lastPresidentSeat`),
        lastChancellorSeat: nullableSeat(raw.lastChancellorSeat, `${path}.lastChancellorSeat`),
        liberalPolicies: parseInteger(raw.liberalPolicies, `${path}.liberalPolicies`),
        fascistPolicies: parseInteger(raw.fascistPolicies, `${path}.fascistPolicies`),
        policyDeck: policies(raw.policyDeck, `${path}.policyDeck`),
        policyDiscard: policies(raw.policyDiscard, `${path}.policyDiscard`),
        investigatedSeats: parseArray(
          raw.investigatedSeats,
          `${path}.investigatedSeats`,
          parseSeat,
        ),
        lastInvestigation:
          raw.lastInvestigation === null
            ? null
            : (() => {
                const investigation = parseObject(
                  raw.lastInvestigation,
                  `${path}.lastInvestigation`,
                );
                return finishObject(
                  investigation,
                  {
                    presidentSeat: parseSeat(
                      investigation.presidentSeat,
                      `${path}.lastInvestigation.presidentSeat`,
                    ),
                    targetSeat: parseSeat(
                      investigation.targetSeat,
                      `${path}.lastInvestigation.targetSeat`,
                    ),
                    faction: parseChoice(
                      investigation.faction,
                      `${path}.lastInvestigation.faction`,
                      FACTIONS,
                    ),
                  },
                  `${path}.lastInvestigation`,
                );
              })(),
        history: history(raw.history, `${path}.history`),
      },
      path,
    ),
  );
}

/** Preserves v1 recognition and narration while merging audio-only steps into their batches. */
export function migratePersistedSecrethitlerState(value: unknown): SecrethitlerState {
  const raw = parseObject(value, 'SecrethitlerState');
  if (raw.stateVersion !== 1) return parseSecrethitlerState(raw);
  const previousPhase = phase(raw.phase, 'SecrethitlerState.phase');
  const upgraded = { ...raw, stateVersion: SECRETHITLER_STATE_VERSION };
  if (previousPhase.kind !== 'night' || previousPhase.step === 1)
    return parseSecrethitlerState(upgraded);
  if (![0, 2, 3].includes(previousPhase.step) || previousPhase.confirmedSeats.length !== 0)
    failDecode('SecrethitlerState.phase', 'a valid v1 night step');
  const pending = audioEffects(raw.pendingAudioEffects, 'SecrethitlerState.pendingAudioEffects');
  const wasAudioPlaying = parseBoolean(raw.isAudioPlaying, 'SecrethitlerState.isAudioPlaying');
  const appendAudioKey =
    previousPhase.step === 0
      ? parseSecrethitlerConfig(raw.config).numberOfPlayers <= 6
        ? 'evil_reveal_5_6'
        : 'fascist_reveal_7_10'
      : previousPhase.step === 2
        ? 'night_end'
        : null;
  return parseSecrethitlerState({
    ...upgraded,
    phase:
      previousPhase.step === 0
        ? { kind: 'night', step: 1, confirmedSeats: [] }
        : {
            kind: 'election',
            presidentSeat: parseSeat(raw.nextPresidentSeat, 'SecrethitlerState.nextPresidentSeat'),
            returnToSeat: null,
          },
    phaseRevision: parseInteger(raw.phaseRevision, 'SecrethitlerState.phaseRevision') + 1,
    pendingAudioEffects:
      appendAudioKey === null ? pending : [...pending, { audioKey: appendAudioKey }],
    isAudioPlaying: appendAudioKey === null ? wasAudioPlaying : true,
    audioBatchId:
      parseAudioBatchId(raw.audioBatchId, 'SecrethitlerState.audioBatchId') +
      (appendAudioKey === null ? 0 : 1),
  });
}
