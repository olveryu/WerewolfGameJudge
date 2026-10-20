/**
 * Relay tasks: per-seat task resolution, readiness and submissions.
 *
 * The task projection is the privacy boundary of the machine: a seat
 * sees only the immediately previous entry of its current chain. The
 * previous entry is stripped by a game-supplied function — what of an
 * entry may cross the boundary is content, the boundary itself is
 * mechanism.
 *
 * Submission decisions run one gate order for every relay game:
 * phase, deadline, actor (host takeover of a bot seat, or the actor's
 * own seat), task identity, duplicate, then any game-owned submission
 * gate (expected entry kind, in-flight work). When the last missing entry of
 * a step lands, the step advances into a timed transition; what a
 * completed final step fires (the round-completed event and the
 * settlement effect) is injected per game, because the event and
 * effect shapes are game-owned — both games fire it from this
 * point, in the decision that lands the final step's last entry.
 */

import {
  type CommandContext,
  type Decision,
  type GameEffect,
  type GameEvent,
  reject,
} from '../../engine';
import { resolveActingSeat } from '../actingSeat';
import { rejectIfPastDeadline } from '../phaseDeadline';
import { relayDeadline } from './clock';
import type {
  RelayActorSlice,
  RelayEventKit,
  RelayRoundSlice,
  RelayTask,
  RelayTaskCommand,
  RelayTaskIdentity,
} from './types';

/** Resolves a seat's current task without exposing the chain's earlier entries. */
export function getRelayTaskForSeat<TEntry, TPrevious>(
  state: RelayRoundSlice<TEntry>,
  seat: number,
  numberOfPlayers: number,
  stripPreviousEntry: (entry: TEntry) => TPrevious,
): RelayTask<TPrevious> | null {
  if (state.roundId === null || !['answering', 'settling', 'transition'].includes(state.phase))
    return null;
  const seatIndex = state.seatOrder.indexOf(seat);
  if (seatIndex < 0) return null;
  const offset = state.stepOffsets[state.stepIndex];
  if (offset === undefined) throw new Error('Relay task offset missing');
  const chain = state.chains[(seatIndex - offset + numberOfPlayers) % numberOfPlayers];
  if (chain === undefined) throw new Error('Relay task chain missing');
  const previousEntry = state.stepIndex === 0 ? null : chain.entries[state.stepIndex - 1];
  if (previousEntry === undefined) throw new Error('Relay previous entry missing');
  return {
    roundId: state.roundId,
    stepIndex: state.stepIndex,
    chainId: chain.id,
    authorSeat: seat,
    previousEntry: previousEntry === null ? null : stripPreviousEntry(previousEntry),
    isSubmitted: chain.entries.length > state.stepIndex,
  };
}

/** Whether a command's task identity still matches the seat's current task. */
function matchesRelayTask<TEntry, TPrevious>(
  state: RelayRoundSlice<TEntry>,
  identity: RelayTaskIdentity,
  seat: number,
  numberOfPlayers: number,
  stripPreviousEntry: (entry: TEntry) => TPrevious,
): boolean {
  const task = getRelayTaskForSeat(state, seat, numberOfPlayers, stripPreviousEntry);
  return (
    task !== null &&
    identity.roundId === task.roundId &&
    identity.stepIndex === task.stepIndex &&
    identity.chainId === task.chainId
  );
}

/** Game-supplied pieces of a task decision: content validation, entry building, completion. */
export interface RelayTaskHooks<
  TEntry,
  TPrevious,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
> {
  /** Strips a previous entry to what the next author may see (privacy boundary). */
  readonly stripPreviousEntry: (entry: TEntry) => TPrevious;
  /** The game's own text rule; shared code only decides where rejection lands. */
  readonly validateText: (text: string) => boolean;
  /**
   * The entry kind a step expects, when a game's steps are not all
   * text: text submissions land only on steps expecting 'text'.
   * Omitted by games whose steps all take text.
   */
  readonly expectedKind?: (stepIndex: number) => string;
  /**
   * Extra game-owned submission gate (for example in-flight work
   * that already claims the seat's submission), checked after the
   * duplicate gate and before content validation; returns the
   * game's rejection reason or null to let the submission through.
   */
  readonly submissionRejection?: (seat: number) => string | null;
  /** Builds the game's entry for a text or empty submission. */
  readonly buildEntry: (
    submission: { readonly kind: 'text'; readonly text: string } | { readonly kind: 'empty' },
    seat: number,
    context: CommandContext,
    task: RelayTask<TPrevious>,
  ) => TEntry;
  /**
   * Fires when the final step's last entry lands: the game's
   * round-completed event and settlement effect. Injected because
   * the event and effect shapes are game-owned.
   */
  readonly onRoundCompleted: (
    kit: RelayEventKit<TEntry, TEvent, TEffect>,
    state: RelayRoundSlice<TEntry> & RelayActorSlice,
    appended: readonly { readonly chainId: string; readonly entry: TEntry }[],
    nowMs: number,
  ) => { readonly events: readonly TEvent[]; readonly effects: readonly TEffect[] };
}

