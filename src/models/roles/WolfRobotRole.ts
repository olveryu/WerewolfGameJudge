/**
 * Wolf Robot Role Model
 * 
 * Does not know other wolves initially.
 * On the first night, learns a player's skill and identity.
 * Can use the learned skill starting the next night.
 * Gets the knife when all normal wolves are dead.
 * Cannot self-destruct.
 * Does not participate in the wolf kill vote.
 */

import { WolfBaseRole } from './WolfBaseRole';
import { ActionDialogConfig, RoleActionContext } from './BaseRole';

export class WolfRobotRole extends WolfBaseRole {
  readonly id = 'wolfRobot';
  readonly displayName = '机械狼';
  readonly description = '与普通狼人互不相认，第一晚最早睁眼学习任一玩家技能并获得其身份，当夜不能使用，下一夜可用。普通狼人全死后带刀，不能自爆（不参与狼人刀人）';
  readonly hasNightAction = true;
  readonly actionOrder = 0; // First to act
  readonly actionMessage = '请选择学习对象';
  readonly actionConfirmMessage = '学习';
  
  // Wolf Robot does NOT know other wolves and doesn't participate in vote
  readonly participatesInWolfVote = false;
  readonly canSeeWolves = false;
  
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return {
      title: '机械狼请睁眼',
      message: this.actionMessage,
      buttons: [
        { text: '好', onPress: () => {} }
      ]
    };
  }
}

export const wolfRobotRole = new WolfRobotRole();
