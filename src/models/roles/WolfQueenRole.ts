/**
 * Wolf Queen Role Model
 * 
 * The wolf queen can charm a player each night after participating in the kill.
 * When the wolf queen dies during the day, the charmed player dies with her.
 * The charmed player doesn't know they are charmed.
 */

import { WolfBaseRole } from './WolfBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class WolfQueenRole extends WolfBaseRole {
  readonly id = 'wolfQueen';
  readonly displayName = '狼美人';
  readonly description = '每晚参与袭击后可魅惑一名玩家，狼美人白天出局时被魅惑者随之殉情出局。被魅惑者不知情';
  readonly hasNightAction = true;
  readonly actionOrder = 6; // After wolf kill vote
  readonly actionMessage = '请选择魅惑对象';
  readonly actionConfirmMessage = '魅惑';
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '狼美人请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
}

export const wolfQueenRole = new WolfQueenRole();
