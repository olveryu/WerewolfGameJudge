/** Werewolf-owned root route extensions and configuration-flow routes. */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameRuleOverrides } from '@werewolf/game-engine/models/Template';

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

export interface WerewolfGuideRouteExtension {
  readonly roleId?: RoleId;
  readonly initialTab?: 'roles' | 'boards';
}

export interface WerewolfNotepadRouteParams {
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
