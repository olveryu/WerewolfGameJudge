/** Secrethitler commands; actors come from platform authentication. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { SecrethitlerConfig } from '../state/types';

export type SecrethitlerPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'secrethitler.config.update'; readonly config: SecrethitlerConfig }
  | { readonly type: 'secrethitler.roles.assign' }
  | { readonly type: 'secrethitler.game.begin' }
  | { readonly type: 'secrethitler.review.complete'; readonly gameSequence: number }
  | {
      readonly type: 'secrethitler.game.restart';
      readonly gameSequence: number;
      readonly wasEnded: boolean;
    }
  | { readonly type: 'secrethitler.bots.markAllBotsViewed' }
  | { readonly type: 'secrethitler.bots.markAllBotsGroupConfirmed' }
  | { readonly type: 'secrethitler.audio.ack'; readonly audioBatchId: number }
  | { readonly type: 'secrethitler.role.viewed' }
  | { readonly type: 'secrethitler.night.replay'; readonly step: number }
  | { readonly type: 'secrethitler.night.confirm'; readonly step: number }
  | { readonly type: 'secrethitler.government.nominate'; readonly chancellorSeatId: number }
  | { readonly type: 'secrethitler.government.castVote'; readonly vote: 'ja' | 'nein' }
  | {
      readonly type: 'secrethitler.policy.presidentDiscard';
      readonly policy: 'liberal' | 'fascist';
    }
  | (
      | {
          readonly type: 'secrethitler.policy.chancellorResolve';
          readonly action: 'enact';
          readonly policy: 'liberal' | 'fascist';
        }
      | { readonly type: 'secrethitler.policy.chancellorResolve'; readonly action: 'veto' }
    )
  | { readonly type: 'secrethitler.policy.vetoRespond'; readonly approve: boolean }
  | { readonly type: 'secrethitler.action.investigate'; readonly targetSeatId: number }
  | { readonly type: 'secrethitler.action.acknowledgeInvestigation' }
  | { readonly type: 'secrethitler.action.specialElection'; readonly targetSeatId: number }
  | { readonly type: 'secrethitler.action.execute'; readonly targetSeatId: number }
  | { readonly type: 'secrethitler.action.acknowledgePolicyPeek' };

/**
 * Worker-originated commands: the skeleton has no worker-originated
 * flow yet, so the partition is empty. The first asynchronous flow
 * (word supply, media, timers) adds its command here, unions it into
 * `SecrethitlerCommand` below, and replaces the `z.never()`
 * internal schema in the Worker module.
 */
export type SecrethitlerInternalCommand = { readonly type: 'secrethitler.phase.settleExpired' };

/**
 * The full command surface the engine decides. While the internal
 * partition is empty this is the public surface alone — unioning
 * `never` in would be a redundant constituent; the first internal
 * command joins by extending this type to
 * `SecrethitlerPublicCommand | SecrethitlerInternalCommand`,
 * and the Worker dispatch typing fails until it does.
 */
export type SecrethitlerCommand = SecrethitlerPublicCommand | SecrethitlerInternalCommand;
