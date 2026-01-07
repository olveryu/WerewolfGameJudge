/**
 * Guard Role Model
 * 
 * The guard can protect one player each night from wolf attacks.
 * Cannot protect the same player two nights in a row.
 * Cannot protect against witch's poison.
 */

import { GodBaseRole } from './GodBaseRole';
import { ActionDialogConfig, RoleActionContext, ActionResult } from './BaseRole';

export class GuardRole extends GodBaseRole {
  readonly id = 'guard';
  readonly displayName = '守卫';
  readonly description = '每晚可以守护一名玩家使其不被狼人杀害，但不能连续两晚守护同一人。守卫无法防御女巫的毒药';
  readonly hasNightAction = true;
  readonly actionOrder = 3; // Before wolves
  readonly actionMessage = '请选择守护对象';
  readonly actionConfirmMessage = '守护';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '守卫请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Validate guard action - cannot protect same player two nights in a row
   */
  validateAction(target: number | null, _context: RoleActionContext, lastProtected?: number | null): ActionResult {
    if (target !== null && target === lastProtected) {
      return {
        success: false,
        error: '不能连续两晚守护同一人'
      };
    }
    return { success: true, target };
  }
}

export const guardRole = new GuardRole();
