/**
 * Blood Moon Role Model
 * 
 * On the first night, randomly gains a god's skill.
 * After that, acts as a normal wolf.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';

export class BloodMoonRole extends WolfBaseRole {
  readonly id = 'bloodMoon';
  readonly displayName = '血月使徒';
  readonly description = '血月使徒自爆后的当晚所有好人的技能都将会被封印，若血月使徒是最后一个被放逐出局的狼人，他可以存活到下一个白天天亮之后才出局。';
  readonly hasNightAction = false; // Special handling on first night
  readonly actionOrder = 999;
}

export const bloodMoonRole = new BloodMoonRole();
