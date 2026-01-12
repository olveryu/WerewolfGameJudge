/**
 * Witch Role Model
 * 
 * The witch has two potions:
 * - Antidote: Can save the wolf's victim (but NOT herself)
 * - Poison: Can kill any player
 * 
 * Each potion can only be used once per game.
 */

import { GodBaseRole } from '../base/GodBaseRole';
import { ActionDialogConfig, RoleActionContext, ActionResult } from '../base/BaseRole';

export class WitchRole extends GodBaseRole {
  readonly id = 'witch';
  readonly displayName = '女巫';
  readonly description = '拥有一瓶解药和一瓶毒药，每晚可以选择救活被狼人袭击的玩家或毒死一名玩家，每瓶药只能使用一次';
  readonly hasNightAction = true;
  readonly actionOrder = 10; // After wolf (5), before seer (15)
  readonly actionMessage = '请选择使用毒药或解药';
  readonly actionConfirmMessage = '使用';
  
  /**
   * IMPORTANT: Witch cannot save herself
   * This is a core game rule
   */
  readonly canSaveSelf = false;
  
  getActionDialogConfig(context: RoleActionContext): ActionDialogConfig | null {
    const { killedIndex, mySeatNumber, proceedWithAction, showNextDialog } = context;
    
    // No one killed tonight
    if (killedIndex === -1) {
      return {
        title: '昨夜无人倒台',
        message: '',
        buttons: [
          { text: '好', onPress: () => showNextDialog?.() }
        ]
      };
    }
    
    // Witch was killed - cannot save herself
    if (killedIndex === mySeatNumber) {
      return {
        title: `昨夜倒台玩家为${killedIndex + 1}号（你自己）`,
        message: '女巫无法自救',
        buttons: [
          { text: '好', onPress: () => showNextDialog?.() }
        ]
      };
    }
    
    // Someone else was killed - can choose to save
    return {
      title: `昨夜倒台玩家为${killedIndex + 1}号`,
      message: '是否救助?',
      buttons: [
        { 
          text: '救助', 
          onPress: () => proceedWithAction(killedIndex, false)
        },
        { 
          text: '不救助', 
          style: 'cancel',
          onPress: () => showNextDialog?.()
        }
      ]
    };
  }
  
  /**
   * Get the poison dialog configuration
   */
  getPoisonDialogConfig(): ActionDialogConfig {
    return {
      title: '请选择是否使用毒药',
      message: '点击玩家头像使用毒药，如不使用毒药，请点击下方「不使用技能」',
      buttons: [
        { text: '好', style: 'default', onPress: () => {} }
      ]
    };
  }
  
  validateAction(target: number | null, context: RoleActionContext): ActionResult {
    // Saving self is not allowed
    if (target === context.mySeatNumber && target === context.killedIndex) {
      return { 
        success: false, 
        error: '女巫无法自救' 
      };
    }
    
    return { success: true, target };
  }
}

// Singleton instance
export const witchRole = new WitchRole();
