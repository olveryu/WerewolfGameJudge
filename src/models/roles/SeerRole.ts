/**
 * Seer Role Model
 * 
 * The seer can check one player each night to learn if they are a wolf or not.
 */

import { GodBaseRole } from './GodBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class SeerRole extends GodBaseRole {
  readonly id = 'seer';
  readonly displayName = '预言家';
  readonly description = '每晚可以查验一名玩家的身份，获知该玩家是好人还是狼人';
  readonly hasNightAction = true;
  readonly actionOrder = 15;
  readonly actionMessage = '请选择查验对象';
  readonly actionConfirmMessage = '查验';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '预言家请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Get the result dialog after checking a player
   */
  getCheckResultDialogConfig(targetSeat: number, isWolf: boolean): ActionDialogConfig {
    return {
      title: `${targetSeat + 1}号玩家`,
      message: isWolf ? '是狼人' : '是好人',
      buttons: [
        { text: '确定', onPress: () => {} }
      ]
    };
  }
}

export const seerRole = new SeerRole();
