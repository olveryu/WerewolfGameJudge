/** Public pure API for the Werewolf game module. */

export type {
  WerewolfActionInput,
  WerewolfCommand,
  WerewolfInternalCommand,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from './commands/types';
export { createWerewolfGameEndedEffect } from './effects/gameEnded';
export type {
  WerewolfEffect,
  WerewolfGameEndedEffect,
  WerewolfGameEndedParticipant,
} from './effects/types';
export {
  decideWerewolfCommand,
  getWerewolfLifecycle,
  type WerewolfConfig,
  type WerewolfEngine,
  werewolfEngine,
} from './engine';
export {
  parseWerewolfPublicStats,
  WEREWOLF_CAMP_ORDER,
  type WerewolfCampStats,
  type WerewolfPublicStats,
} from './publicStats';
export { WEREWOLF_STATE_CODEC } from './state/codec';
export { parseWerewolfState } from './state/parseState';
export { WEREWOLF_STATE_IDENTITY, WEREWOLF_STATE_VERSION } from './state/version';
