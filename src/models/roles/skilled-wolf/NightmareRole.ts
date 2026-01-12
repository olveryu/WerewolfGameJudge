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
  readonly description = '每晚可以封锁一名玩家，被封锁的玩家当晚技能失效';
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
