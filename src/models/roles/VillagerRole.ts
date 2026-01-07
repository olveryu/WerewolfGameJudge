/**
 * Villager Role Model
 * 
 * Basic villager with no special abilities.
 * Wins with the village team through discussion and voting.
 */

import { BaseRole, Faction } from './BaseRole';

export class VillagerRole extends BaseRole {
  readonly id = 'villager';
  readonly displayName = '普通村民';
  readonly faction = Faction.Villager;
  readonly description = '没有特殊能力，依靠推理和投票帮助好人阵营获胜';
  readonly hasNightAction = false;
  readonly actionOrder = 999; // No night action
}

export const villagerRole = new VillagerRole();
