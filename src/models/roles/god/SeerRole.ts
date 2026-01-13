/**
 * Seer Role Model
 * 
 * The seer can check one player each night to learn if they are a wolf or not.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class SeerRole extends GodBaseRole {
  readonly id = 'seer';
  readonly displayName = '预言家';
  readonly description = '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人';
  readonly hasNightAction = true;
  readonly actionOrder = 15;
  readonly actionMessage = '请选择查验对象';
  readonly actionConfirmMessage = '查验';
}

export const seerRole = new SeerRole();
