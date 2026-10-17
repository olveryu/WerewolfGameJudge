/**
 * Night step table contract: the step definitions (domain/nightSteps)
 * and the step order (state/types AVALON_NIGHT_STEPS) are pinned to
 * each other — the Record type already forces exhaustiveness at
 * compile time; this test pins the runtime key sets equal so an
 * assertion-cast extra key cannot drift the two apart, and pins each
 * definition's narration and participant derivation basics.
 */

import {
  AVALON_NIGHT_STEP_DEFS,
  getAvalonNightStepDef,
  getAvalonNightStepEndKey,
} from '../domain/nightSteps';
import { getAvalonNightParticipants } from '../domain/rules';
import { AVALON_NIGHT_STEPS, type AvalonRoleId } from '../state/types';

describe('Avalon night step definitions', () => {
  it('covers exactly the ordered step list, no more and no less', () => {
    expect(Object.keys(AVALON_NIGHT_STEP_DEFS).sort()).toEqual([...AVALON_NIGHT_STEPS].sort());
    for (const step of AVALON_NIGHT_STEPS) {
      expect(getAvalonNightStepDef(step).step).toBe(step);
    }
  });

  it('gives every step a non-empty narration key whose end key falls back to it', () => {
    for (const step of AVALON_NIGHT_STEPS) {
      const def = getAvalonNightStepDef(step);
      expect(def.audioKey.length).toBeGreaterThan(0);
      expect(getAvalonNightStepEndKey(def)).toBe(def.audioEndKey ?? def.audioKey);
    }
  });

  it('derives participants through the facade identically to the table', () => {
    // 7-player board layout: evil = morgana + assassin + oberon.
    const roles: Record<number, AvalonRoleId> = {
      0: 'merlin',
      1: 'percival',
      2: 'loyalServant',
      3: 'loyalServant',
      4: 'morgana',
      5: 'assassin',
      6: 'oberon',
    };
    for (const step of AVALON_NIGHT_STEPS) {
      expect(getAvalonNightParticipants(roles, step)).toEqual(
        getAvalonNightStepDef(step).participants(roles),
      );
    }
    // Oberon never participates in evilReveal (closed eyes all night).
    expect(getAvalonNightParticipants(roles, 'evilReveal')).toEqual([4, 5]);
    expect(getAvalonNightParticipants(roles, 'merlinReveal')).toEqual([0]);
    expect(getAvalonNightParticipants(roles, 'percivalReveal')).toEqual([1]);
  });
});
