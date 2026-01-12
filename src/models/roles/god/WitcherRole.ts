/**
 * Witcher Role Model
 * 
 * Starting from the second night, can hunt a player each night.
 * If the target is a wolf, the target dies the next day.
 * If the target is a villager, the witcher dies the next day.
 * Immune to witch's poison.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class WitcherRole extends GodBaseRole {
  readonly id = 'witcher';
  readonly displayName = '猎魔人';
  readonly description = '从第二晚开始，每晚可选择一名玩家狩猎。若对方是狼人则次日对方出局，若对方是好人则次日猎魔人出局。女巫毒药对猎魔人无效';
  // NOTE: Current app scope is "first night only".
  // Witcher can only act starting from the second night, so on night 1 it must
  // be treated as having no night action.
  readonly hasNightAction = false;
  readonly actionOrder = 18; // After seer
  
  // Witcher is immune to poison
  readonly immuneToPoison = true;
  
}

export const witcherRole = new WitcherRole();
