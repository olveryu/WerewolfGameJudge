/**
 * Dark Wolf King Role Model
 * 
 * When killed by wolves (knife), the dark wolf king can shoot one player.
 * This is the wolf version of the hunter.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';
import { ActionDialogConfig } from '../base/BaseRole';

export class DarkWolfKingRole extends WolfBaseRole {
  readonly id = 'darkWolfKing';
  readonly displayName = '黑狼王';
  readonly description = '被刀杀时可以开枪带走一名玩家（狼人版猎人）';
  readonly hasNightAction = true;
  readonly actionOrder = 25; // Last in night phase
  readonly actionMessage = '请确认你的发动状态';
  readonly actionConfirmMessage = '确认';
  
  /**
   * Get the dark wolf king status dialog configuration
   */
  getStatusDialogConfig(canUseSkill: boolean): ActionDialogConfig {
    return {
      title: '黑狼王技能状态',
      message: canUseSkill ? '可以发动' : '不可发动',
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
  
  /**
   * Check if dark wolf king can use skill based on death cause
   * - Killed by wolves (friendly fire): CAN shoot
   * - Poisoned by witch: CANNOT shoot
   */
  canShoot(deathCause: 'wolf' | 'poison'): boolean {
    return deathCause === 'wolf';
  }
}

export const darkWolfKingRole = new DarkWolfKingRole();
