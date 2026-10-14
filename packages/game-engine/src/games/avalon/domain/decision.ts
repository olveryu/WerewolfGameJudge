/** Avalon decision outcomes and permission gates; no IO. */

import {
  type CommandContext,
  commit,
  type Decision,
  reject,
  resolveHostActorId,
  resolveUserActorId,
} from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
} from '../../../platform/protocol/reasons';
import { findRosterSeatByUserId, type RosterChange } from '../../../platform/room/seating';
import type {
  AvalonAudioEffect,
  AvalonBallot,
  AvalonEndReason,
  AvalonHumanSeat,
  AvalonNightInfo,
  AvalonNightStep,
  AvalonPlay,
  AvalonQuestHistoryEntry,
  AvalonQuestRound,
  AvalonRoleId,
} from '../state/types';
import { type AvalonState, isAvalonBotSeat } from '../state/types';

/**
 * Stable English rejection codes (AU-48). The user-facing copy for each
 * code lives in the client presenter (design doc §6.1); engines never
 * emit display text as a reason.
 */
export const AVALON_REASONS = {
  config: 'avalon_config_invalid',
  phase: 'avalon_phase_invalid',
  notHostStart: 'avalon_not_host_start',
  notHostBegin: 'avalon_not_host_begin',
  notAllViewed: 'avalon_not_all_viewed',
  notHostMarkBots: 'avalon_not_host_mark_bots',
  noBotSeats: 'avalon_no_bot_seats',
  full: 'avalon_room_not_full',
  notNightParticipant: 'avalon_not_night_participant',
  notLeader: 'avalon_not_leader',
  notVotePhase: 'avalon_not_vote_phase',
  notHostFinishVote: 'avalon_not_host_finish_vote',
  deadline: 'avalon_deadline_not_reached',
  notTeamMember: 'avalon_not_team_member',
  goodMustSucceed: 'avalon_good_must_succeed',
  notHostFinishQuest: 'avalon_not_host_finish_quest',
  notLadyHolder: 'avalon_not_lady_holder',
  ladyAlreadyExamined: 'avalon_lady_already_examined',
  ladyCannotCheckSelf: 'avalon_lady_cannot_check_self',
  notLadyTarget: 'avalon_not_lady_target',
  notAssassinAccuse: 'avalon_not_assassin_accuse',
  cannotAccuseSelf: 'avalon_cannot_accuse_self',
  notAssassinStrike: 'avalon_not_assassin_strike',
  noStrikeAtNight: 'avalon_no_strike_at_night',
  cannotStrikeSelf: 'avalon_cannot_strike_self',
  notHostReturnToLobby: 'avalon_not_host_return_to_lobby',
  occupied: 'avalon_occupied_seat_out_of_range',
  invalidSeats: 'avalon_invalid_seats',
  duplicateSeats: 'avalon_duplicate_seats',
  invalidVote: 'avalon_invalid_vote',
  invalidPlay: 'avalon_invalid_play',
  invalidTarget: 'avalon_invalid_target',
  audioPlaying: 'avalon_audio_playing',
  notHostAckAudio: 'avalon_not_host_ack_audio',
} as const;

/** Team-size rejection: stable code plus the required size as a parameter. */
export function teamSizeReason(requiredSize: number): string {
  return `avalon_team_size_invalid:${requiredSize}`;
}

