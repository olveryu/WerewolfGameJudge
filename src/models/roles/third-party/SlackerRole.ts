/**
 * Slacker Role Model
 * 
 * On the first night, chooses a player as an idol.
 * Shares the same faction as the idol, but doesn't know the idol's identity.
 */

import { BaseRole, Faction } from '../base/BaseRole';

export class SlackerRole extends BaseRole {
  readonly id = 'slacker';
  readonly displayName = '混子';
  readonly faction = Faction.Special;
  readonly description = '第一晚选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份';
  readonly hasNightAction = true;
  readonly actionOrder = -1; // First to act on first night only
  readonly actionMessage = '请选择你的榜样';
  readonly actionConfirmMessage = '选择榜样';
}

export const slackerRole = new SlackerRole();
