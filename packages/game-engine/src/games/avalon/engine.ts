/** Authoritative Avalon engine; delegates persistence and delivery to the platform. */

import {
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
} from '../../platform/engine';
import { randomIntInclusive } from '../../platform/random';
import { haveAllHumansViewed, markSeatViewed } from '../../platform/room/identityViewing';
import { getHumanSeatMap } from '../../platform/room/seating';
import type { AvalonCommand, AvalonPublicCommand } from './commands/types';
import {
  AVALON_REASONS,
  type AvalonDecision,
  type AvalonEffect,
  type AvalonEvent,
  commitAvalon,
  requireAvalonHost,
  resolveAvalonAssassin,
  resolveAvalonSeat,
  teamSizeReason,
} from './domain/decision';
import { evolveAvalonState } from './domain/evolve';
import {
  buildAvalonNightInfo,
  getAvalonFailsNeeded,
  getAvalonLadyInitialHolderSeat,
  getAvalonNightParticipants,
  getAvalonQuestSize,
  nextAvalonLeaderSeat,
} from './domain/rules';
import { dealAvalonRoles, decideAvalonRoom } from './domain/seating';
import { normalizeAvalonState } from './state/normalize';
import {
  AVALON_GAME_TYPE,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_STATE_VERSION,
  type AvalonAudioEffect,
  type AvalonBallot,
  type AvalonConfig,
  type AvalonPlay,
  type AvalonQuestHistoryEntry,
  type AvalonState,
  getAvalonOccupiedSeatCount,
  getAvalonViewingParticipants,
  isAvalonEvilRole,
  isAvalonGoodRole,
  isAvalonOccupiedSeat,
  isAvalonQuestRound,
  isValidAvalonConfig,
} from './state/types';

function createInitialState(config: AvalonConfig, context: CreateGameContext): AvalonState {
  if (!isValidAvalonConfig(config)) throw new Error(AVALON_REASONS.config);
  return normalizeAvalonState({
    gameType: AVALON_GAME_TYPE,
    stateVersion: AVALON_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    roster: {},
    roles: {},
    roleViewedSeats: [],
    nightInfo: { evilPeers: {}, merlinSees: [], percivalSees: [] },
    leaderSeat: -1,
    rejectStreak: 0,
    questResults: [],
    questHistory: [],
    ladyHolderSeat: null,
    ladyExaminedSeats: [],
    lastLadyCheck: null,
    lastVoteResult: null,
    gameSequence: 0,
    xpSettled: false,
    pendingAudioEffects: [],
    isAudioPlaying: false,
  });
}

/** 对局结束时发结算 effect，Worker 据此发 XP 奖励；xpSettled 保证恰好一次。 */
function completionEffect(state: AvalonState, context: CommandContext): AvalonEffect {
  return {
    type: 'avalon.game.completed',
    payload: {
      roundId: `avalon:game:${state.gameSequence}`,
      completedAt: context.nowMs,
      participantUserIds: Object.values(
        getHumanSeatMap(state.roster, state.config.numberOfPlayers),
      ).map((seat) => seat.userId),
    },
  };
}

