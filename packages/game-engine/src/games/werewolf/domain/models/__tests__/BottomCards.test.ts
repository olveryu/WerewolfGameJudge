import {
  countBottomCardRoles,
  getBottomCardCount,
  getBottomCardRoleId,
  getValidBottomCardDeals,
  isValidBottomCardSet,
} from '../BottomCards';
import type { RoleId } from '../roles';

function sorted(roles: readonly RoleId[]): RoleId[] {
  return [...roles].sort((left, right) => left.localeCompare(right));
}

describe('BottomCards', () => {
  it('identifies the sole bottom-card actor and rejects ambiguous templates', () => {
    expect(countBottomCardRoles(['wolf', 'thief', 'seer'])).toBe(1);
    expect(getBottomCardRoleId(['wolf', 'thief', 'seer'])).toBe('thief');
    expect(getBottomCardRoleId(['wolf', 'seer'])).toBeNull();
    expect(() => getBottomCardRoleId(['thief', 'treasureMaster', 'seer'])).toThrow(
      'at most one bottom-card actor',
    );
    expect(() => getBottomCardCount(['thief', 'thief', 'seer'])).toThrow(
      'at most one bottom-card actor',
    );
  });

  it('enforces treasure-master deck composition exactly', () => {
    expect(isValidBottomCardSet(['wolf', 'seer', 'villager'], 'treasureMaster')).toBe(true);
    expect(isValidBottomCardSet(['wolfQueen', 'seer', 'villager'], 'treasureMaster')).toBe(false);
    expect(isValidBottomCardSet(['wolf', 'seer', 'witch'], 'treasureMaster')).toBe(false);
    expect(isValidBottomCardSet(['wolf', 'seer'], 'treasureMaster')).toBe(false);
  });

  it('enforces thief deck composition and excludes actor and cupid cards', () => {
    expect(isValidBottomCardSet(['wolf', 'seer'], 'thief')).toBe(true);
    expect(isValidBottomCardSet(['seer', 'villager'], 'thief')).toBe(true);
    expect(isValidBottomCardSet(['wolf', 'wolfQueen'], 'thief')).toBe(false);
    expect(isValidBottomCardSet(['thief', 'seer'], 'thief')).toBe(false);
    expect(isValidBottomCardSet(['cupid', 'seer'], 'thief')).toBe(false);
  });

  it('enumerates physical-card deals without losing duplicate-card weighting', () => {
    const roles: RoleId[] = ['thief', 'wolf', 'wolf', 'seer', 'villager'];
    const deals = getValidBottomCardDeals(roles, 'thief');

    expect(deals).toHaveLength(5);
    expect(
      deals.filter(
        ({ bottomCards }) => sorted(bottomCards).join(',') === sorted(['wolf', 'seer']).join(','),
      ),
    ).toHaveLength(2);

    for (const deal of deals) {
      expect(sorted([...deal.seatedRoles, ...deal.bottomCards])).toEqual(sorted(roles));
      expect(deal.bottomCards).not.toContain('thief');
      expect(isValidBottomCardSet(deal.bottomCards, 'thief')).toBe(true);
    }
  });

  it('returns no deal when no physical partition satisfies the actor rules', () => {
    expect(
      getValidBottomCardDeals(['treasureMaster', 'wolf', 'wolfQueen', 'seer'], 'treasureMaster'),
    ).toEqual([]);
  });
});
