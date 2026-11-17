/** Spotmatch semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import { isBotOccupant } from '../../../platform/room/seating';
import { SPOTMATCH_CARD_TYPES } from '../domain/cards';
import { isValidSpotmatchConfig, type SpotmatchHumanSeat, type SpotmatchState } from './types';
import { SPOTMATCH_STATE_IDENTITY } from './version';

const invariant: StateInvariant = createStateInvariant('Spotmatch');

/** Validates authoritative state without repairing or dropping submitted content. */
export function normalizeSpotmatchState(state: SpotmatchState): SpotmatchState {
  assertStateIdentity(state, SPOTMATCH_STATE_IDENTITY, 'Spotmatch');
  invariant(isValidSpotmatchConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.gameSequence) && state.gameSequence >= 0, 'game sequence');
  invariant(typeof state.xpSettled === 'boolean', 'xp settled flag');
  const entries = Object.entries(state.roster);
  invariant(
    entries.every(
      ([seat, occupant]) =>
        occupant != null &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        (isBotOccupant(occupant) || occupant.profile.displayName.trim().length > 0),
    ),
    'roster seats',
  );
  const users = entries.filter(
    (entry): entry is [string, SpotmatchHumanSeat] => entry[1] != null && !isBotOccupant(entry[1]),
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant.userId)).size === users.length,
    'duplicate user',
  );
  if (state.phase.kind === 'ended') invariant(state.xpSettled, 'ended settles exactly once');
  invariant((state.phase.kind === 'lobby') === (state.round === null), 'round lifecycle');
  const round = state.round;
  if (round !== null) {
    invariant(new Set(round.symbolMap).size === 57, 'unique symbol map');
    invariant(round.players.length === count, 'frozen roster length');
    invariant(new Set(round.players.map((player) => player.seat)).size === count, 'unique players');
    invariant(round.isTest === round.players.some((player) => player.isBot), 'test game');
    if (round.success !== null) {
      invariant(isSeat(round.success.seat), 'success seat');
      invariant(round.success.seat === round.lastPlayedSeat, 'success discarder');
      invariant(
        round.central.symbols.includes(round.success.symbolId) &&
          round.success.previousCentral.symbols.includes(round.success.symbolId),
        'success match',
      );
      invariant(
        Number.isSafeInteger(round.success.until) && round.success.until > 0,
        'success deadline',
      );
    }
    const cards = [
      round.central,
      ...round.players.flatMap((player) => (player.top === null ? [] : [player.top])),
    ];
    invariant(
      new Set(cards.map((card) => card.typeId)).size === cards.length,
      'distinct visible types',
    );
    invariant(
      new Set(cards.map((card) => card.instanceId)).size === cards.length,
      'unique instances',
    );
    for (const card of [
      ...cards,
      ...(round.success === null ? [] : [round.success.previousCentral]),
    ]) {
      const points = SPOTMATCH_CARD_TYPES[card.typeId];
      invariant(points !== undefined, 'card type');
      invariant(
        card.symbols.length === 8 &&
          new Set(card.symbols).size === 8 &&
          points?.every((point) => card.symbols.includes(round.symbolMap[point] ?? -1)),
        'card symbols',
      );
    }
    for (const player of round.players) {
      invariant(isSeat(player.seat), 'player seat');
      invariant(
        player.remaining + player.correct === state.config.cardsPerPlayer,
        'finite task count',
      );
      invariant(player.isBot === (player.userId === null), 'participant identity');
      invariant(player.remaining > 0 || player.top === null, 'empty hand');
    }
    const winner = round.players.find((player) => player.seat === round.winnerSeat);
    invariant(
      state.phase.kind === 'ended' ? winner?.remaining === 0 : round.winnerSeat === null,
      'winner',
    );
  }
  return state;
}
