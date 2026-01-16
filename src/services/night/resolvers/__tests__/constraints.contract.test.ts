/**
 * Schema Constraints Contract Tests
 * 
 * Ensures resolver behavior is aligned with schema constraints.
 */

import { SCHEMAS } from '../../../../models/roles/spec/schemas';
import { validateConstraints } from '../constraintValidator';

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
      'seerCheck',
      'psychicCheck',
      'gargoyleCheck',
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
  
  describe('schemas without notSelf constraint (neutral judge)', () => {
    const schemasWithoutNotSelf = [
      'nightmareBlock',  // 梦魇可以封自己（neutral judge rule）
      'wolfKill',        // 狼可以杀自己（neutral judge rule）
      'guardProtect',    // 守卫可以守自己（但被其他规则限制）
    ] as const;
    
    it.each(schemasWithoutNotSelf)('%s schema should NOT have notSelf constraint', (schemaId) => {
      const schema = SCHEMAS[schemaId];
      expect(schema.constraints).not.toContain('notSelf');
    });
  });
  
  describe('witch compound schema step constraints', () => {
    it('witch save step should have notSelf constraint', () => {
  const saveSchema = SCHEMAS.witchSave;
  expect(saveSchema.constraints).toContain('notSelf');
    });
    
    it('witch poison step should NOT have notSelf constraint', () => {
  const poisonSchema = SCHEMAS.witchPoison;
  expect(poisonSchema.constraints).not.toContain('notSelf');
    });
  });
});
