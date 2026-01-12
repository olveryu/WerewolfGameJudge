/**
 * Nightmare Role Model
 * 
 * Each night, the nightmare can block a player's skill.
 * The blocked player's skill is ineffective for that night.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';
import { ActionDialogConfig, RoleActionContext } from '../base/BaseRole';

export class NightmareRole extends WolfBaseRole {
  readonly id = 'nightmare';
  readonly displayName = '梦魇';
  readonly description = '每晚在所有人行动之前恐惧一名玩家，使其当夜无法使用技能。不能连续两晚恐惧同一名玩家。首夜进行恐惧时与其他狼人不互知身份；若首夜选择到狼人，则狼人阵营当夜不能刀人。';
  readonly hasNightAction = true;
  readonly actionOrder = 2; // Early in night, before most actions
  readonly actionMessage = '请选择封锁对象';
  readonly actionConfirmMessage = '封锁';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '梦魇请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
}

export const nightmareRole = new NightmareRole();
