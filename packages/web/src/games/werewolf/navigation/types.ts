/** Werewolf-owned root route extensions and configuration-flow steps. */

import type { GameRuleOverrides, RoleId } from '@game-judge/game-engine/games/werewolf/public';

export type WerewolfConfigRouteParams =
  | {
      readonly gameType: 'werewolf';
      readonly mode: 'create';
    }
  | {
      readonly gameType: 'werewolf';
      readonly mode: 'edit' | 'nominate';
      readonly roomCode: string;
    };

export type WerewolfGuideTab = 'gameplay' | 'roles' | 'boards';

export interface WerewolfGuideRouteParams {
  readonly gameType: 'werewolf';
  readonly roomCode?: string;
  readonly roleId?: RoleId;
  readonly initialTab?: WerewolfGuideTab;
}

/** The config flow's steps; the current one is the `step` search param of the config page. */
export type WerewolfConfigStep = 'BoardPicker' | 'Config' | 'Rules';

export interface WerewolfNominateMode {
  readonly roomCode: string;
}

export interface WerewolfBoardPickerParams {
  readonly existingRoomCode?: string;
  readonly nominateMode?: WerewolfNominateMode;
}

export interface WerewolfConfigParams {
  readonly existingRoomCode?: string;
  readonly presetName?: string;
  readonly nominateMode?: WerewolfNominateMode;
  readonly updatedRules?: GameRuleOverrides;
}

export interface WerewolfRulesParams {
  readonly roles: readonly RoleId[];
  readonly rules: GameRuleOverrides;
  readonly existingRoomCode?: string;
}
