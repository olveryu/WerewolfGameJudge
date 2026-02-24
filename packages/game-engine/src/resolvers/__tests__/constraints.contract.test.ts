/**
 * Schema Constraints Contract Tests
 *
 * Ensures resolver behavior is aligned with schema constraints.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { TargetConstraint } from '@werewolf/game-engine/models/roles/spec/schema.types';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import { validateConstraints } from '@werewolf/game-engine/resolvers/constraintValidator';

describe('constraintValidator', () => {
  describe('notSelf constraint', () => {
    it('should reject self-target when notSelf is in constraints', () => {
      const result = validateConstraints([TargetConstraint.NotSelf], { actorSeat: 2, target: 2 });
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自己');
    });

    it('should allow other targets when notSelf is in constraints', () => {
      const result = validateConstraints([TargetConstraint.NotSelf], { actorSeat: 2, target: 3 });
      expect(result.valid).toBe(true);
    });

    it('should allow self-target when notSelf is NOT in constraints', () => {
      const result = validateConstraints([], { actorSeat: 2, target: 2 });
      expect(result.valid).toBe(true);
    });
  });

  describe('notWolfFaction constraint', () => {
    const players = new Map<number, RoleId>([
      [0, 'villager'],
      [1, 'seer'],
      [2, 'wolf'],
      [3, 'wolfKing'],
      [4, 'wolfWitch'],
    ]);

    it('should reject wolf-faction target', () => {
      const result = validateConstraints([TargetConstraint.NotWolfFaction], {
        actorSeat: 4,
        target: 2,
        players,
      });
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('should reject wolfKing target (wolf faction)', () => {
      const result = validateConstraints([TargetConstraint.NotWolfFaction], {
        actorSeat: 4,
        target: 3,
        players,
      });
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('狼人阵营');
    });

    it('should allow non-wolf-faction target', () => {
      const result = validateConstraints([TargetConstraint.NotWolfFaction], {
        actorSeat: 4,
        target: 0,
        players,
      });
      expect(result.valid).toBe(true);
    });

    it('should throw if players map is missing', () => {
      expect(() => {
        validateConstraints([TargetConstraint.NotWolfFaction], { actorSeat: 4, target: 0 });
      }).toThrow('notWolfFaction constraint requires players map');
    });
  });
});

describe('schema-resolver constraint alignment', () => {
  // These tests ensure schema constraints match resolver behavior

  describe('schemas with notSelf constraint', () => {
    const schemasWithNotSelf = [
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
    ] as const;

    it.each(schemasWithNotSelf)('%s schema should have notSelf constraint', (schemaId) => {
      const schema = SCHEMAS[schemaId];
      expect(schema.constraints).toContain(TargetConstraint.NotSelf);
    });
  });

  describe('schemas without notSelf constraint (neutral judge - can target self)', () => {
    const schemasWithoutNotSelf = [
      'nightmareBlock', // 梦魇可以封自己
      'wolfKill', // 狼可以杀自己
      'guardProtect', // 守卫可以守自己
    ] as const;

    it.each(schemasWithoutNotSelf)('%s schema should NOT have notSelf constraint', (schemaId) => {
      const schema = SCHEMAS[schemaId];
      expect(schema.constraints).not.toContain(TargetConstraint.NotSelf);
    });
  });

  describe('schemas with notWolfFaction constraint', () => {
    const schemasWithNotWolfFaction = ['wolfWitchCheck'] as const;

    it.each(schemasWithNotWolfFaction)(
      '%s schema should have notWolfFaction constraint',
      (schemaId) => {
        const schema = SCHEMAS[schemaId];
        expect(schema.constraints).toContain(TargetConstraint.NotWolfFaction);
      },
    );
  });

  describe('witch compound schema step constraints', () => {
    it('witch save step should have notSelf constraint', () => {
      const witchSchema = SCHEMAS.witchAction;
      expect(witchSchema.kind).toBe('compound');
      const saveStep = witchSchema.steps.find((s) => s.key === 'save');
      expect(saveStep).toBeDefined();
      expect(saveStep!.constraints).toContain(TargetConstraint.NotSelf);
    });

    it('witch poison step should NOT have notSelf constraint', () => {
      const witchSchema = SCHEMAS.witchAction;
      const poisonStep = witchSchema.steps.find((s) => s.key === 'poison');
      expect(poisonStep).toBeDefined();
      expect(poisonStep!.constraints).not.toContain(TargetConstraint.NotSelf);
    });
  });
});
