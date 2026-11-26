/** 工具箱公共命令。所有身份均来自认证上下文，命令不携带用户 ID。 */

import type { ToolboxConfig, ToolboxIdentityConfig } from '../state/types';

export type ToolboxPublicCommand =
  | { readonly type: 'toolbox.member.join' }
  | { readonly type: 'toolbox.member.leave' }
  | { readonly type: 'toolbox.seat.take' }
  | { readonly type: 'toolbox.seat.release' }
  | { readonly type: 'toolbox.seats.clear' }
  | { readonly type: 'toolbox.config.update'; readonly config: ToolboxConfig }
  | { readonly type: 'toolbox.session.begin'; readonly configVersion: number }
  | { readonly type: 'toolbox.session.end'; readonly sessionId: string }
  | {
      readonly type: 'toolbox.dice.setCount';
      readonly count: number;
      readonly cupVersion: number;
    }
  | { readonly type: 'toolbox.dice.roll'; readonly cupVersion: number }
  | { readonly type: 'toolbox.dice.reveal'; readonly cupVersion: number }
  | {
      readonly type: 'toolbox.dice.toggleHold';
      readonly dieId: number;
      readonly cupVersion: number;
    }
  | { readonly type: 'toolbox.identity.draw'; readonly roundId: string }
  | {
      readonly type: 'toolbox.identity.restart';
      readonly roundId: string;
      readonly identity: ToolboxIdentityConfig;
    };

/** 工具箱没有系统命令：无计时、无结算、无机器人。 */
export type ToolboxCommand = ToolboxPublicCommand;