function appendRelayEntry<TEntry, TPrevious, TEvent extends GameEvent, TEffect extends GameEffect>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: RelayRoundSlice<TEntry> & RelayActorSlice,
  appended: { readonly chainId: string; readonly entry: TEntry },
  nowMs: number,
  hooks: RelayTaskHooks<TEntry, TPrevious, TEvent, TEffect>,
): Decision<TEvent, TEffect> {
  const events: TEvent[] = [kit.entryAppended(appended.chainId, appended.entry)];
  const effects: TEffect[] = [];
  const submitted =
    state.chains.filter((chain) => chain.entries.length > state.stepIndex).length + 1;
  if (submitted === kit.shape.numberOfPlayers) {
    events.push(
      kit.phaseChanged(
        'transition',
        relayDeadline(nowMs, kit.shape.transitionDurationSeconds),
        state.stepIndex,
        null,
      ),
    );
    if (state.stepIndex === kit.shape.numberOfPlayers - 1) {
      const completion = hooks.onRoundCompleted(kit, state, [appended], nowMs);
      events.push(...completion.events);
      effects.push(...completion.effects);
    }
  }
  return kit.commit(events, effects);
}

/** Decides authenticated readiness or a final submission, rejecting stale identity and duplicates. */
export function decideRelayTask<
  TEntry,
  TPrevious,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(
  kit: RelayEventKit<TEntry, TEvent, TEffect>,
  state: RelayRoundSlice<TEntry> & RelayActorSlice,
  command: RelayTaskCommand,
  context: CommandContext,
  hooks: RelayTaskHooks<TEntry, TPrevious, TEvent, TEffect>,
): Decision<TEvent, TEffect> {
  const phase = command.kind === 'ready' ? 'answering' : 'settling';
  if (state.phase !== phase) return reject(kit.reasons.phase);
  const lateRejection = rejectIfPastDeadline<TEvent, TEffect>(
    state.deadlineAt,
    context.nowMs,
    kit.reasons.taskExpired ?? kit.reasons.task,
  );
  if (lateRejection !== null) return lateRejection;
  const acting = resolveActingSeat(state, kit.shape.numberOfPlayers, context);
  if (acting.kind === 'rejected') return reject(acting.reason);
  const seat = acting.value;
  if (!matchesRelayTask(state, command, seat, kit.shape.numberOfPlayers, hooks.stripPreviousEntry))
    return reject(kit.reasons.task);
  const task = getRelayTaskForSeat(
    state,
    seat,
    kit.shape.numberOfPlayers,
    hooks.stripPreviousEntry,
  )!;
  if (task.isSubmitted) return reject(kit.reasons.submitted);
  if (command.kind === 'ready') {
    if (state.readySeats.includes(seat) === command.isReady) return kit.commit([]);
    const events: TEvent[] = [kit.taskReady(seat, command.isReady)];
    if (command.isReady && state.readySeats.length + 1 === kit.shape.numberOfPlayers)
      events.push(kit.phaseChanged('settling', null, state.stepIndex, null));
    return kit.commit(events);
  }
  if (
    command.kind === 'text' &&
    hooks.expectedKind !== undefined &&
    hooks.expectedKind(state.stepIndex) !== 'text'
  )
    return reject(kit.reasons.task);
  if (hooks.submissionRejection !== undefined) {
    const reason = hooks.submissionRejection(seat);
    if (reason !== null) return reject(reason);
  }
  if (command.kind === 'text' && !hooks.validateText(command.text)) return reject(kit.reasons.text);
  const entry = hooks.buildEntry(
    command.kind === 'text' ? { kind: 'text', text: command.text } : { kind: 'empty' },
    seat,
    context,
    task,
  );
  return appendRelayEntry(kit, state, { chainId: task.chainId, entry }, context.nowMs, hooks);
}
