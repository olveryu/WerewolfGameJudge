/**
 * Wolf Kill Neutral Judge Contract Test
 *
 * RED LINE: wolfKill must stay neutral - can target ANY seat.
 * This test exists to prevent anyone from accidentally adding restrictions to wolfKill.
 *
 * Wolf meeting vote restrictions are defined via flags.immuneToWolfKill in ROLE_SPECS.
 */

import { SCHEMAS } from '../../models/roles/spec/schemas';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import { getWolfKillImmuneRoleIds } from '../../models/roles';

describe('wolfKill Neutral Judge Contract', () => {
  it('wolfKill schema must NOT have forbiddenTargetRoleIds (RED LINE)', () => {
    const wolfKillSchema = SCHEMAS.wolfKill;

    // RED LINE: wolfKill must stay neutral - no forbidden targets
    expect(wolfKillSchema).not.toHaveProperty('forbiddenTargetRoleIds');

    // Also verify constraints is empty (neutral judge)
    expect(wolfKillSchema.constraints).toEqual([]);
  });

  it('immuneToWolfKill flag should be set on spiritKnight and wolfQueen', () => {
    // Meeting vote restrictions are defined via flags.immuneToWolfKill
    expect(ROLE_SPECS.spiritKnight.flags?.immuneToWolfKill).toBe(true);
    expect(ROLE_SPECS.wolfQueen.flags?.immuneToWolfKill).toBe(true);
  });

  it('getWolfKillImmuneRoleIds returns correct roles', () => {
    const immuneRoles = getWolfKillImmuneRoleIds();
    expect(immuneRoles).toContain('spiritKnight');
    expect(immuneRoles).toContain('wolfQueen');
    // Only these two should be immune
    expect(immuneRoles).toHaveLength(2);
  });

  it('immuneToWolfKill is a spec flag, not a schema constraint', () => {
    // wolfKill schema should not have any target restrictions
    expect(SCHEMAS.wolfKill.constraints).toEqual([]);

    // The restriction is on the role spec level, not schema level
    // This preserves "neutral judge" for wolfKill while restricting meeting vote
  });
});
