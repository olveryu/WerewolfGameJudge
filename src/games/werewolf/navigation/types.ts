/** Werewolf-owned root route extensions and configuration-flow routes. */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { GameRuleOverrides } from '@game-judge/game-engine/games/werewolf/public';

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

export type WerewolfGuideTab = 'roles' | 'boards';

export interface WerewolfGuideRouteParams {
  readonly gameType: 'werewolf';
  readonly roomCode?: string;
  readonly roleId?: RoleId;
  readonly initialTab?: WerewolfGuideTab;
}

export interface WerewolfNotepadRouteParams {
  readonly gameType: 'werewolf';
  readonly roomCode: string;
}

export type WerewolfConfigStackParamList = {
  BoardPicker:
    | {
        existingRoomCode?: string;
        nominateMode?: { roomCode: string };
      }
    | undefined;
  Config:
    | {
        existingRoomCode?: string;
        presetName?: string;
        nominateMode?: { roomCode: string };
        updatedRules?: GameRuleOverrides;
      }
    | undefined;
  Rules: {
    rules: GameRuleOverrides;
    existingRoomCode?: string;
    nominateMode?: { roomCode: string };
  };
};