/** Host starts the game (or restarts from ended): deal roles, pick the first leader, enter night. */
function startGame(state: AvalonState, context: CommandContext): AvalonDecision {
  const hostRejection = requireAvalonHost(state, context, AVALON_REASONS.notHostStart);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended')
    return reject(AVALON_REASONS.phase);
  if (getAvalonOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(AVALON_REASONS.full);
  const count = state.config.numberOfPlayers;
  const roles = dealAvalonRoles(count);
  const leaderSeat = randomIntInclusive(0, count - 1);
  const ladyHolderSeat =
    count >= AVALON_LADY_MIN_PLAYERS ? getAvalonLadyInitialHolderSeat(leaderSeat, count) : null;
  return commitAvalon([
    {
      type: 'avalon.game.started',
      roles,
      nightInfo: buildAvalonNightInfo(roles),
      leaderSeat,
      ladyHolderSeat,
      gameSequence: state.gameSequence + 1,
    },
    // 开局与 evilReveal 是同一事件，一次排入 night 开场 + 坏人互认（对齐狼人杀）。
    queueAudio([{ audioKey: 'night' }, { audioKey: 'evil_reveal' }]),
  ]);
}

/** 第一晚播报队列事件；空数组时由 evolve 忽略（fail-fast 在上游）。 */
function queueAudio(effects: readonly AvalonAudioEffect[]): AvalonEvent {
  if (effects.length === 0) throw new Error('[FAIL-FAST] Avalon audio queue requires effects');
  return { type: 'avalon.audio.queued', effects: [...effects] };
}

/** Night step confirmation; advances the step (or dawn) once every participant confirmed. */
function confirmNight(state: AvalonState, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'night') return reject(AVALON_REASONS.phase);
  // 播报未播完时阻塞确认（对齐狼人杀 progression gate）。
  if (state.isAudioPlaying) return reject(AVALON_REASONS.audioPlaying);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  const participants = getAvalonNightParticipants(state.roles, state.phase.step);
  if (!participants.includes(resolved.seat)) return reject(AVALON_REASONS.notNightParticipant);
  if (state.phase.confirmedSeats.includes(resolved.seat)) return commitAvalon([]);
  const confirmed = [...state.phase.confirmedSeats, resolved.seat];
  if (!participants.every((seat) => confirmed.includes(seat)))
    return commitAvalon([{ type: 'avalon.night.confirmed', seat: resolved.seat }]);
  switch (state.phase.step) {
    case 'evilReveal':
      return commitAvalon([
        { type: 'avalon.night.stepped', step: 'merlinReveal' },
        queueAudio([{ audioKey: 'evil_reveal', isEndAudio: true }, { audioKey: 'merlin_reveal' }]),
      ]);
    case 'merlinReveal':
      return commitAvalon([
        { type: 'avalon.night.stepped', step: 'percivalReveal' },
        queueAudio([
          { audioKey: 'merlin_reveal', isEndAudio: true },
          { audioKey: 'percival_reveal' },
        ]),
      ]);
    case 'percivalReveal': {
      // Identity Viewing Protocol checkpoint: the first quest cannot
      // start until every human has viewed their role. Hold the night
      // open (this seat's step confirmation still lands); the last
      // missing view releases the checkpoint from markRoleViewed.
      if (!haveAllHumansViewed(getAvalonViewingParticipants(state), state.roleViewedSeats))
        return commitAvalon([{ type: 'avalon.night.confirmed', seat: resolved.seat }]);
      return commitAvalon([
        { type: 'avalon.night.completed' },
        queueAudio([{ audioKey: 'percival_reveal', isEndAudio: true }, { audioKey: 'night_end' }]),
      ]);
    }
  }
}

/**
 * Identity Viewing Protocol: records that the actor's seat viewed its
 * role card. Idempotent. When the night steps are done but the
 * checkpoint was held for missing views, the last missing view also
 * completes the night (with its usual closing narration).
 */
function markRoleViewed(state: AvalonState, context: CommandContext): AvalonDecision {
  if (state.phase.kind === 'lobby' || state.phase.kind === 'ended')
    return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (state.roleViewedSeats.includes(resolved.seat)) return commitAvalon([]);
  const viewedSeats = markSeatViewed(state.roleViewedSeats, resolved.seat);
  const events: AvalonEvent[] = [{ type: 'avalon.role.viewed', seat: resolved.seat }];
  const phase = state.phase;
  if (
    phase.kind === 'night' &&
    phase.step === 'percivalReveal' &&
    getAvalonNightParticipants(state.roles, 'percivalReveal').every((seat) =>
      phase.confirmedSeats.includes(seat),
    ) &&
    haveAllHumansViewed(getAvalonViewingParticipants(state), viewedSeats)
  ) {
    events.push(
      { type: 'avalon.night.completed' },
      queueAudio([{ audioKey: 'percival_reveal', isEndAudio: true }, { audioKey: 'night_end' }]),
    );
  }
  return commitAvalon(events);
}

/** Leader proposes exactly requiredSize team members (may include the leader). */
function proposeTeam(
  state: AvalonState,
  seats: readonly number[],
  context: CommandContext,
): AvalonDecision {
  if (state.phase.kind !== 'nominate') return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (resolved.seat !== state.leaderSeat) return reject(AVALON_REASONS.notLeader);
  if (seats.length !== state.phase.requiredSize)
    return reject(teamSizeReason(state.phase.requiredSize));
  if (new Set(seats).size !== seats.length) return reject(AVALON_REASONS.duplicateSeats);
  const count = state.config.numberOfPlayers;
  if (
    !seats.every(
      (seat) =>
        Number.isSafeInteger(seat) &&
        seat >= 0 &&
        seat < count &&
        isAvalonOccupiedSeat(state, seat),
    )
  )
    return reject(AVALON_REASONS.invalidSeats);
  return commitAvalon([{ type: 'avalon.team.proposed', seats: [...seats] }]);
}

