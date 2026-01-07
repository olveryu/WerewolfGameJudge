/**
 * Idiot Role Model
 * 
 * When voted out, can flip card to survive.
 * After flipping, cannot vote or use skills.
 * 
 * Note: Day voting is not implemented yet (only first night is supported).
 */

import { GodBaseRole } from './GodBaseRole';

export class IdiotRole extends GodBaseRole {
  readonly id = 'idiot';
  readonly displayName = '白痴';
  readonly description = '被投票放逐时可以翻牌免死，但之后不能投票和发动技能';
  readonly hasNightAction = false;
  readonly actionOrder = 999;
}

export const idiotRole = new IdiotRole();
