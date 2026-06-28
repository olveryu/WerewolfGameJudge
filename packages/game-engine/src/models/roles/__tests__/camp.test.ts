/**
 * getRoleCamp contract tests — camp bucket mapping derived from Faction.
 */

import {
  CAMP_ORDER,
  type CampBucket,
  getAllRoleIds,
  getRoleCamp,
  getRoleSpec,
} from '@werewolf/game-engine/models/roles';
import { Faction } from '@werewolf/game-engine/models/roles/spec/types';

describe('getRoleCamp', () => {
  it('maps every role to a valid camp bucket', () => {
    for (const id of getAllRoleIds()) {
      expect(CAMP_ORDER).toContain(getRoleCamp(id));
    }
  });

  it('derives camp purely from Faction', () => {
    const factionToCamp: Record<Faction, CampBucket> = {
      [Faction.Wolf]: 'wolf',
      [Faction.God]: 'god',
      [Faction.Villager]: 'villager',
      [Faction.Special]: 'third',
    };
    for (const id of getAllRoleIds()) {
      expect(getRoleCamp(id)).toBe(factionToCamp[getRoleSpec(id).faction]);
    }
  });

  it('classifies representative roles correctly', () => {
    expect(getRoleCamp('wolf')).toBe('wolf');
    expect(getRoleCamp('hiddenWolf')).toBe('wolf'); // wolf faction, good team → still wolf
    expect(getRoleCamp('seer')).toBe('god');
    expect(getRoleCamp('villager')).toBe('villager');
    expect(getRoleCamp('thief')).toBe('third'); // special faction, good team → third
    expect(getRoleCamp('cupid')).toBe('third');
    expect(getRoleCamp('slacker')).toBe('third');
  });
});
