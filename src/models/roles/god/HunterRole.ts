/**
 * Hunter Role Model
 * 
 * When killed by wolves, the hunter can shoot one player.
 * However, if poisoned by the witch, the hunter cannot shoot.
 * 
 * Note: This app only handles the first night, so there's no daytime voting.
 */

import { GodBaseRole } from '../base/GodBaseRole';
import { ActionDialogConfig } from '../base/BaseRole';

export class HunterRole extends GodBaseRole {
  readonly id = 'hunter';
  readonly displayName = '猎人';
  readonly description = '被狼人杀害时，可以开枪带走一名玩家。被女巫毒死则不能开枪';
  readonly hasNightAction = true;
  readonly actionOrder = 20;
  readonly actionMessage = '请确认你的发动状态';
  readonly actionConfirmMessage = '确认';
  
  /**
   * Get the hunter status dialog configuration
   */
  getStatusDialogConfig(canUseSkill: boolean): ActionDialogConfig {
    return {
      title: '猎人技能状态',
      message: canUseSkill ? '可以发动' : '不可发动',
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Check if hunter can use skill based on death cause
   * - Killed by wolves: CAN shoot
   * - Poisoned by witch: CANNOT shoot
   */
  canShoot(deathCause: 'wolf' | 'poison'): boolean {
    return deathCause === 'wolf';
  }
}

export const hunterRole = new HunterRole();
