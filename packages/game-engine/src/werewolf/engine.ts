/**
 * werewolfEngine — the werewolf GameEngine registered into the room engine registry.
 */

import type { GameEngine } from '../engine/registry/types';
import { WEREWOLF_GAME_TYPE } from '../protocol/gameTypes';
import { WEREWOLF_ACTION } from './actions';
import { dispatchWerewolf } from './dispatch';
import { runInlineProgression } from './inlineProgression';
import type { WerewolfState } from './protocol/types';
import type { StateAction } from './reducer/types';
import { werewolfReducer } from './reducer/werewolfReducer';
import {
  buildInitialWerewolfState,
  type WerewolfCreateConfig,
} from './state/buildInitialWerewolfState';
import { normalizeWerewolfState } from './state/normalizeWerewolfState';

const INLINE_PROGRESSION_TRIGGERS = new Set<string>([
  WEREWOLF_ACTION.SUBMIT_ACTION,
  WEREWOLF_ACTION.AUDIO_ACK,
  WEREWOLF_ACTION.PROGRESSION,
  WEREWOLF_ACTION.REVEAL_ACK,
  WEREWOLF_ACTION.WOLF_ROBOT_VIEWED,
  WEREWOLF_ACTION.GROUP_CONFIRM_ACK,
  WEREWOLF_ACTION.MARK_BOTS_GROUP_CONFIRMED,
]);

export const werewolfEngine: GameEngine<WerewolfState, StateAction, WerewolfCreateConfig> = {
  gameType: WEREWOLF_GAME_TYPE,
  createInitialState: (config, ctx) =>
    buildInitialWerewolfState(ctx.roomCode, ctx.hostUserId, config),
  dispatch: dispatchWerewolf,
  afterReduce: (state, context) => {
    if (!INLINE_PROGRESSION_TRIGGERS.has(context.trigger.actionType)) {
      return [];
    }
    return runInlineProgression(state, state.hostUserId, context.nowMs).actions;
  },
  reduce: werewolfReducer,
  normalize: normalizeWerewolfState,
};
