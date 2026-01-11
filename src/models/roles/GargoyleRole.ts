/**
 * Gargoyle Role Model
 * 
 * Each night, the gargoyle can check if a player is a god role.
 * Does not participate in the wolf kill vote.
 */

import { WolfBaseRole } from './WolfBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class GargoyleRole extends WolfBaseRole {
  readonly id = 'gargoyle';
  readonly displayName = '石像鬼';
  readonly description = '每晚可以查验一名玩家的具体身份。当其他所有狼人出局后，可在夜间进行袭击。';
  readonly hasNightAction = true;
  readonly actionOrder = 1; // Very early, before wolf vote
  readonly actionMessage = '请选择查验对象';
  readonly actionConfirmMessage = '查验';
  
  // Gargoyle does NOT participate in wolf vote
  readonly participatesInWolfVote = false;
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '石像鬼请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Get the result dialog after checking a player
   */
  getCheckResultDialogConfig(targetSeat: number, roleDisplayName: string): ActionDialogConfig {
    return {
      title: `${targetSeat + 1}号玩家`,
      message: `具体身份：${roleDisplayName}`,
      buttons: [
        { text: '确定', onPress: () => {} }
      ]
    };
  }
}

export const gargoyleRole = new GargoyleRole();
