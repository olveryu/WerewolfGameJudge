/**
 * Night-1 Role Coverage Contract Test (PR8)
 *
 * Ensures every step in NIGHT_STEPS has:
 * - a corresponding schema definition
 * - a corresponding resolver implementation
 * - a non-empty audioKey
 *
 * This test guards against:
 * - adding a role without a schema
 * - adding a step without a resolver
 * - missing audioKey causing audio to not play
 */

import { NIGHT_STEPS, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';
import { RESOLVERS } from '@werewolf/game-engine/resolvers';

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
     * Smoke-tests each resolver: ensures invocation does not throw
     * Uses minimal context/input; only verifies the resolver exists and is callable
     */
    it.each(NIGHT_STEPS)('resolver for $id should be invocable without throwing', (step) => {
      const resolver = RESOLVERS[step.id];
      expect(resolver).toBeDefined();

      // Minimal context and input
      const minimalContext = {
        actorSeat: 0,
        actorRoleId: step.roleId,
        players: new Map([[0, step.roleId]]),
        currentNightResults: {},
        witchState: { canSave: true, canPoison: true },
        gameState: { isNight1: true },
      };

      const minimalInput = {
        schemaId: step.id,
        target: undefined,
      };

      // Invoking the resolver should not throw (it may return valid: false, but must not throw)
      expect(() => {
        resolver!(
          minimalContext as unknown as import('@werewolf/game-engine/resolvers/types').ResolverContext,
          minimalInput,
        );
      }).not.toThrow();
    });
  });

  describe('Coverage summary', () => {
    it('should report coverage statistics', () => {
      const totalSteps = NIGHT_STEPS.length;
      const stepsWithSchema = NIGHT_STEPS.filter((s) => SCHEMAS[s.id]).length;
      const stepsWithResolver = NIGHT_STEPS.filter((s) => RESOLVERS[s.id]).length;
      const stepsWithAudio = NIGHT_STEPS.filter((s) => s.audioKey).length;

      // 100% coverage requirement
      expect(stepsWithSchema).toBe(totalSteps);
      expect(stepsWithResolver).toBe(totalSteps);
      expect(stepsWithAudio).toBe(totalSteps);
    });
  });
});
