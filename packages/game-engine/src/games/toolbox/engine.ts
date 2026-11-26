/** 聚会工具权威引擎：成员、准备入座、开始/结束，以及骰子和身份牌的本人操作。 */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  requireHost,
  resolveUncontrolledUserActorId,
} from '../../platform/engine';
import type { ToolboxCommand } from './commands/types';
import {
  findToolboxIdentityConfigIssue,
  hasEnoughToolboxCards,
  isCanonicalToolboxToolList,
  isStorableToolboxConfig,
  isUsableToolboxIdentityConfig,
  type ToolboxIdentityConfigIssue,
} from './domain/config';
import {
  commitToolbox,
  TOOLBOX_REASONS,
  type ToolboxDecision,
  type ToolboxEffect,
  type ToolboxEvent,
} from './domain/decision';
import {
  createToolboxDiceCup,
  revealToolboxDice,
  rollToolboxDice,
  setToolboxDiceCount,
  toggleToolboxDieHold,
  type ToolboxCupOutcome,
} from './domain/dice';
import { evolveToolboxState } from './domain/evolve';
import { createToolboxIdentityRound, drawToolboxIdentityIndex } from './domain/identity';
import { buildToolboxSessionId, normalizeToolboxState } from './state/normalize';
import {
  TOOLBOX_GAME_TYPE,
  type ToolboxActivePhase,
  type ToolboxConfig,
  type ToolboxDiceCup,
  type ToolboxState,
} from './state/types';

type ActorResult =
  | { readonly kind: 'actor'; readonly userId: string }
  | { readonly kind: 'rejected'; readonly decision: ToolboxDecision };

function createInitialState(config: ToolboxConfig, context: CreateGameContext): ToolboxState {
  if (!isStorableToolboxConfig(config) || config.tools.length === 0) {
    throw new Error(TOOLBOX_REASONS.configInvalid);
  }
  return normalizeToolboxState({
    gameType: TOOLBOX_GAME_TYPE,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    memberUserIds: [context.hostUserId],
    config,
    configVersion: 0,
    sessionSequence: 0,
    phase: { kind: 'preparing', seatedUserIds: [] },
  });
}

/** 认证用户且仍是房间成员；离开后的旧设备命令在重新进入前被拒绝。 */
function resolveMember(state: ToolboxState, context: CommandContext): ActorResult {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return { kind: 'rejected', decision: reject(actor.reason) };
  if (!state.memberUserIds.includes(actor.value)) {
    return { kind: 'rejected', decision: reject(TOOLBOX_REASONS.notMember) };
  }
  return { kind: 'actor', userId: actor.value };
}

function resolveHostMember(state: ToolboxState, context: CommandContext): ActorResult {
  const hostRejection = requireHost<ToolboxEvent, ToolboxEffect>(
    context,
    state.hostUserId,
    TOOLBOX_REASONS.notHost,
  );
  if (hostRejection !== null) return { kind: 'rejected', decision: hostRejection };
  return resolveMember(state, context);
}

function rejectIdentityIssue(issue: ToolboxIdentityConfigIssue): ToolboxDecision {
  return reject(
    issue.kind === 'nameDuplicate'
      ? TOOLBOX_REASONS.identityNameDuplicate
      : TOOLBOX_REASONS.configInvalid,
  );
}

function decideMembership(
  state: ToolboxState,
  command: Extract<ToolboxCommand, { type: 'toolbox.member.join' | 'toolbox.member.leave' }>,
  context: CommandContext,
): ToolboxDecision {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const isMember = state.memberUserIds.includes(actor.value);
  if (command.type === 'toolbox.member.join') {
    return commitToolbox(isMember ? [] : [{ type: 'toolbox.member.joined', userId: actor.value }]);
  }
  return commitToolbox(isMember ? [{ type: 'toolbox.member.left', userId: actor.value }] : []);
}

function decideSeat(
  state: ToolboxState,
  command: Extract<
    ToolboxCommand,
    { type: 'toolbox.seat.take' | 'toolbox.seat.release' | 'toolbox.seats.clear' }
  >,
  context: CommandContext,
): ToolboxDecision {
  const actor =
    command.type === 'toolbox.seats.clear'
      ? resolveHostMember(state, context)
      : resolveMember(state, context);
  if (actor.kind === 'rejected') return actor.decision;
  if (state.phase.kind !== 'preparing') return reject(TOOLBOX_REASONS.alreadyStarted);
  const seated = state.phase.seatedUserIds;
  switch (command.type) {
    case 'toolbox.seat.take':
      return commitToolbox(
        seated.includes(actor.userId) ? [] : [{ type: 'toolbox.seat.taken', userId: actor.userId }],
      );
    case 'toolbox.seat.release':
      return commitToolbox(
        seated.includes(actor.userId)
          ? [{ type: 'toolbox.seat.released', userId: actor.userId }]
          : [],
      );
    case 'toolbox.seats.clear':
      if (seated.length === 0) return reject(TOOLBOX_REASONS.noSeated);
      return commitToolbox([{ type: 'toolbox.seats.cleared' }]);
  }
}

