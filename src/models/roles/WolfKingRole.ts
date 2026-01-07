/**
 * Wolf King Role Model
 * 
 * During the day, the wolf king can self-destruct and take one player with him.
 * The killed player has no last words.
 * Cannot use skill if eliminated by other means.
 * 
 * Note: Day actions are not implemented yet (only first night is supported).
 */

import { WolfBaseRole } from './WolfBaseRole';

export class WolfKingRole extends WolfBaseRole {
  readonly id = 'wolfKing';
  readonly displayName = '白狼王';
  readonly description = '白天可以自爆并带走一名玩家，被带走的玩家无遗言。非自爆出局不能发动技能';
  readonly hasNightAction = false;
  readonly actionOrder = 999; // No night action, day ability only
}

export const wolfKingRole = new WolfKingRole();
