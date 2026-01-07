/**
 * Blood Moon Role Model
 * 
 * On the first night, randomly gains a god's skill.
 * After that, acts as a normal wolf.
 */

import { WolfBaseRole } from './WolfBaseRole';

export class BloodMoonRole extends WolfBaseRole {
  readonly id = 'bloodMoon';
  readonly displayName = '血月使徒';
  readonly description = '第一晚随机获得一个神职技能，之后作为普通狼人';
  readonly hasNightAction = false; // Special handling on first night
  readonly actionOrder = 999;
}

export const bloodMoonRole = new BloodMoonRole();
