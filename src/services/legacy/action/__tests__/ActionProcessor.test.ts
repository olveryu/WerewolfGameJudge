/**
 * ActionProcessor unit tests
 *
 * Tests for night action processing, resolver integration,
 * and death calculation.
 */

import { ActionProcessor, type ActionContext } from '../ActionProcessor';
import { RoleId } from '../../../../models/roles';
import {
  makeActionTarget,
  makeActionWitch,
  makeWitchPoison,
  makeWitchSave,
} from '../../../../models/actions';

describe('ActionProcessor', () => {
  let processor: ActionProcessor;

  beforeEach(() => {
    processor = new ActionProcessor();
  });

  // ===========================================================================
  // buildActionInput
  // ===========================================================================
  describe('buildActionInput', () => {
    it('should build chooseSeat input with target', () => {
      const input = processor.buildActionInput('seerCheck', 3, undefined);
      expect(input).toEqual({ schemaId: 'seerCheck', target: 3 });
    });

    it('should build chooseSeat input with null target as undefined', () => {
      const input = processor.buildActionInput('seerCheck', null, undefined);
      expect(input).toEqual({ schemaId: 'seerCheck', target: undefined });
    });

    it('should build wolfKill input', () => {
      const input = processor.buildActionInput('wolfKill', 5, undefined);
      expect(input).toEqual({ schemaId: 'wolfKill', target: 5 });
    });

    it('should build compound input for witch save', () => {
      const input = processor.buildActionInput('witchAction', 2, { save: true });
      expect(input).toEqual({ schemaId: 'witchAction', stepResults: { save: 2 } });
    });

    it('should build compound input for witch poison', () => {
      const input = processor.buildActionInput('witchAction', 4, { poison: true });
      expect(input).toEqual({ schemaId: 'witchAction', stepResults: { poison: 4 } });
    });

    it('should build compound input for witch skip', () => {
      const input = processor.buildActionInput('witchAction', null, {});
      expect(input).toEqual({ schemaId: 'witchAction', stepResults: {} });
    });

    it('should build swap input for magician', () => {
      // Encoded: firstSeat=2, secondSeat=5 → 2 + 5*100 = 502
      const input = processor.buildActionInput('magicianSwap', 502, undefined);
      expect(input).toEqual({ schemaId: 'magicianSwap', targets: [2, 5] });
    });

    it('should build confirm input', () => {
      const input = processor.buildActionInput('hunterConfirm', null, undefined);
      expect(input).toEqual({ schemaId: 'hunterConfirm', confirmed: true });
    });

    it('should return base input for unknown schema', () => {
      // @ts-expect-error Testing unknown schema
      const input = processor.buildActionInput('unknownSchema', 1, undefined);
      expect(input).toEqual({ schemaId: 'unknownSchema' });
    });
  });

  // ===========================================================================
  // buildRoleAction
  // ===========================================================================
  describe('buildRoleAction', () => {
    it('should return null for null target', () => {
      const action = processor.buildRoleAction('seer', null);
      expect(action).toBeNull();
    });

    it('should build target action for seer', () => {
      const action = processor.buildRoleAction('seer', 3);
      expect(action).toEqual(makeActionTarget(3));
    });

    it('should build target action for guard', () => {
      const action = processor.buildRoleAction('guard', 5);
      expect(action).toEqual(makeActionTarget(5));
    });

    it('should build witch poison action', () => {
      const action = processor.buildRoleAction('witch', 4, { poison: true });
      expect(action).toEqual(makeActionWitch(makeWitchPoison(4)));
    });

    it('should build witch save action', () => {
      const action = processor.buildRoleAction('witch', 2, { save: true });
      expect(action).toEqual(makeActionWitch(makeWitchSave(2)));
    });

    it('should return null for witch with invalid extra', () => {
      const action = processor.buildRoleAction('witch', 2, {});
      expect(action).toBeNull();
    });

    it('should return null for witch with null extra', () => {
      const action = processor.buildRoleAction('witch', 2, null);
      expect(action).toBeNull();
    });

    it('should build magician swap action', () => {
      // Encoded: firstSeat=3, secondSeat=7 → 3 + 7*100 = 703
      const action = processor.buildRoleAction('magician', 703);
      expect(action).toEqual({
        kind: 'magicianSwap',
        firstSeat: 3,
        secondSeat: 7,
      });
    });

    it('should return null for magician with invalid encoding (< 100)', () => {
      const action = processor.buildRoleAction('magician', 50);
      expect(action).toBeNull();
    });

    it('should return null for magician with out-of-range seats', () => {
      // Encoded: firstSeat=15, secondSeat=20 → 15 + 20*100 = 2015
      const action = processor.buildRoleAction('magician', 2015);
      expect(action).toBeNull();
    });
  });

  // ===========================================================================
  // invokeResolver
  // ===========================================================================
  describe('invokeResolver', () => {
    const baseContext: ActionContext = {
      players: new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolf'],
        [2, 'seer'],
        [3, 'witch'],
        [4, 'guard'],
        [5, 'villager'],
      ]),
      currentNightResults: {},
      actions: new Map(),
      wolfVotes: new Map(),
    };

    it('should return valid for schema without resolver', () => {
      const result = processor.invokeResolver(
        'hunterConfirm',
        5,
        'hunter',
        { schemaId: 'hunterConfirm', confirmed: true },
        baseContext,
      );
      expect(result.valid).toBe(true);
    });

    it('should invoke seer resolver and return check result', () => {
      const result = processor.invokeResolver(
        'seerCheck',
        2,
        'seer',
        { schemaId: 'seerCheck', target: 1 }, // Check seat 1 (wolf)
        baseContext,
      );
      expect(result.valid).toBe(true);
      expect(result.result?.checkResult).toBe('狼人');
    });

    it('should allow seer self-check (notSelf not in schema)', () => {
      // Note: seerCheck schema does NOT have notSelf constraint,
      // so self-check is allowed by the resolver
      const result = processor.invokeResolver(
        'seerCheck',
        2,
        'seer',
        { schemaId: 'seerCheck', target: 2 }, // Self-check
        baseContext,
      );
      expect(result.valid).toBe(true);
    });

    it('should validate guard target', () => {
      const result = processor.invokeResolver(
        'guardProtect',
        4,
        'guard',
        { schemaId: 'guardProtect', target: 0 },
        baseContext,
      );
      expect(result.valid).toBe(true);
    });

    it('should validate nightmare block', () => {
      const result = processor.invokeResolver(
        'nightmareBlock',
        3,
        'nightmare',
        { schemaId: 'nightmareBlock', target: 2 },
        baseContext,
      );
      expect(result.valid).toBe(true);
      expect(result.updates?.blockedSeat).toBe(2);
    });
  });

  // ===========================================================================
  // processAction
  // ===========================================================================
  describe('processAction', () => {
    const baseContext: ActionContext = {
      players: new Map<number, RoleId>([
        [0, 'villager'],
        [1, 'wolf'],
        [2, 'seer'],
        [3, 'witch'],
        [4, 'guard'],
        [5, 'psychic'],
      ]),
      currentNightResults: {},
      witchContext: { canSave: true, canPoison: true },
      actions: new Map(),
      wolfVotes: new Map(),
    };

    it('should process seer check and return reveal', () => {
      const result = processor.processAction(
        'seerCheck',
        2, // seer seat
        'seer',
        1, // target wolf
        undefined,
        baseContext,
      );

      expect(result.valid).toBe(true);
      expect(result.reveal?.type).toBe('seer');
      expect(result.reveal?.targetSeat).toBe(1);
      expect(result.reveal?.result).toBe('狼人'); // Chinese display
      expect(result.actionToRecord).toEqual(makeActionTarget(1));
    });

    it('should process guard protect', () => {
      const result = processor.processAction(
        'guardProtect',
        4, // guard seat
        'guard',
        0, // protect villager
        undefined,
        baseContext,
      );

      expect(result.valid).toBe(true);
      expect(result.actionToRecord).toEqual(makeActionTarget(0));
    });

    it('should allow seer self-check (notSelf not in schema)', () => {
      // Note: seerCheck schema does NOT have notSelf constraint
      const result = processor.processAction(
        'seerCheck',
        2, // seer seat
        'seer',
        2, // target self
        undefined,
        baseContext,
      );

      expect(result.valid).toBe(true);
    });

    it('should process psychic check and return reveal', () => {
      const result = processor.processAction(
        'psychicCheck',
        5, // psychic seat
        'psychic',
        3, // target witch
        undefined,
        baseContext,
      );

      expect(result.valid).toBe(true);
      expect(result.reveal?.type).toBe('psychic');
      expect(result.reveal?.result).toBe('女巫');
    });
  });

  // ===========================================================================
  // buildNightActions
  // ===========================================================================
  describe('buildNightActions', () => {
    it('should build empty night actions from empty map', () => {
      const actions = new Map();
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions).toEqual({});
    });

    it('should build night actions with wolf kill', () => {
      const actions = new Map([['wolf', makeActionTarget(3)]]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.wolfKill).toBe(3);
    });

    it('should build night actions with guard protect', () => {
      const actions = new Map([['guard', makeActionTarget(2)]]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.guardProtect).toBe(2);
    });

    it('should build night actions with witch save', () => {
      const actions = new Map([['witch', makeActionWitch(makeWitchSave(3))]]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.witchAction?.kind).toBe('save');
    });

    it('should build night actions with witch poison', () => {
      const actions = new Map([['witch', makeActionWitch(makeWitchPoison(5))]]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.witchAction?.kind).toBe('poison');
    });

    it('should build night actions with magician swap', () => {
      const actions = new Map([
        ['magician', { kind: 'magicianSwap' as const, firstSeat: 1, secondSeat: 4 }],
      ]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.magicianSwap).toEqual({ first: 1, second: 4 });
    });

    it('should build complete night actions', () => {
      const actions = new Map<string, ReturnType<typeof makeActionTarget>>([
        ['wolf', makeActionTarget(3)],
        ['guard', makeActionTarget(2)],
        ['seer', makeActionTarget(1)],
      ]);
      const nightActions = processor.buildNightActions(actions);
      expect(nightActions.wolfKill).toBe(3);
      expect(nightActions.guardProtect).toBe(2);
      expect(nightActions.seerCheck).toBe(1);
    });
  });

  // ===========================================================================
  // calculateDeaths
  // ===========================================================================
  describe('calculateDeaths', () => {
    const baseRoleSeatMap = {
      witcher: -1,
      wolfQueen: -1,
      dreamcatcher: -1,
      spiritKnight: -1,
      seer: 2,
      witch: 3,
      guard: 4,
    };

    it('should return empty array when no kills', () => {
      const deaths = processor.calculateDeaths({
        actions: new Map(),
        roleSeatMap: baseRoleSeatMap,
      });
      expect(deaths).toEqual([]);
    });

    it('should calculate wolf kill death', () => {
      const actions = new Map([['wolf', makeActionTarget(5)]]);
      const deaths = processor.calculateDeaths({
        actions,
        roleSeatMap: baseRoleSeatMap,
      });
      expect(deaths).toContain(5);
    });

    it('should not kill when guard protects wolf target', () => {
      const actions = new Map([
        ['wolf', makeActionTarget(5)],
        ['guard', makeActionTarget(5)],
      ]);
      const deaths = processor.calculateDeaths({
        actions,
        roleSeatMap: baseRoleSeatMap,
      });
      expect(deaths).not.toContain(5);
    });

    it('should calculate witch poison death', () => {
      const actions = new Map([['witch', makeActionWitch(makeWitchPoison(6))]]);
      const deaths = processor.calculateDeaths({
        actions,
        roleSeatMap: baseRoleSeatMap,
      });
      expect(deaths).toContain(6);
    });

    it('should save wolf victim with witch save', () => {
      const actions = new Map<string, ReturnType<typeof makeActionTarget | typeof makeActionWitch>>(
        [
          ['wolf', makeActionTarget(5)],
          ['witch', makeActionWitch(makeWitchSave(5))],
        ],
      );
      const deaths = processor.calculateDeaths({
        actions,
        roleSeatMap: baseRoleSeatMap,
      });
      expect(deaths).not.toContain(5);
    });
  });

  // ===========================================================================
  // Wolf Vote Processing
  // ===========================================================================
  describe('validateWolfVote', () => {
    const context: ActionContext = {
      players: new Map<number, RoleId>([
        [0, 'wolf'],
        [1, 'wolf'],
        [2, 'villager'],
      ]),
      currentNightResults: {},
      actions: new Map(),
      wolfVotes: new Map(),
    };

    it('should validate valid target', () => {
      const result = processor.validateWolfVote(2, context);
      expect(result.valid).toBe(true);
    });

    it('should reject out-of-range target', () => {
      const result = processor.validateWolfVote(99, context);
      expect(result.valid).toBe(false);
    });
  });

  describe('resolveWolfVotes', () => {
    it('should return target when unanimous', () => {
      const votes = new Map([
        [0, 3],
        [1, 3],
      ]);
      const result = processor.resolveWolfVotes(votes);
      expect(result).toBe(3);
    });

    it('should return majority target', () => {
      const votes = new Map([
        [0, 3],
        [1, 3],
        [2, 5],
      ]);
      const result = processor.resolveWolfVotes(votes);
      expect(result).toBe(3);
    });

    it('should return null for tie', () => {
      const votes = new Map([
        [0, 3],
        [1, 5],
      ]);
      const result = processor.resolveWolfVotes(votes);
      expect(result).toBeNull();
    });

    it('should return null for all abstain', () => {
      const votes = new Map([
        [0, -1],
        [1, -1],
      ]);
      const result = processor.resolveWolfVotes(votes);
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // isRevealRole
  // ===========================================================================
  describe('isRevealRole', () => {
    it('should return true for seer', () => {
      expect(processor.isRevealRole('seer')).toBe(true);
    });

    it('should return true for psychic', () => {
      expect(processor.isRevealRole('psychic')).toBe(true);
    });

    it('should return true for gargoyle', () => {
      expect(processor.isRevealRole('gargoyle')).toBe(true);
    });

    it('should return true for wolfRobot', () => {
      expect(processor.isRevealRole('wolfRobot')).toBe(true);
    });

    it('should return false for guard', () => {
      expect(processor.isRevealRole('guard')).toBe(false);
    });

    it('should return false for witch', () => {
      expect(processor.isRevealRole('witch')).toBe(false);
    });

    it('should return false for wolf', () => {
      expect(processor.isRevealRole('wolf')).toBe(false);
    });
  });
});