/** Casts (or overwrites, D15) one ballot; every occupied seat votes. */
function castVote(state: AvalonState, vote: AvalonBallot, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'vote') return reject(AVALON_REASONS.notVotePhase);
  if (vote !== 'approve' && vote !== 'reject') return reject(AVALON_REASONS.invalidVote);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  return commitAvalon([{ type: 'avalon.team.vote.cast', seat: resolved.seat, vote }]);
}

/**
 * Host settles the vote manually (D15): unvoted seats abstain, approve wins only when
 * approve > reject (ties reject). Rejection rotates the leader clockwise and bumps the
 * streak; reaching the veto limit ends the game with an evil win (D8).
 */
function finishVote(state: AvalonState, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'vote') return reject(AVALON_REASONS.phase);
  const hostRejection = requireAvalonHost(state, context, AVALON_REASONS.notHostFinishVote);
  if (hostRejection !== null) return hostRejection;
  const count = state.config.numberOfPlayers;
  let approveCount = 0;
  let rejectCount = 0;
  for (let seat = 0; seat < count; seat += 1) {
    if (!isAvalonOccupiedSeat(state, seat)) continue;
    const ballot = state.phase.ballots[seat];
    if (ballot === 'approve') approveCount += 1;
    else if (ballot === 'reject') rejectCount += 1;
  }
  const abstainCount = getAvalonOccupiedSeatCount(state) - approveCount - rejectCount;
  const approved = approveCount > rejectCount;
  const vetoLimitReached = !approved && state.rejectStreak + 1 >= state.config.vetoLimit;
  return commitAvalon(
    [
      {
        type: 'avalon.vote.settled',
        approved,
        ballots: { ...state.phase.ballots },
        approveCount,
        rejectCount,
        abstainCount,
        nextLeaderSeat: nextAvalonLeaderSeat(state.leaderSeat, count),
        vetoLimitReached,
      },
    ],
    vetoLimitReached && !state.xpSettled ? [completionEffect(state, context)] : [],
  );
}

/**
 * Settles one quest: counts fails against the round threshold, appends history, and routes
 * to assassin (3 successes), evil win (3 fails), lady check (9/10 players, rounds 2-4) or
 * the next round. Shared by auto-settle (all plays in) and the host's manual finish.
 */
function commitQuestSettled(
  priorEvents: readonly AvalonEvent[],
  state: AvalonState,
  plays: Readonly<Record<number, AvalonPlay>>,
  context: CommandContext,
): AvalonDecision {
  if (state.phase.kind !== 'quest') return reject(AVALON_REASONS.phase);
  const count = state.config.numberOfPlayers;
  const failCount = Object.values(plays).filter((play) => play === 'fail').length;
  const successCount = state.phase.teamSeats.length - failCount;
  const failsNeeded = getAvalonFailsNeeded(count, state.phase.round);
  const result = failCount >= failsNeeded ? 'fail' : 'success';
  const questResults = [...state.questResults, result];
  const failures = questResults.filter((entry) => entry === 'fail').length;
  const historyEntry: AvalonQuestHistoryEntry = {
    round: state.phase.round,
    leaderSeat: state.leaderSeat,
    teamSeats: [...state.phase.teamSeats],
    ballots: { ...state.phase.ballots },
    approveCount: state.phase.approveCount,
    rejectCount: state.phase.rejectCount,
    abstainCount: state.phase.abstainCount,
    result,
    successCount,
    failCount,
  };
  // 只有失败数到 3 才真正终局（threeFail）；成功数到 3 进刺杀阶段，
  // 结算 effect 在刺杀指认后才发。
  const gameEnded = failures >= 3;
  return commitAvalon(
    [
      ...priorEvents,
      {
        type: 'avalon.quest.settled',
        round: state.phase.round,
        successCount,
        failCount,
        result,
        historyEntry,
      },
    ],
    gameEnded && !state.xpSettled ? [completionEffect(state, context)] : [],
  );
}

/** Team member plays success/fail (good players cannot fail); overwrite allowed before settle. */
function playQuest(state: AvalonState, play: AvalonPlay, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'quest') return reject(AVALON_REASONS.phase);
  if (play !== 'success' && play !== 'fail') return reject(AVALON_REASONS.invalidPlay);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (!state.phase.teamSeats.includes(resolved.seat)) return reject(AVALON_REASONS.notTeamMember);
  const role = state.roles[resolved.seat];
  if (role === undefined) return reject(AVALON_REASONS.phase);
  if (play === 'fail' && isAvalonGoodRole(role)) return reject(AVALON_REASONS.goodMustSucceed);
  const plays = { ...state.phase.plays, [resolved.seat]: play };
  const playedEvent: AvalonEvent = { type: 'avalon.quest.played', seat: resolved.seat, play };
  // 收齐自动洗混结算（D16 保持不变）。
  if (state.phase.teamSeats.every((seat) => plays[seat] !== undefined)) {
    return commitQuestSettled([playedEvent], state, plays, context);
  }
  return commitAvalon([playedEvent]);
}

