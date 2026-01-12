/**
 * Knight Role Model
 * 
 * During the day, can flip card and duel with a player.
 * If the target is a wolf, the wolf dies.
 * If the target is a villager, the knight dies.
 * 
 * Note: Day actions are not implemented yet (only first night is supported).
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class KnightRole extends GodBaseRole {
  readonly id = 'knight';
  readonly displayName = '骑士';
  readonly description = '白天可以翻牌与一名玩家决斗，狼人死；若对方是好人，骑士死';
  readonly hasNightAction = false;
  readonly actionOrder = 999;
}

export const knightRole = new KnightRole();
