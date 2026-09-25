/** Story Relay task ownership, readiness and final submission decisions; no persistence or IO. */

import { type CommandContext, reject, resolveUserActorId } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
} from '../../../platform/protocol/reasons';
import { findSeatByUserId } from '../../../platform/room/seating';
import type { StoryRelayCommand, StoryRelayTaskIdentity } from '../commands/types';
import {
  getStoryRelayTaskForSeat,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayEntry,
  type StoryRelayState,
} from '../state/types';
import {
  commitStoryRelay,
  requireStoryRelayHost,
  STORY_RELAY_REASONS,
  type StoryRelayDecision,
  type StoryRelayEffect,
  type StoryRelayEvent,
} from './decision';

/** Builds a phase event; absolute deadlines are decided only by the server. */
export function storyRelayPhase(
  state: StoryRelayState,
  phase: StoryRelayState['phase'],
  deadlineAt: number | null,
  stepIndex = state.stepIndex,
  gallery: StoryRelayState['gallery'] = null,
): StoryRelayEvent {
  return { type: 'storyrelay.phase.changed', phase, stepIndex, deadlineAt, gallery };
}

/** Converts a supported duration into an absolute server deadline. */
export function storyRelayDeadline(nowMs: number, seconds: number | null): number | null {
  return seconds === null ? null : nowMs + seconds * 1000;
}

function matchesTask(
  state: StoryRelayState,
  command: StoryRelayTaskIdentity,
  seat: number,
): boolean {
  const task = getStoryRelayTaskForSeat(state, seat);
  return (
    task !== null &&
    command.roundId === task.roundId &&
    command.stepIndex === task.stepIndex &&
    command.chainId === task.chainId
  );
}

function appendEntries(
  state: StoryRelayState,
  entries: readonly { readonly chainId: string; readonly entry: StoryRelayEntry }[],
  nowMs: number,
): StoryRelayDecision {
  const events: StoryRelayEvent[] = [{ type: 'storyrelay.entries.appended', entries }];
  const effects: StoryRelayEffect[] = [];
  const submitted =
    state.chains.filter((chain) => chain.entries.length > state.stepIndex).length + entries.length;
  if (submitted === state.config.numberOfPlayers) {
    events.push(
      storyRelayPhase(
        state,
        'transition',
        storyRelayDeadline(nowMs, state.config.transitionDurationSeconds),
      ),
    );
    if (state.stepIndex === state.config.numberOfPlayers - 1) {
      if (state.roundId === null) throw new Error('Story Relay completion requires a round');
      events.push({ type: 'storyrelay.round.completed', completedAt: nowMs });
      const authors = new Set(
        [...state.chains.flatMap((chain) => chain.entries), ...entries.map((item) => item.entry)]
          .filter((entry) => entry.kind === 'text')
          .map((entry) => entry.authorSeat),
      );
      effects.push({
        type: 'storyrelay.round.completed',
        payload: {
          roundId: state.roundId,
          completedAt: nowMs,
          participantUserIds: state.participants.flatMap((participant) =>
            participant.userId !== null && authors.has(participant.seat)
              ? [participant.userId]
              : [],
          ),
        },
      });
    }
  }
  return commitStoryRelay(events, effects);
}

type TaskCommand = Extract<
  StoryRelayCommand,
  {
    readonly type:
      | 'storyrelay.task.ready.set'
      | 'storyrelay.text.submit'
      | 'storyrelay.task.empty.submit';
  }
>;

/** Decides authenticated readiness or final text, rejecting stale task identity and duplicate submissions. */
export function decideStoryRelayTask(
  state: StoryRelayState,
  command: TaskCommand,
  context: CommandContext,
): StoryRelayDecision {
  const phase = command.type === 'storyrelay.task.ready.set' ? 'answering' : 'settling';
  if (state.phase !== phase) return reject(STORY_RELAY_REASONS.phase);
  if (state.deadlineAt !== null && context.nowMs >= state.deadlineAt)
    return reject(STORY_RELAY_REASONS.task);
  const actor = resolveUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  let seat = context.controlledSeat;
  if (seat !== null) {
    if (actor.value !== state.hostUserId) return reject(REASON_NOT_HOST);
    if (!state.botSeats.includes(seat)) return reject(REASON_CONTROLLED_SEAT_NOT_BOT);
  } else seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, actor.value);
  if (seat === null) return reject(REASON_NOT_SEATED);
  if (!matchesTask(state, command, seat)) return reject(STORY_RELAY_REASONS.task);
  const task = getStoryRelayTaskForSeat(state, seat)!;
  if (task.isSubmitted) return reject(STORY_RELAY_REASONS.submitted);
  if (command.type === 'storyrelay.task.ready.set') {
    if (state.readySeats.includes(seat) === command.isReady) return commitStoryRelay([]);
    const events: StoryRelayEvent[] = [
      { type: 'storyrelay.task.ready', seat, isReady: command.isReady },
    ];
    if (command.isReady && state.readySeats.length + 1 === state.config.numberOfPlayers)
      events.push(storyRelayPhase(state, 'settling', null));
    return commitStoryRelay(events);
  }
  if (
    command.type === 'storyrelay.text.submit' &&
    (command.text.trim().length === 0 || command.text.length > STORY_RELAY_TEXT_MAX_LENGTH)
  )
    return reject(STORY_RELAY_REASONS.text);
  const entry: StoryRelayEntry =
    command.type === 'storyrelay.text.submit'
      ? {
          kind: 'text',
          text: command.text,
          id: context.commandId,
          authorSeat: seat,
          submittedAt: context.nowMs,
        }
      : { kind: 'empty', id: context.commandId, authorSeat: seat, submittedAt: context.nowMs };
  return appendEntries(state, [{ chainId: task.chainId, entry }], context.nowMs);
}

/** Skips only explicitly selected unresolved tasks, preserving already accepted entries. */
export function decideStoryRelaySkip(
  state: StoryRelayState,
  command: Extract<
    StoryRelayCommand,
    { readonly type: 'storyrelay.task.skip' | 'storyrelay.bots.skip' }
  >,
  context: CommandContext,
): StoryRelayDecision {
  const hostRejection = requireStoryRelayHost(state, context);
  if (hostRejection !== null) return hostRejection;
  if (state.phase !== 'settling') return reject(STORY_RELAY_REASONS.phase);
  if (
    command.phaseRevision !== state.phaseRevision ||
    command.roundId !== state.roundId ||
    command.stepIndex !== state.stepIndex
  )
    return reject(STORY_RELAY_REASONS.task);
  if (command.type === 'storyrelay.task.skip' && !matchesTask(state, command, command.seat))
    return reject(STORY_RELAY_REASONS.task);
  const seats = command.type === 'storyrelay.task.skip' ? [command.seat] : state.botSeats;
  const entries: { chainId: string; entry: StoryRelayEntry }[] = [];
  for (const seat of seats) {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) return reject(STORY_RELAY_REASONS.task);
    if (task.isSubmitted) {
      if (command.type === 'storyrelay.task.skip') return reject(STORY_RELAY_REASONS.submitted);
      continue;
    }
    entries.push({
      chainId: task.chainId,
      entry: {
        kind: 'skipped',
        id: `${context.commandId}:${seat}`,
        authorSeat: seat,
        submittedAt: context.nowMs,
        skippedBy: state.hostUserId,
      },
    });
  }
  return entries.length === 0 ? commitStoryRelay([]) : appendEntries(state, entries, context.nowMs);
}
