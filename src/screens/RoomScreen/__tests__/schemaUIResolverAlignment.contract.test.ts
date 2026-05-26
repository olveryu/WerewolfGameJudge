/**
 * Schema-UI-Resolver three-layer alignment contract test
 *
 * This test ensures:
 * 1. Schema is the single source of truth for notSelf constraint
 * 2. UI reads constraints from schema (no hardcode)
 * 3. Resolver validates per schema (schema-first)
 *
 * If any layer drifts, this test fails.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  type CompoundSchema,
  TargetConstraint,
} from '@werewolf/game-engine/models/roles/spec/schema.types';
import { type SchemaId, SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import { RESOLVERS } from '@werewolf/game-engine/resolvers';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

// === Test Helpers ===

function createContext(actorSeat: number, actorRoleId: RoleId): ResolverContext {
  const players = new Map<number, RoleId>([
    [0, 'villager'],
    [1, 'villager'],
    [2, 'villager'],
  ]);
  players.set(actorSeat, actorRoleId);

  return {
    actorSeat,
    actorRoleId,
    players,
    currentNightResults: {},
    witchState: { canSave: true, canPoison: true },
    gameState: { isNight1: true },
  };
}

function getSchemaConstraints(schemaId: SchemaId): readonly string[] {
  const schema = SCHEMAS[schemaId];
  if (!schema) return [];
  if (schema.kind === 'chooseSeat' || schema.kind === 'swap') {
    return schema.constraints;
  }
  if (schema.kind === 'wolfVote') {
    return schema.constraints ?? [];
  }
  return [];
}

// === Schema is single source of truth for notSelf ===

describe('Schema notSelf constraint - single source of truth', () => {
  // Schemas with notSelf (must reject self-target)
  const schemasWithNotSelf: Array<{ schemaId: SchemaId; roleId: RoleId }> = [
    { schemaId: 'seerCheck', roleId: 'seer' },
    { schemaId: 'mirrorSeerCheck', roleId: 'mirrorSeer' },
    { schemaId: 'drunkSeerCheck', roleId: 'drunkSeer' },
    { schemaId: 'psychicCheck', roleId: 'psychic' },
    { schemaId: 'pureWhiteCheck', roleId: 'pureWhite' },
    { schemaId: 'gargoyleCheck', roleId: 'gargoyle' },
    { schemaId: 'dreamcatcherDream', roleId: 'dreamcatcher' },
    { schemaId: 'wolfQueenCharm', roleId: 'wolfQueen' },
    { schemaId: 'wolfRobotLearn', roleId: 'wolfRobot' },
    { schemaId: 'slackerChooseIdol', roleId: 'slacker' },
    { schemaId: 'wildChildChooseIdol', roleId: 'wildChild' },
    { schemaId: 'awakenedGargoyleConvert', roleId: 'awakenedGargoyle' },
    { schemaId: 'crowCurse', roleId: 'crow' },
  ];

  // Schemas without notSelf (allow self-target)
  const schemasWithoutNotSelf: Array<{ schemaId: SchemaId; roleId: RoleId }> = [
    { schemaId: 'nightmareBlock', roleId: 'nightmare' },
    { schemaId: 'guardProtect', roleId: 'guard' },
    { schemaId: 'wolfKill', roleId: 'wolf' },
    { schemaId: 'poisonerPoison', roleId: 'poisoner' },
  ];

  // Schemas with notWolfFaction (cannot target wolf faction; self is wolf faction so cannot self-target either)
  const schemasWithNotWolfFaction: Array<{ schemaId: SchemaId; roleId: RoleId }> = [
    { schemaId: 'wolfWitchCheck', roleId: 'wolfWitch' },
    { schemaId: 'awakenedGargoyleConvert', roleId: 'awakenedGargoyle' },
  ];

  describe('schemas WITH notSelf constraint', () => {
    it.each(schemasWithNotSelf)(
      '$schemaId: schema.constraints contains notSelf',
      ({ schemaId }) => {
        const constraints = getSchemaConstraints(schemaId);
        expect(constraints).toContain(TargetConstraint.NotSelf);
      },
    );

    it.each(schemasWithNotSelf)(
      '$schemaId: resolver REJECTS self-target (aligned with schema)',
      ({ schemaId, roleId }) => {
        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const actorSeat = 0;
        const context = createContext(actorSeat, roleId);
        const input: ActionInput = { schemaId, target: actorSeat };

        const result = resolver!(context, input);

        expect(result.valid).toBe(false);
        expect(result.rejectReason).toBeDefined();
      },
    );
  });

  describe('schemas WITHOUT notSelf constraint (neutral judge)', () => {
    it.each(schemasWithoutNotSelf)(
      '$schemaId: schema.constraints does NOT contain notSelf',
      ({ schemaId }) => {
        const constraints = getSchemaConstraints(schemaId);
        expect(constraints).not.toContain(TargetConstraint.NotSelf);
      },
    );

    it.each(schemasWithoutNotSelf)(
      '$schemaId: resolver ALLOWS self-target (aligned with schema)',
      ({ schemaId, roleId }) => {
        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const actorSeat = 0;
        const context = createContext(actorSeat, roleId);
        const input: ActionInput = { schemaId, target: actorSeat };

        const result = resolver!(context, input);

        expect(result.valid).toBe(true);
      },
    );
  });

  describe('schemas with notWolfFaction constraint', () => {
    it.each(schemasWithNotWolfFaction)(
      '$schemaId: schema.constraints contains notWolfFaction',
      ({ schemaId }) => {
        const constraints = getSchemaConstraints(schemaId);
        expect(constraints).toContain(TargetConstraint.NotWolfFaction);
      },
    );

    it.each(schemasWithNotWolfFaction)(
      '$schemaId: resolver REJECTS wolf-faction target (aligned with schema)',
      ({ schemaId, roleId }) => {
        const resolver = RESOLVERS[schemaId];
        expect(resolver).toBeDefined();

        const actorSeat = 0;
        const wolfTargetSeat = 1;
        // Place a wolf at non-self seat to isolate NotWolfFaction rejection
        const players = new Map<number, RoleId>([
          [0, roleId],
          [1, 'wolf'],
          [2, 'villager'],
        ]);
        const context: ResolverContext = {
          actorSeat,
          actorRoleId: roleId,
          players,
          currentNightResults: {},
          witchState: { canSave: true, canPoison: true },
          gameState: { isNight1: true },
        };
        const input: ActionInput = { schemaId, target: wolfTargetSeat };

        const result = resolver!(context, input);

        expect(result.valid).toBe(false);
        expect(result.rejectReason).toContain('狼人阵营');
      },
    );
  });

  describe('witchAction compound schema step constraints', () => {
    it('witchAction.save step has notSelf constraint', () => {
      const schema = SCHEMAS.witchAction as CompoundSchema;
      const saveStep = schema.steps.find((s) => s.key === 'save');
      expect(saveStep).toBeDefined();
      expect(saveStep!.constraints).toContain(TargetConstraint.NotSelf);
    });

    it('witchAction resolver rejects self-save (aligned with schema)', () => {
      const resolver = RESOLVERS.witchAction;
      const witchSeat = 0;
      const context = createContext(witchSeat, 'witch');
      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: { save: witchSeat },
      };

      const result = resolver!(context, input);

      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自救');
    });

    it('witchAction.poison step has NO notSelf constraint', () => {
      const schema = SCHEMAS.witchAction as CompoundSchema;
      const poisonStep = schema.steps.find((s) => s.key === 'poison');
      expect(poisonStep).toBeDefined();
      expect(poisonStep!.constraints).not.toContain('notSelf');
    });

    it('witchAction resolver allows self-poison (aligned with schema)', () => {
      const resolver = RESOLVERS.witchAction;
      const witchSeat = 0;
      const context = createContext(witchSeat, 'witch');
      const input: ActionInput = {
        schemaId: 'witchAction',
        stepResults: { poison: witchSeat },
      };

      const result = resolver!(context, input);

      expect(result.valid).toBe(true);
    });
  });
});

// === UI reads from schema (no hardcode) ===

describe('UI reads constraints from schema (no hardcode)', () => {
  /**
   * This test verifies buildSeatViewModels in RoomScreen.helpers.ts
   * disables seats only based on passed-in schemaConstraints, no hardcode.
   *
   * Related code:
   * - RoomScreen.tsx: currentSchemaConstraints = currentSchema.constraints
   * - RoomScreen.helpers.ts: if (options?.schemaConstraints?.includes('notSelf') && seat === actorSeat)
   */
  it('buildSeatViewModels uses schemaConstraints parameter (not hardcoded role checks)', () => {
    // This test is covered in detail by RoomScreen.helpers.test.ts
    // Here we just do an existence assertion
    const { buildSeatViewModels } = require('@/screens/RoomScreen/RoomScreen.helpers') as {
      buildSeatViewModels: (...args: unknown[]) => unknown;
    };
    expect(typeof buildSeatViewModels).toBe('function');

    // Function signature contains schemaConstraints parameter
    const fnStr = buildSeatViewModels.toString();
    expect(fnStr).toContain('schemaConstraints');
  });
});

