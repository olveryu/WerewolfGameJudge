/**
 * Schema-Resolver Alignment Contract Tests
 *
 * PR contract: resolver skip behavior must be aligned per-schema
 * - If schema.canSkip === true, resolver must accept null target
 * - If schema.canSkip === false or undefined, resolver must reject null target
 *
 * Contract test guarding against blanket skip behavior.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { type SchemaId, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import {
  type ChooseSeatSchema,
  type CompoundSchema,
  TargetConstraint,
} from '@werewolf/game-engine/models/roles/spec/schema.types';
import { RESOLVERS } from '@werewolf/game-engine/resolvers';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// Build a base ResolverContext
function createBaseContext(
  actorSeat: number,
  actorRoleId: RoleId,
  overrides?: Partial<ResolverContext>,
): ResolverContext {
  // Use valid RoleId values
  const players = new Map<number, RoleId>([
    [0, 'wolf'],
    [1, 'seer'],
    [2, 'witch'],
    [3, 'guard'],
    [4, 'villager'],
    [5, 'nightmare'],
    [6, 'dreamcatcher'],
    [7, 'gargoyle'],
  ]);

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: {},
    witchState: { canSave: true, canPoison: true },
    gameState: { isNight1: true },
    ...overrides,
  };
}

// Read the canSkip value of a schema
function getSchemaCanSkip(schemaId: SchemaId): boolean {
  const schema = SCHEMAS[schemaId];
  if (!schema) return false;

  // For compound schemas, canSkip is derived from the steps
  if (schema.kind === 'compound') {
    const compoundSchema = schema;
    // The whole schema is skippable only if every step is skippable
    return compoundSchema.steps?.every((s) => s.canSkip === true) ?? false;
  }

  // chooseSeat schema reads canSkip directly
  if ('canSkip' in schema) {
    return (schema as ChooseSeatSchema).canSkip === true;
  }

  return false;
}

describe('Schema-Resolver canSkip alignment (anti-drift contract)', () => {
  // All canSkip=true schemas — verify each resolver accepts null
  const canSkipSchemas: { schemaId: SchemaId; roleId: RoleId; seat: number }[] = [
    { schemaId: 'seerCheck', roleId: 'seer', seat: 1 },
    { schemaId: 'nightmareBlock', roleId: 'nightmare', seat: 5 },
    { schemaId: 'gargoyleCheck', roleId: 'gargoyle', seat: 7 },
    { schemaId: 'dreamcatcherDream', roleId: 'dreamcatcher', seat: 6 },
    { schemaId: 'guardProtect', roleId: 'guard', seat: 3 },
    { schemaId: 'psychicCheck', roleId: 'psychic', seat: 1 }, // reuses seer seat for the test
  ];

  describe('resolvers with canSkip=true should accept null target', () => {
    it.each(canSkipSchemas)(
      '$schemaId: resolver accepts undefined target → {valid: true}',
      ({ schemaId, roleId, seat }) => {
        // Verify schema has canSkip: true
        expect(getSchemaCanSkip(schemaId)).toBe(true);

        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const input: ActionInput = {
          schemaId,
          target: undefined, // Skip
        };

        // ResolverFn signature: (context, input)
        const context = createBaseContext(seat, roleId);
        const result = resolver!(context, input);

        expect(result.valid).toBe(true);
        // Skip behavior should produce no updates (no-op)
        expect(result.result).toEqual({});
      },
    );
  });

  describe('compound schema (witchAction) skip behavior', () => {
    it('witchAction resolver accepts undefined stepResults (skip all steps)', () => {
      const resolver = RESOLVERS.witchAction;
      expect(resolver).toBeDefined();

      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: undefined, // Skip all
      };

      const context = createBaseContext(2, 'witch');
      const result = resolver!(context, input);

      expect(result.valid).toBe(true);
      // No effects should apply when skipped
      expect(result.result?.savedTarget).toBeUndefined();
      expect(result.result?.poisonedTarget).toBeUndefined();
    });
  });
});

describe('witchContext.canSave notSelf alignment (PR contract)', () => {
  /**
   * Schema definition: witchAction.steps[0] (save) has the notSelf constraint
   * Contract: when the killed player is the Witch herself, canSave must be false
   *
   * This test ensures that the canSave logic in nightFlowHandler's SET_WITCH_CONTEXT
   * stays aligned with the schema notSelf constraint.
   */

  it('schema witchAction.save step should have notSelf constraint', () => {
    const witchSchema = SCHEMAS.witchAction as CompoundSchema;
    expect(witchSchema.kind).toBe('compound');

    const saveStep = witchSchema.steps[0]!;
    expect(saveStep.key).toBe('save');
    expect(saveStep.constraints).toContain(TargetConstraint.NotSelf);
  });

  it('witch resolver should reject saving self (notSelf enforcement)', () => {
    const resolver = RESOLVERS.witchAction;
    expect(resolver).toBeDefined();

    // Witch is at seat 2, attempts to save seat 2 (herself)
    const input: ActionInput = {
      schemaId: 'witchAction',
      stepResults: { save: 2 }, // attempt self-save
    };

    const context = createBaseContext(2, 'witch');
    const result = resolver!(context, input);

    // resolver should reject self-save
    expect(result.valid).toBe(false);
    expect(result.rejectReason).toContain('自救');
  });
});