/** Host ends the quest early (D16): seats that did not play count as success. */
function finishQuest(state: AvalonState, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'quest') return reject(AVALON_REASONS.phase);
  const hostRejection = requireAvalonHost(state, context, AVALON_REASONS.notHostFinishQuest);
  if (hostRejection !== null) return hostRejection;
  const plays: Record<number, AvalonPlay> = { ...state.phase.plays };
  for (const seat of state.phase.teamSeats) {
    if (plays[seat] === undefined) plays[seat] = 'success';
  }
  return commitQuestSettled([], state, plays, context);
}

/** Lady holder picks a player who has never held the token (not the holder). */
function checkLady(state: AvalonState, target: number, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'lady') return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (resolved.seat !== state.phase.holderSeat) return reject(AVALON_REASONS.notLadyHolder);
  if (target === resolved.seat) return reject(AVALON_REASONS.ladyCannotCheckSelf);
  const count = state.config.numberOfPlayers;
  if (
    !Number.isSafeInteger(target) ||
    target < 0 ||
    target >= count ||
    !isAvalonOccupiedSeat(state, target)
  )
    return reject(AVALON_REASONS.invalidTarget);
  if (state.phase.examinedSeats.includes(target)) return reject(AVALON_REASONS.ladyAlreadyExamined);
  return commitAvalon([{ type: 'avalon.lady.checked', targetSeat: target }]);
}

/** The checked player acknowledges; the holder learns the faction and the token moves on. */
function acknowledgeLady(state: AvalonState, context: CommandContext): AvalonDecision {
  if (state.phase.kind !== 'lady') return reject(AVALON_REASONS.phase);
  const targetSeat = state.phase.targetSeat;
  if (targetSeat === null) return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (resolved.seat !== targetSeat) return reject(AVALON_REASONS.notLadyTarget);
  const role = state.roles[targetSeat];
  if (role === undefined) return reject(AVALON_REASONS.phase);
  const count = state.config.numberOfPlayers;
  const nextRoundNumber = state.phase.afterRound + 1;
  if (!isAvalonQuestRound(nextRoundNumber)) return reject(AVALON_REASONS.phase);
  return commitAvalon([
    {
      type: 'avalon.lady.acknowledged',
      targetSeat,
      faction: isAvalonEvilRole(role) ? 'evil' : 'good',
      nextRound: nextRoundNumber,
      nextRequiredSize: getAvalonQuestSize(count, nextRoundNumber),
      nextLeaderSeat: nextAvalonLeaderSeat(state.leaderSeat, count),
    },
  ]);
}

/** Validates an assassination target: any occupied seat except the assassin (D14). */
function checkAssassinationTarget(
  state: AvalonState,
  target: number,
  assassinSeat: number,
  selfReason: string,
): AvalonDecision | null {
  if (target === assassinSeat) return reject(selfReason);
  const count = state.config.numberOfPlayers;
  if (
    !Number.isSafeInteger(target) ||
    target < 0 ||
    target >= count ||
    !isAvalonOccupiedSeat(state, target)
  )
    return reject(AVALON_REASONS.invalidTarget);
  return null;
}

/**
 * Assassin accuses one seat of being Merlin (D5a). D14: the target is unrestricted by
 * faction — accusing an evil seat (including Oberon) counts as a miss, never a rejection,
 * so the rejection path cannot leak Oberon's identity to the assassin.
 */
function accuseAssassin(
  state: AvalonState,
  target: number,
  context: CommandContext,
): AvalonDecision {
  if (state.phase.kind !== 'assassin') return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonAssassin(state, context, AVALON_REASONS.notAssassinAccuse);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  const targetRejection = checkAssassinationTarget(
    state,
    target,
    resolved.seat,
    AVALON_REASONS.cannotAccuseSelf,
  );
  if (targetRejection !== null) return targetRejection;
  const hit = state.roles[target] === 'merlin';
  return commitAvalon(
    [
      {
        type: 'avalon.game.ended',
        winner: hit ? 'evil' : 'good',
        reason: hit ? 'assassinationHit' : 'assassinationMiss',
        accusedSeat: target,
      },
    ],
    state.xpSettled ? [] : [completionEffect(state, context)],
  );
}

