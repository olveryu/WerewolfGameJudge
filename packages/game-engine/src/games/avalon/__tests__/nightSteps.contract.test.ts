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
  getAvalonNightStepBeginAudioKey,
  getAvalonNightStepDef,
  getAvalonNightStepEndAudioKey,
} from '../domain/nightSteps';
import { getAvalonNightParticipants } from '../domain/rules';
import {
  AVALON_BOARDS,
  AVALON_NIGHT_STEPS,
  AVALON_PLAYER_COUNTS,
  type AvalonNightStep,
  type AvalonPlayerCount,
  type AvalonRoleId,
} from '../state/types';

function rolesForBoard(count: AvalonPlayerCount): Record<number, AvalonRoleId> {
  const roles: Record<number, AvalonRoleId> = {};
  AVALON_BOARDS[count].forEach((role, seat) => {
    roles[seat] = role;
  });
  return roles;
}

describe('Avalon night step definitions', () => {
  it('covers exactly the ordered step list, no more and no less', () => {
    expect(Object.keys(AVALON_NIGHT_STEP_DEFS).sort()).toEqual([...AVALON_NIGHT_STEPS].sort());
    for (const step of AVALON_NIGHT_STEPS) {
      expect(getAvalonNightStepDef(step).step).toBe(step);
    }
  });

  it('pins each step narration key per board to literal values', () => {
    // The evilReveal opening names Oberon only on the two boards that
    // deal him (7 and 10); every other board hears the plain opening.
    // The closing line is the same on every board. Both keys are pinned
    // as literals here so a step-table edit cannot silently re-voice a
    // step, and the board matrix proves no board is left on the old
    // unconditional wording.
    const evilRevealBegin: Record<AvalonPlayerCount, string> = {
      5: 'evil_reveal',
      6: 'evil_reveal',
      7: 'evil_reveal_except_oberon',
      8: 'evil_reveal',
      9: 'evil_reveal',
      10: 'evil_reveal_except_oberon',
    };
    const expected: Record<AvalonNightStep, { beginKey: string; endKey: string }> = {
      evilReveal: { beginKey: 'evil_reveal', endKey: 'evil_reveal' },
      merlinReveal: { beginKey: 'merlin_reveal', endKey: 'merlin_reveal' },
      percivalReveal: { beginKey: 'percival_reveal', endKey: 'percival_reveal' },
    };
    for (const count of AVALON_PLAYER_COUNTS) {
      const roles = rolesForBoard(count);
      for (const step of AVALON_NIGHT_STEPS) {
        const beginKey = step === 'evilReveal' ? evilRevealBegin[count] : expected[step].beginKey;
        expect(getAvalonNightStepBeginAudioKey(step, roles)).toBe(beginKey);
        expect(getAvalonNightStepEndAudioKey(step, roles)).toBe(expected[step].endKey);
      }
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
