/**
 * Magician Role Model
 * 
 * Acts before everyone else each night.
 * Can swap the position numbers of two players.
 * The swap is effective for that night only.
 */

import { GodBaseRole } from './GodBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class MagicianRole extends GodBaseRole {
  readonly id = 'magician';
  readonly displayName = '魔术师';
  readonly description = '每晚在其他所有人之前行动，交换2个人的号码牌，当晚有效';
  readonly hasNightAction = true;
  readonly actionOrder = -2; // Very first to act
  readonly actionMessage = '请选择两名交换对象';
  readonly actionConfirmMessage = '交换';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '魔术师请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
}

export const magicianRole = new MagicianRole();
