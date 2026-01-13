/**
 * Dreamcatcher (摄梦人) Role Model
 * 
 * Each night must choose a player to become a sleepwalker.
 * The sleepwalker is immune to night damage but doesn't know they are sleepwalking.
 * If the dreamcatcher dies at night, the sleepwalker dies too.
 * If the same player is the sleepwalker two nights in a row, they die.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class DreamcatcherRole extends GodBaseRole {
  readonly id = 'celebrity'; // Keep role id for backward compatibility
  readonly displayName = '摄梦人';
  readonly englishName = 'Dreamcatcher';
  readonly description = '每晚必须选择一名玩家成为梦游者，梦游者不知道自己正在梦游，且免疫夜间伤害。摄梦人夜间出局则梦游者一并出局，连续两晚成为梦游者也会出局';
  readonly hasNightAction = true;
  readonly actionOrder = 1; // Early in night
  readonly actionMessage = '请选择摄梦对象';
  readonly actionConfirmMessage = '摄梦';
}

export const dreamcatcherRole = new DreamcatcherRole();