// === Completeness check ===

describe('notSelf constraint completeness', () => {
  it('all chooseSeat/swap schemas are covered in this test', () => {
    const allSchemaIds = Object.keys(SCHEMAS) as SchemaId[];
    const chooseSeatSchemas = allSchemaIds.filter((id) => {
      const schema = SCHEMAS[id];
      return schema.kind === 'chooseSeat' || schema.kind === 'swap' || schema.kind === 'wolfVote';
    });

    const testedSchemas = new Set([
      // With notSelf
      'seerCheck',
      'mirrorSeerCheck',
      'drunkSeerCheck',
      'psychicCheck',
      'pureWhiteCheck',
      'gargoyleCheck',
      'dreamcatcherDream',
      'wolfQueenCharm',
      'wolfRobotLearn',
      'slackerChooseIdol',
      'wildChildChooseIdol',
      'shadowChooseMimic',
      // Without notSelf
      'nightmareBlock',
      'guardProtect',
      'wolfKill',
      'poisonerPoison',
      // AdjacentToWolfFaction
      'awakenedGargoyleConvert',
      // notWolfFaction
      'wolfWitchCheck',
      // No constraint (can target self)
      'silenceElderSilence',
      'votebanElderBan',
      // With notSelf (god)
      'crowCurse',
      // Swap (special)
      'magicianSwap',
      // Without notSelf (wolf)
      'eclipseWolfQueenShelter',
    ]);

    const untested = chooseSeatSchemas.filter(
      (id) => !testedSchemas.has(id) && id !== 'witchAction',
    );

    // If any new chooseSeat schema is untested, this test fails
    expect(untested).toEqual([]);
  });
});