/**
 * Early strike (D13): after night, before the game ends, the assassin may strike in any
 * of nominate/vote/quest/lady. Hitting Merlin wins for evil; missing wins for good.
 */
function earlyStrike(state: AvalonState, target: number, context: CommandContext): AvalonDecision {
  if (state.phase.kind === 'night') return reject(AVALON_REASONS.noStrikeAtNight);
  if (
    state.phase.kind !== 'nominate' &&
    state.phase.kind !== 'vote' &&
    state.phase.kind !== 'quest' &&
    state.phase.kind !== 'lady'
  )
    return reject(AVALON_REASONS.phase);
  const resolved = resolveAvalonAssassin(state, context, AVALON_REASONS.notAssassinStrike);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  const targetRejection = checkAssassinationTarget(
    state,
    target,
    resolved.seat,
    AVALON_REASONS.cannotStrikeSelf,
  );
  if (targetRejection !== null) return targetRejection;
  const hit = state.roles[target] === 'merlin';
  return commitAvalon(
    [
      {
        type: 'avalon.game.ended',
        winner: hit ? 'evil' : 'good',
        reason: hit ? 'earlyAssassinationHit' : 'earlyAssassinationMiss',
        accusedSeat: target,
      },
    ],
    state.xpSettled ? [] : [completionEffect(state, context)],
  );
}

function returnToLobby(state: AvalonState, context: CommandContext): AvalonDecision {
  const hostRejection = requireAvalonHost(state, context, AVALON_REASONS.notHostReturnToLobby);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'ended') return reject(AVALON_REASONS.phase);
  // 播报未播完时阻塞回大厅，避免 orphan 音频队列（用户 2026-10-07 确认）。
  if (state.isAudioPlaying) return reject(AVALON_REASONS.audioPlaying);
  return commitAvalon([{ type: 'avalon.game.returnedToLobby' }]);
}

/** 房主播完第一晚播报后提交 ack，清空队列、释放门控（对齐狼人杀 handleAudioAck）。 */
function ackAudio(state: AvalonState, context: CommandContext): AvalonDecision {
  const hostRejection = requireAvalonHost(state, context, AVALON_REASONS.notHostAckAudio);
  if (hostRejection !== null) return hostRejection;
  return commitAvalon([{ type: 'avalon.audio.cleared' }]);
}

function decidePublicCommand(
  state: AvalonState,
  command: AvalonPublicCommand,
  context: CommandContext,
): AvalonDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'avalon.config.update':
      return decideAvalonRoom(state, command, context);
    case 'avalon.game.start':
      return startGame(state, context);
    case 'avalon.role.viewed':
      return markRoleViewed(state, context);
    case 'avalon.night.confirm':
      return confirmNight(state, context);
    case 'avalon.team.propose':
      return proposeTeam(state, command.seats, context);
    case 'avalon.team.vote':
      return castVote(state, command.vote, context);
    case 'avalon.quest.play':
      return playQuest(state, command.play, context);
    case 'avalon.vote.finish':
      return finishVote(state, context);
    case 'avalon.quest.finish':
      return finishQuest(state, context);
    case 'avalon.lady.check':
      return checkLady(state, command.seat, context);
    case 'avalon.lady.acknowledge':
      return acknowledgeLady(state, context);
    case 'avalon.assassin.accuse':
      return accuseAssassin(state, command.seat, context);
    case 'avalon.assassin.earlyStrike':
      return earlyStrike(state, command.seat, context);
    case 'avalon.game.returnToLobby':
      return returnToLobby(state, context);
    case 'avalon.audio.ack':
      return ackAudio(state, context);
    default:
      return reject(AVALON_REASONS.phase);
  }
}

/** Decides public commands against the current authoritative state. */
export function decideAvalonCommand(
  state: AvalonState,
  command: AvalonCommand,
  context: CommandContext,
): AvalonDecision {
  return decidePublicCommand(state, command, context);
}

/** Projects domain phases into the shared room lifecycle. */
export function getAvalonLifecycle(state: AvalonState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const avalonEngine = {
  gameType: AVALON_GAME_TYPE,
  stateVersion: AVALON_STATE_VERSION,
  createInitialState,
  decide: decideAvalonCommand,
  evolve: evolveAvalonState,
  normalize: normalizeAvalonState,
  getLifecycle: getAvalonLifecycle,
} satisfies GameEngineDefinition<
  typeof AVALON_GAME_TYPE,
  AvalonState,
  AvalonConfig,
  AvalonCommand,
  AvalonEvent,
  AvalonEffect
>;