function decideConfigUpdate(
  state: ToolboxState,
  config: ToolboxConfig,
  context: CommandContext,
): ToolboxDecision {
  const actor = resolveHostMember(state, context);
  if (actor.kind === 'rejected') return actor.decision;
  if (state.phase.kind !== 'preparing') return reject(TOOLBOX_REASONS.alreadyStarted);
  if (!isCanonicalToolboxToolList(config.tools)) return reject(TOOLBOX_REASONS.configInvalid);
  if (config.tools.length === 0) return reject(TOOLBOX_REASONS.noTools);
  // An empty identity draft is storable while the identity tool is off.
  const identityIssue = findToolboxIdentityConfigIssue(config.identity);
  const isDraftOnly = identityIssue?.kind === 'noIdentities' && !config.tools.includes('identity');
  if (identityIssue !== null && !isDraftOnly) return rejectIdentityIssue(identityIssue);
  return commitToolbox([{ type: 'toolbox.config.updated', config }]);
}

function decideBegin(
  state: ToolboxState,
  configVersion: number,
  context: CommandContext,
): ToolboxDecision {
  const actor = resolveHostMember(state, context);
  if (actor.kind === 'rejected') return actor.decision;
  if (state.phase.kind !== 'preparing') return reject(TOOLBOX_REASONS.alreadyStarted);
  if (configVersion !== state.configVersion) return reject(TOOLBOX_REASONS.configChanged);
  const participantUserIds = state.phase.seatedUserIds;
  if (participantUserIds.length === 0) return reject(TOOLBOX_REASONS.noSeated);
  const { tools, identity } = state.config;
  if (tools.length === 0) return reject(TOOLBOX_REASONS.noTools);
  const usesIdentity = tools.includes('identity');
  if (usesIdentity && !isUsableToolboxIdentityConfig(identity)) {
    return reject(TOOLBOX_REASONS.configInvalid);
  }
  if (usesIdentity && !hasEnoughToolboxCards(identity, participantUserIds.length)) {
    return reject(TOOLBOX_REASONS.notEnoughCards);
  }
  const sessionId = buildToolboxSessionId(state.sessionSequence + 1);
  return commitToolbox([
    {
      type: 'toolbox.session.began',
      sessionId,
      participantUserIds,
      dice: tools.includes('dice')
        ? participantUserIds.map((userId) => ({ userId, cup: createToolboxDiceCup() }))
        : null,
      identity: usesIdentity ? createToolboxIdentityRound(identity, participantUserIds) : null,
    },
  ]);
}

function decideEnd(
  state: ToolboxState,
  sessionId: string,
  context: CommandContext,
): ToolboxDecision {
  const actor = resolveHostMember(state, context);
  if (actor.kind === 'rejected') return actor.decision;
  if (state.phase.kind !== 'active' || state.phase.sessionId !== sessionId) {
    return reject(TOOLBOX_REASONS.sessionStale);
  }
  return commitToolbox([{ type: 'toolbox.session.ended' }]);
}

type ParticipantResult =
  | { readonly kind: 'participant'; readonly userId: string; readonly phase: ToolboxActivePhase }
  | { readonly kind: 'rejected'; readonly decision: ToolboxDecision };

function resolveParticipant(state: ToolboxState, context: CommandContext): ParticipantResult {
  const actor = resolveMember(state, context);
  if (actor.kind === 'rejected') return actor;
  if (state.phase.kind !== 'active') {
    return { kind: 'rejected', decision: reject(TOOLBOX_REASONS.notStarted) };
  }
  if (!state.phase.participantUserIds.includes(actor.userId)) {
    return { kind: 'rejected', decision: reject(TOOLBOX_REASONS.notParticipant) };
  }
  return { kind: 'participant', userId: actor.userId, phase: state.phase };
}