export type AvalonEvent =
  | {
      readonly type: 'avalon.seats.changed';
      readonly changes: readonly RosterChange<AvalonHumanSeat>[];
    }
  | { readonly type: 'avalon.config.updated'; readonly config: AvalonState['config'] }
  | {
      readonly type: 'avalon.game.started';
      readonly roles: Readonly<Record<number, AvalonRoleId>>;
      readonly nightInfo: AvalonNightInfo;
      readonly leaderSeat: number;
      readonly ladyHolderSeat: number | null;
      readonly gameSequence: number;
    }
  | { readonly type: 'avalon.game.begun' }
  | { readonly type: 'avalon.night.confirmed'; readonly seat: number }
  | { readonly type: 'avalon.role.viewed'; readonly seat: number }
  | { readonly type: 'avalon.night.stepped'; readonly step: AvalonNightStep }
  | { readonly type: 'avalon.night.completed' }
  | {
      readonly type: 'avalon.audio.queued';
      readonly effects: readonly AvalonAudioEffect[];
    }
  | { readonly type: 'avalon.audio.cleared' }
  | { readonly type: 'avalon.team.proposed'; readonly seats: readonly number[] }
  | { readonly type: 'avalon.team.vote.cast'; readonly seat: number; readonly vote: AvalonBallot }
  | { readonly type: 'avalon.vote.allCast'; readonly deadlineAt: number }
  | {
      readonly type: 'avalon.vote.settled';
      readonly approved: boolean;
      readonly ballots: Readonly<Record<number, AvalonBallot>>;
      readonly approveCount: number;
      readonly rejectCount: number;
      readonly abstainCount: number;
      readonly nextLeaderSeat: number;
      readonly vetoLimitReached: boolean;
    }
  | { readonly type: 'avalon.quest.played'; readonly seat: number; readonly play: AvalonPlay }
  | { readonly type: 'avalon.quest.allPlayed'; readonly deadlineAt: number }
  | {
      readonly type: 'avalon.quest.settled';
      readonly round: AvalonQuestRound;
      readonly successCount: number;
      readonly failCount: number;
      readonly result: 'success' | 'fail';
      readonly historyEntry: AvalonQuestHistoryEntry;
    }
  | { readonly type: 'avalon.lady.checked'; readonly targetSeat: number }
  | {
      readonly type: 'avalon.lady.acknowledged';
      readonly targetSeat: number;
      readonly faction: 'good' | 'evil';
      readonly nextRound: AvalonQuestRound;
      readonly nextRequiredSize: number;
      readonly nextLeaderSeat: number;
    }
  | {
      readonly type: 'avalon.game.ended';
      readonly winner: 'good' | 'evil';
      readonly reason: AvalonEndReason;
      readonly accusedSeat: number | null;
    }
  | { readonly type: 'avalon.game.returnedToLobby' };

/** 终局 growth settlement effect：Worker 据此发 XP 奖励，xpSettled 保证恰好一次。 */
export type AvalonEffect = {
  readonly type: 'avalon.game.completed';
  readonly payload: {
    readonly roundId: string;
    readonly completedAt: number;
    readonly participantUserIds: readonly string[];
  };
};

export type AvalonDecision = Decision<AvalonEvent, AvalonEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitAvalon(
  events: readonly AvalonEvent[],
  effects: readonly AvalonEffect[] = [],
): AvalonDecision {
  return commit({ events, effects, broadcast: events.length === 0 ? 'none' : 'state' });
}

/** Requires the current host acting outside bot takeover; rejects with the given reason. */
export function requireAvalonHost(
  state: AvalonState,
  context: CommandContext,
  reason: string,
): AvalonDecision | null {
  const actor = resolveHostActorId(context, state.hostUserId);
  return actor.kind === 'rejected' ? reject(reason) : null;
}

export type ResolvedAvalonSeat =
  | { readonly kind: 'resolved'; readonly seat: number }
  | { readonly kind: 'rejected'; readonly reason: string };

function rejectedSeat(reason: string): ResolvedAvalonSeat {
  return { kind: 'rejected', reason };
}

/**
 * Resolves the acting seat: the user's own seat, or a host-takeover bot seat.
 * Takeover is host-only (pictionary pattern); the target must be an implicit bot seat.
 */
export function resolveAvalonSeat(state: AvalonState, context: CommandContext): ResolvedAvalonSeat {
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return rejectedSeat(actor.reason);
  if (context.controlledSeat === null) {
    const seat = findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, actor.value);
    return seat === null ? rejectedSeat(REASON_NOT_SEATED) : { kind: 'resolved', seat };
  }
  if (actor.value !== state.hostUserId) return rejectedSeat(REASON_NOT_HOST);
  if (!isAvalonBotSeat(state, context.controlledSeat))
    return rejectedSeat(REASON_CONTROLLED_SEAT_NOT_BOT);
  return { kind: 'resolved', seat: context.controlledSeat };
}

/** Resolves the acting seat and requires it to hold the assassin role. */
export function resolveAvalonAssassin(
  state: AvalonState,
  context: CommandContext,
  notAssassinReason: string,
): ResolvedAvalonSeat {
  const resolved = resolveAvalonSeat(state, context);
  if (resolved.kind === 'rejected') return resolved;
  return state.roles[resolved.seat] === 'assassin' ? resolved : rejectedSeat(notAssassinReason);
}
