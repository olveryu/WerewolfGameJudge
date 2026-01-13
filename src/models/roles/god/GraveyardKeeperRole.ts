/**
 * Graveyard Keeper Role Model
 * 
 * Each night can check a dead player's identity card.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class GraveyardKeeperRole extends GodBaseRole {
  readonly id = 'graveyardKeeper';
  readonly displayName = '守墓人';
  readonly description = '每晚可以得知上一个白天被放逐的玩家是好人或狼人。';
  // Night-1-only scope: there is no "last day exile" info on the first night,
  // so GraveyardKeeper must not be part of the night action flow.
  readonly hasNightAction = false;
  readonly actionOrder = 999; // No night action
}

export const graveyardKeeperRole = new GraveyardKeeperRole();
