/**
 * Graveyard Keeper Role Model
 * 
 * Each night can check a dead player's identity card.
 */

import { GodBaseRole } from './GodBaseRole';

export class GraveyardKeeperRole extends GodBaseRole {
  readonly id = 'graveyardKeeper';
  readonly displayName = '守墓人';
  readonly description = '每晚可以查验一名死亡玩家的身份牌';
  readonly hasNightAction = true;
  readonly actionOrder = 30; // Late in night
}

export const graveyardKeeperRole = new GraveyardKeeperRole();
