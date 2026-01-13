/**
 * Psychic Role Model
 * 
 * Each night can check a player's exact identity card (not just faction).
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class PsychicRole extends GodBaseRole {
  readonly id = 'psychic';
  readonly displayName = '通灵师';
  readonly description = '每晚可以查验一名玩家的具体身份牌（不只是阵营）';
  readonly hasNightAction = true;
  readonly actionOrder = 16; // After seer
  readonly actionMessage = '请选择查验对象';
  readonly actionConfirmMessage = '查验';
}

export const psychicRole = new PsychicRole();
