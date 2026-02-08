/**
 * Night-1 Role Coverage Contract Test (PR8)
 *
 * 确保 NIGHT_STEPS 中每个 step 都有：
 * - 对应的 schema 定义
 * - 对应的 resolver 实现
 * - 非空的 audioKey
 *
 * 这个测试防止：
 * - 新增角色但忘记加 schema
 * - 新增 step 但忘记加 resolver
 * - audioKey 遗漏导致音频不播放
 */

import { NIGHT_STEPS, SCHEMAS } from '@/models/roles/spec';
import { RESOLVERS } from '@/services/night/resolvers';

describe('Night-1 Role Coverage Contract', () => {
  describe('NIGHT_STEPS completeness', () => {
    it('should have at least one step defined', () => {
      expect(NIGHT_STEPS.length).toBeGreaterThan(0);
    });

    it('should have unique step IDs', () => {
      const ids = NIGHT_STEPS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe.each(NIGHT_STEPS)('Step: $id (role: $roleId)', (step) => {
    it('should have corresponding schema in SCHEMAS', () => {
      const schema = SCHEMAS[step.id];
      expect(schema).toBeDefined();
      expect(schema.id).toBe(step.id);
    });

    it('should have corresponding resolver in RESOLVERS', () => {
      const resolver = RESOLVERS[step.id];
      expect(resolver).toBeDefined();
      expect(typeof resolver).toBe('function');
    });

    it('should have non-empty audioKey', () => {
      expect(step.audioKey).toBeTruthy();
      expect(typeof step.audioKey).toBe('string');
      expect(step.audioKey.length).toBeGreaterThan(0);
    });
  });

  describe('Schema-Resolver alignment', () => {
    it('every NIGHT_STEPS.id should be a valid SchemaId', () => {
      const schemaIds = Object.keys(SCHEMAS);
      for (const step of NIGHT_STEPS) {
        expect(schemaIds).toContain(step.id);
      }
    });

    it('every NIGHT_STEPS.id should have a resolver', () => {
      const resolverKeys = Object.keys(RESOLVERS);
      for (const step of NIGHT_STEPS) {
        expect(resolverKeys).toContain(step.id);
      }
    });
  });

  describe('Resolver invocability (smoke test)', () => {
    /**
     * 对每个 resolver 做 smoke 测试：确保调用不会 throw
     * 使用最小化的 context/input，只测试 resolver 存在且可调用
     */
    it.each(NIGHT_STEPS)('resolver for $id should be invocable without throwing', (step) => {
      const resolver = RESOLVERS[step.id];
      expect(resolver).toBeDefined();

      // 最小化的 context 和 input
      const minimalContext = {
        actorSeat: 0,
        actorRoleId: step.roleId,
        players: new Map([[0, step.roleId]]),
        currentNightResults: {},
        gameState: { isNight1: true },
      };

      const minimalInput = {
        schemaId: step.id,
        target: undefined,
      };

      // 调用 resolver 不应该 throw（可能返回 valid: false，但不应该抛异常）
      expect(() => {
        resolver!(minimalContext as any, minimalInput);
      }).not.toThrow();
    });
  });

  describe('Coverage summary', () => {
    it('should report coverage statistics', () => {
      const totalSteps = NIGHT_STEPS.length;
      const stepsWithSchema = NIGHT_STEPS.filter((s) => SCHEMAS[s.id]).length;
      const stepsWithResolver = NIGHT_STEPS.filter((s) => RESOLVERS[s.id]).length;
      const stepsWithAudio = NIGHT_STEPS.filter((s) => s.audioKey).length;

      // 100% 覆盖率要求
      expect(stepsWithSchema).toBe(totalSteps);
      expect(stepsWithResolver).toBe(totalSteps);
      expect(stepsWithAudio).toBe(totalSteps);
    });
  });
});
