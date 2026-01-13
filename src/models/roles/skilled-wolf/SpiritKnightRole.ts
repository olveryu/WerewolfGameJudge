/**
 * Spirit Knight Role Model
 * 
 * Permanently immune to night damage (cannot be killed by wolves, poison doesn't kill).
 * If checked by seer or poisoned by witch, the attacker dies the next day (reflect damage).
 * Cannot self-destruct, can only be voted out or shot by hunter.
 */

import { WolfBaseRole } from '../base/WolfBaseRole';

export class SpiritKnightRole extends WolfBaseRole {
  readonly id = 'spiritKnight';
  readonly displayName = '恶灵骑士';
  readonly description = '永久免疫夜间伤害（无法自刀、吃毒不死）。被预言家查验或女巫毒杀，则次日对方神职死亡（反伤）。不能自爆，只能被放逐或猎人枪杀';
  readonly hasNightAction = false;
  readonly actionOrder = 999;

  /**
   * SpiritKnight IS a meeting wolf in our rule set:
   * - Can see the wolf team at night
   * - Participates in the wolf vote/discussion
   */
  readonly canSeeWolves = true;
  readonly participatesInWolfVote = true;
}

export const spiritKnightRole = new SpiritKnightRole();
