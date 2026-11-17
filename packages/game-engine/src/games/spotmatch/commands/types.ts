/** Spotmatch commands; actors come from platform authentication. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { SpotmatchConfig } from '../state/types';

export type SpotmatchPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'spotmatch.config.update'; readonly config: SpotmatchConfig }
  | { readonly type: 'spotmatch.game.begin' }
  | { readonly type: 'spotmatch.game.returnToLobby' }
  | { readonly type: 'spotmatch.game.abort' }
  | {
      readonly type: 'spotmatch.card.claim';
      readonly roundId: string;
      readonly centralInstanceId: string;
      readonly topInstanceId: string;
      readonly symbolId: number;
    };

/**
 * Worker-originated commands: the skeleton has no worker-originated
 * flow yet, so the partition is empty. The first asynchronous flow
 * (word supply, media, timers) adds its command here, unions it into
 * `SpotmatchCommand` below, and replaces the `z.never()`
 * internal schema in the Worker module.
 */
export type SpotmatchInternalCommand = never;

/**
 * The full command surface the engine decides. While the internal
 * partition is empty this is the public surface alone — unioning
 * `never` in would be a redundant constituent; the first internal
 * command joins by extending this type to
 * `SpotmatchPublicCommand | SpotmatchInternalCommand`,
 * and the Worker dispatch typing fails until it does.
 */
export type SpotmatchCommand = SpotmatchPublicCommand;
