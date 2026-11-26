/**
 * 工具箱两套 codec：权威状态 codec 只用于 Durable Object 持久化、决策与回执；
 * 视图 codec 用于所有网络输出和客户端解码。
 */

import type { GameStateCodec } from '../../../platform/protocol/roomSnapshot';
import { parseToolboxState } from './parseState';
import type { ToolboxState } from './types';
import { parseToolboxView, type ToolboxView } from './view';

export const TOOLBOX_STATE_CODEC = {
  gameType: 'toolbox',
  parse: parseToolboxState,
} satisfies GameStateCodec<ToolboxState>;

export const TOOLBOX_VIEW_CODEC = {
  gameType: 'toolbox',
  parse: parseToolboxView,
} satisfies GameStateCodec<ToolboxView>;
