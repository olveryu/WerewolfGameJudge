import { createWerewolfRoleContext, WEREWOLF_PRESENCE_DECLARATIONS } from '..';
import {
  getActiveRoleIds,
  getSeatIdentity,
  grantBorrowedAbility,
  type IdentityLayer,
  replaceCurrentRole,
} from '../identity';
import { resolveSelectedSeat, resolveTargetSelection } from '../location';
import { resolveNightPresenceFacts } from '../presence';
import { getSeenRole } from '../sight';
import { thiefPresence } from '../thief';

type TestRole =
  | 'seer'
  | 'mirrorSeer'
  | 'drunkSeer'
  | 'wolf'
  | 'hunter'
  | 'thief'
  | 'treasureMaster'
  | 'poisoner'
  | 'cupid';

function createIdentities(): IdentityLayer<TestRole> {
  return {
    0: { dealtRole: 'thief', currentRole: 'thief', borrowedAbilityRole: null },
    1: { dealtRole: 'treasureMaster', currentRole: 'treasureMaster', borrowedAbilityRole: null },
    2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
  };
}

describe('werewolf night context layers', () => {
  it('updates lasting identity separately from a borrowed ability', () => {
    const identities = createIdentities();
    const changedIdentity = replaceCurrentRole(identities, 0, 'wolf');
    const withBorrowedAbility = grantBorrowedAbility(identities, 1, 'hunter');

    expect(getSeatIdentity(changedIdentity, 0)).toEqual({
      dealtRole: 'thief',
      currentRole: 'wolf',
      borrowedAbilityRole: null,
    });
    expect(getActiveRoleIds(getSeatIdentity(withBorrowedAbility, 1))).toEqual([
      'treasureMaster',
      'hunter',
    ]);
    expect(getSeatIdentity(identities, 0).currentRole).toBe('thief');
    expect(() => getSeatIdentity(identities, 9)).toThrow('[FAIL-FAST] Missing identity');
  });

  it('routes each selected seat through one shared swap mapping', () => {
    const location = { swap: { first: 1, second: 6 } };

    expect(resolveSelectedSeat(1, location)).toBe(6);
    expect(resolveTargetSelection(1, location)).toEqual({ chosenSeat: 1, landingSeat: 6 });
    expect(resolveSelectedSeat(4, { swap: null })).toBe(4);
  });

  it('reads an override from sight without changing the actual identity', () => {
    const identities = createIdentities();
    const sight = { roleOverridesBySeat: { 2: 'wolf' } } satisfies {
      readonly roleOverridesBySeat: Readonly<Record<string, TestRole>>;
    };

    expect(getSeenRole(identities, sight, 2)).toBe('wolf');
    expect(getSeatIdentity(identities, 2).currentRole).toBe('seer');
  });

  it('exposes identity, target landing, and sight through the role context', () => {
    const context = createWerewolfRoleContext(
      createIdentities(),
      { swap: { first: 1, second: 2 } },
      { roleOverridesBySeat: { 1: 'wolf' } },
    );

    expect(context.roleOf(1)).toBe('treasureMaster');
    expect(context.landing(1)).toBe(2);
    expect(context.seenRole(1)).toBe('wolf');
  });

  it('derives global night facts from role presence declarations', () => {
    const facts = resolveNightPresenceFacts(
      ['poisoner', 'cupid', 'thief', 'seer', 'mirrorSeer', 'drunkSeer'],
      WEREWOLF_PRESENCE_DECLARATIONS,
    );

    expect(facts).toEqual({
      firstNightWolfAttackDisabledBy: 'poisoner',
      doesWolfVoteRequireUnanimity: true,
      bottomCardDecks: [{ role: 'thief', deck: thiefPresence[0].effect.deck }],
      numberedAnnouncementRoles: { seerFamily: ['seer', 'mirrorSeer', 'drunkSeer'] },
    });
    expect(
      resolveNightPresenceFacts(['wolf'], WEREWOLF_PRESENCE_DECLARATIONS)
        .firstNightWolfAttackDisabledBy,
    ).toBeNull();
  });
});
