/** Applies Secrethitler domain events; reset paths clear all game-owned state. */

import { acknowledgeAudioQueue, queueAudioBatch } from '../../../platform/audio';
import { markSeatViewed } from '../../../platform/room/identityViewing';
import { applyRosterChanges } from '../../../platform/room/seating';
import type { SecrethitlerState } from '../state/types';
import type { SecrethitlerEvent } from './decision';

/** Resets mutable game data while preserving room configuration and seats. */
function resetSecrethitlerGame(state: SecrethitlerState): SecrethitlerState {
  return {
    ...state,
    phase: { kind: 'lobby' },
    phaseRevision: state.phaseRevision + 1,
    identities: {},
    roleViewedSeats: [],
    xpSettled: false,
    pendingAudioEffects: [],
    isAudioPlaying: false,
    livingSeats: [],
    nextPresidentSeat: 0,
    electionTracker: 0,
    lastPresidentSeat: null,
    lastChancellorSeat: null,
    liberalPolicies: 0,
    fascistPolicies: 0,
    policyDeck: [],
    policyDiscard: [],
    investigatedSeats: [],
    lastInvestigation: null,
    history: { governments: [], policies: [], actions: [] },
  };
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveSecrethitlerState(
  state: SecrethitlerState,
  event: SecrethitlerEvent,
): SecrethitlerState {
  const bumped = { ...state, phaseRevision: state.phaseRevision + 1 };
  switch (event.type) {
    case 'secrethitler.seats.changed':
      return { ...bumped, roster: applyRosterChanges(state.roster, event.changes) };
    case 'secrethitler.config.updated':
      return { ...bumped, config: event.config };
    case 'secrethitler.game.started':
      return {
        ...resetSecrethitlerGame(state),
        phaseRevision: state.phaseRevision + 1,
        // 发牌落入独立查看阶段；开始玩由房主在全员查看后手动 begin。
        phase: { kind: 'viewing' },
        // 发牌不自动标记；房主显式批量标记或逐个接管后确认。
        roleViewedSeats: [],
        identities: { ...event.identities },
        gameSequence: event.gameSequence,
        livingSeats: Object.keys(event.identities).map(Number),
        nextPresidentSeat: event.firstPresidentSeat,
        electionTracker: 0,
        lastPresidentSeat: null,
        lastChancellorSeat: null,
        liberalPolicies: 0,
        fascistPolicies: 0,
        policyDeck: [...event.policyDeck],
        policyDiscard: [],
        investigatedSeats: [],
        lastInvestigation: null,
        history: { governments: [], policies: [], actions: [] },
      };
    case 'secrethitler.gameplay.updated':
      return { ...bumped, ...event.patch };
    case 'secrethitler.role.viewed': {
      if (state.roleViewedSeats.includes(event.seat)) return state;
      return { ...bumped, roleViewedSeats: markSeatViewed(state.roleViewedSeats, event.seat) };
    }
    case 'secrethitler.audio.queued': {
      // The shared machine owns the transition (replace + gate close + next batch id);
      // an empty batch cannot reach here — queueing fail-fasts in decide.
      return { ...bumped, ...queueAudioBatch(state, event.effects) };
    }
    case 'secrethitler.audio.cleared': {
      const ack = acknowledgeAudioQueue(state, event.audioBatchId);
      if (ack.kind !== 'cleared') return state;
      return { ...bumped, ...ack.slice };
    }
    case 'secrethitler.game.ended': {
      if (state.phase.kind === 'ended') return state;
      return {
        ...bumped,
        phase: { kind: 'ended', winner: event.winner, reason: event.reason },
        xpSettled: true,
      };
    }
    case 'secrethitler.game.returnedToLobby':
      return resetSecrethitlerGame(state);
  }
}
