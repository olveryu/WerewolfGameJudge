/**
 * Psychic Role Model
 * 
 * Each night can check a player's exact identity card (not just faction).
 */

import { GodBaseRole } from './GodBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class PsychicRole extends GodBaseRole {
  readonly id = 'psychic';
  readonly displayName = '通灵师';
  readonly description = '每晚可以查验一名玩家的具体身份牌（不只是阵营）';
  readonly hasNightAction = true;
  readonly actionOrder = 16; // After seer
  readonly actionMessage = '请选择查验对象';
  readonly actionConfirmMessage = '查验';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '通灵师请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Get the result dialog after checking a player
   * Returns the exact role, not just faction
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

export const psychicRole = new PsychicRole();
