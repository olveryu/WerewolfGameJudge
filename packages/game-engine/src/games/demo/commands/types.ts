/** Demo commands; actors come from platform authentication. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '../../../platform/protocol/commands';
import type { RoomProfileUpdate, RoomSeatProfile } from '../../../platform/room/roster';
import type { DemoConfig } from '../state/types';

export type DemoPublicCommand =
  | RoomSeatCommand<RoomSeatProfile>
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | { readonly type: 'demo.config.update'; readonly config: DemoConfig }
  | { readonly type: 'demo.roles.assign' }
  | { readonly type: 'demo.game.begin' }
  | { readonly type: 'demo.game.returnToLobby' }
  | { readonly type: 'demo.role.viewed' }
  | { readonly type: 'demo.bots.markAllBotsViewed' }
  // TODO(gameplay): 玩法命令（行动、投票、技能……）逐条加在这里，并在
  // engine.ts 的 decide 分发与 Worker schemas.ts 的公开命令表同步登记；
  // 未实现的玩法命令必须显式 reject DEMO_REASONS.notImplemented，不许假绿。
  | { readonly type: 'demo.gameplay.example' };

/**
 * Worker-originated settle command: the room runtime fires the armed
 * stage deadline through a scheduled `demo.settle.due` effect, and
 * the effect handler dispatches this command as the system actor. It
 * runs the same settlement decide as the terminal seam; no public
 * expire command exists — the scheduled effect is the only channel.
 */
export type DemoInternalCommand = { readonly type: 'demo.phase.settleExpired' };

export type DemoCommand = DemoPublicCommand | DemoInternalCommand;
