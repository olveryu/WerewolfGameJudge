/**
 * Wolf Role Model
 * 
 * Basic werewolf that participates in the nightly kill vote.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';

export class WolfRole extends WolfBaseRole {
  readonly id = 'wolf';
  readonly displayName = '狼人';
  readonly description = '每晚与狼队友共同选择一名玩家猎杀';
  readonly hasNightAction = true;
  readonly actionOrder = 5;
  readonly actionMessage = '请选择猎杀对象';
  readonly actionConfirmMessage = '猎杀';
}

export const wolfRole = new WolfRole();
