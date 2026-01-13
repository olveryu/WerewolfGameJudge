/**
 * Magician Role Model
 * 
 * Acts before everyone else each night.
 * Can swap the position numbers of two players.
 * The swap is effective for that night only.
 */

import { GodBaseRole } from '../base/GodBaseRole';

export class MagicianRole extends GodBaseRole {
  readonly id = 'magician';
  readonly displayName = '魔术师';
  readonly description =
    '每晚在其他所有人之前行动，交换2个人的号码牌，当晚有效。\n'
    + '被魔术师交换号码牌的玩家，当夜所有对其施放的技能目标会被互换。\n'
    + '魔术师可以对自己使用技能，但每个玩家每局游戏只能被换一次。若所有玩家都被换过号码牌或剩余可换玩家不足2人，则魔术师无法使用技能。\n'
    + '女巫的救人信息不会被交换，只能看到原本遭遇狼人袭击的玩家。';
  readonly hasNightAction = true;
  readonly actionOrder = -2; // Very first to act
  readonly actionMessage = '请选择两名交换对象';
  readonly actionConfirmMessage = '交换';
}

export const magicianRole = new MagicianRole();