function decideDice(
  state: ToolboxState,
  command: Extract<
    ToolboxCommand,
    {
      type:
        | 'toolbox.dice.setCount'
        | 'toolbox.dice.roll'
        | 'toolbox.dice.reveal'
        | 'toolbox.dice.toggleHold';
    }
  >,
  context: CommandContext,
): ToolboxDecision {
  const participant = resolveParticipant(state, context);
  if (participant.kind === 'rejected') return participant.decision;
  const { phase, userId } = participant;
  if (phase.dice === null) return reject(TOOLBOX_REASONS.diceDisabled);
  const entry = phase.dice.find((candidate) => candidate.userId === userId);
  if (entry === undefined) {
    throw new Error('[FAIL-FAST] toolbox participant has no dice cup');
  }
  const cup: ToolboxDiceCup = entry.cup;
  if (command.cupVersion !== cup.version) return reject(TOOLBOX_REASONS.cupStale);
  let outcome: ToolboxCupOutcome;
  switch (command.type) {
    case 'toolbox.dice.setCount':
      outcome = setToolboxDiceCount(cup, command.count);
      break;
    case 'toolbox.dice.roll':
      outcome = rollToolboxDice(cup, context.randomSeed);
      break;
    case 'toolbox.dice.reveal':
      outcome = revealToolboxDice(cup);
      break;
    case 'toolbox.dice.toggleHold':
      outcome = toggleToolboxDieHold(cup, command.dieId);
      break;
  }
  if (outcome.kind === 'rejected') return reject(outcome.reason);
  if (outcome.cup === cup) return commitToolbox([]);
  return commitToolbox([{ type: 'toolbox.dice.cupChanged', userId, cup: outcome.cup }]);
}

function decideIdentityDraw(
  state: ToolboxState,
  sessionId: string,
  context: CommandContext,
): ToolboxDecision {
  const participant = resolveParticipant(state, context);
  if (participant.kind === 'rejected') return participant.decision;
  if (participant.phase.sessionId !== sessionId) return reject(TOOLBOX_REASONS.sessionStale);
  const round = participant.phase.identity;
  if (round === null) return reject(TOOLBOX_REASONS.identityDisabled);
  const hand = round.hands.find((candidate) => candidate.userId === participant.userId);
  if (hand === undefined) throw new Error('[FAIL-FAST] toolbox participant has no hand');
  if (hand.identityIndexes.length >= round.config.cardsPerPlayer) {
    return reject(TOOLBOX_REASONS.handFull);
  }
  return commitToolbox([
    {
      type: 'toolbox.identity.drawn',
      userId: participant.userId,
      identityIndex: drawToolboxIdentityIndex(round, context.randomSeed),
    },
  ]);
}

export function decideToolboxCommand(
  state: ToolboxState,
  command: ToolboxCommand,
  context: CommandContext,
): ToolboxDecision {
  switch (command.type) {
    case 'toolbox.member.join':
    case 'toolbox.member.leave':
      return decideMembership(state, command, context);
    case 'toolbox.seat.take':
    case 'toolbox.seat.release':
    case 'toolbox.seats.clear':
      return decideSeat(state, command, context);
    case 'toolbox.config.update':
      return decideConfigUpdate(state, command.config, context);
    case 'toolbox.session.begin':
      return decideBegin(state, command.configVersion, context);
    case 'toolbox.session.end':
      return decideEnd(state, command.sessionId, context);
    case 'toolbox.dice.setCount':
    case 'toolbox.dice.roll':
    case 'toolbox.dice.reveal':
    case 'toolbox.dice.toggleHold':
      return decideDice(state, command, context);
    case 'toolbox.identity.draw':
      return decideIdentityDraw(state, command.sessionId, context);
  }
}

/** 准备阶段为 setup，使用中为 ongoing；工具箱没有终局。 */
export function getToolboxLifecycle(state: ToolboxState): CommonGameLifecycle {
  return state.phase.kind === 'active' ? 'ongoing' : 'setup';
}

export const toolboxEngine: GameEngineDefinition<
  typeof TOOLBOX_GAME_TYPE,
  ToolboxState,
  ToolboxConfig,
  ToolboxCommand,
  ToolboxEvent,
  ToolboxEffect
> = {
  gameType: TOOLBOX_GAME_TYPE,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: false,
    identityViewing: false,
    revealAnimation: false,
    stageDeadline: false,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botBulkViewing: false,
  },
  createInitialState,
  decide: decideToolboxCommand,
  evolve: evolveToolboxState,
  normalize: normalizeToolboxState,
  getLifecycle: getToolboxLifecycle,
};
