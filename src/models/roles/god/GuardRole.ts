/**
 * Guard Role Model
 * 
 * The guard can protect one player each night from wolf attacks.
 * Cannot protect the same player two nights in a row.
 * Cannot protect against witch's poison.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class GuardRole extends GodBaseRole {
  readonly id = 'guard';
  readonly displayName = '守卫';
  readonly description = '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药';
  readonly hasNightAction = true;
  readonly actionOrder = 3; // Before wolves
  readonly actionMessage = '请选择守护对象';
  readonly actionConfirmMessage = '守护';
}

export const guardRole = new GuardRole();
