/**
 * Schema Constraints Contract Tests
 *
 * Ensures resolver behavior is aligned with schema constraints.
 */

import { SCHEMAS } from '@/models/roles/spec/schemas';
import { validateConstraints } from '@/services/night/resolvers/constraintValidator';

describe('constraintValidator', () => {
  describe('notSelf constraint', () => {
    it('should reject self-target when notSelf is in constraints', () => {
      const result = validateConstraints(['notSelf'], { actorSeat: 2, target: 2 });
      expect(result.valid).toBe(false);
      expect(result.rejectReason).toContain('自己');
    });

    it('should allow other targets when notSelf is in constraints', () => {
      const result = validateConstraints(['notSelf'], { actorSeat: 2, target: 3 });
      expect(result.valid).toBe(true);
    });

    it('should allow self-target when notSelf is NOT in constraints', () => {
      const result = validateConstraints([], { actorSeat: 2, target: 2 });
      expect(result.valid).toBe(true);
    });
  });
});

describe('schema-resolver constraint alignment', () => {
  // These tests ensure schema constraints match resolver behavior

  describe('schemas with notSelf constraint', () => {
    const schemasWithNotSelf = [
      'dreamcatcherDream',
      'wolfQueenCharm',
      'wolfRobotLearn',
      'slackerChooseIdol',
    ] as const;

    it.each(schemasWithNotSelf)('%s schema should have notSelf constraint', (schemaId) => {
      const schema = SCHEMAS[schemaId];
      expect(schema.constraints).toContain('notSelf');
    });
  });

  describe('schemas without notSelf constraint (neutral judge - can target self)', () => {
    const schemasWithoutNotSelf = [
      'seerCheck', // 预言家可以查自己
      'psychicCheck', // 通灵师可以通灵自己
      'gargoyleCheck', // 石像鬼可以查自己
      'nightmareBlock', // 梦魇可以封自己
      'wolfKill', // 狼可以杀自己
      'guardProtect', // 守卫可以守自己
    ] as const;

    it.each(schemasWithoutNotSelf)('%s schema should NOT have notSelf constraint', (schemaId) => {
      const schema = SCHEMAS[schemaId];
      expect(schema.constraints).not.toContain('notSelf');
    });
  });

  describe('witch compound schema step constraints', () => {
    it('witch save step should have notSelf constraint', () => {
      const witchSchema = SCHEMAS.witchAction;
      expect(witchSchema.kind).toBe('compound');
      const saveStep = witchSchema.steps.find((s) => s.key === 'save');
      expect(saveStep).toBeDefined();
      expect(saveStep!.constraints).toContain('notSelf');
    });

    it('witch poison step should NOT have notSelf constraint', () => {
      const witchSchema = SCHEMAS.witchAction;
      const poisonStep = witchSchema.steps.find((s) => s.key === 'poison');
      expect(poisonStep).toBeDefined();
      expect(poisonStep!.constraints).not.toContain('notSelf');
    });
  });
});
