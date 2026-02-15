/**
 * Contract test: Witch schema-driven behavior in useRoomActions
 *
 * This test locks the schema-driven design for witch compound action:
 * - save step: kind='confirmTarget' (fixed target from WITCH_CONTEXT, user confirms)
 * - poison step: kind='chooseSeat' (user selects target by tapping seat)
 *
 * @see docs/architecture/schema-kinds.md
 */

import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';

describe('useRoomActions witch schema contract', () => {
  describe('witchAction schema structure', () => {
    it('should be a compound schema with exactly 2 steps', () => {
      expect(SCHEMAS.witchAction.kind).toBe('compound');
      expect(SCHEMAS.witchAction.steps).toHaveLength(2);
    });

    it('save step should be confirmTarget kind (fixed target, user confirms)', () => {
      const saveStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'save');
      expect(saveStep).toBeDefined();
      expect(saveStep!.kind).toBe('confirmTarget');
      // confirmTarget means: target is pre-determined (WITCH_CONTEXT.killedSeat)
      // user only confirms whether to use the antidote on that fixed target
    });

    it('poison step should be chooseSeat kind (user selects target)', () => {
      const poisonStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'poison');
      expect(poisonStep).toBeDefined();
      expect(poisonStep!.kind).toBe('chooseSeat');
      // chooseSeat means: user taps a seat to select target
    });

    it('save step should have canSkip=true', () => {
      const saveStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'save');
      expect(saveStep!.canSkip).toBe(true);
    });

    it('poison step should have canSkip=true', () => {
      const poisonStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'poison');
      expect(poisonStep!.canSkip).toBe(true);
    });

    it('save step should have notSelf constraint (witch cannot save self)', () => {
      const saveStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'save');
      expect(saveStep!.constraints).toContain('notSelf');
    });

    it('poison step should have no constraints (witch can poison anyone)', () => {
      const poisonStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'poison');
      expect(poisonStep!.constraints).toEqual([]);
    });
  });

  describe('schema UI fields', () => {
    it('save step should have required UI fields for bottom button', () => {
      const saveStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'save');
      expect(saveStep!.ui).toBeDefined();
      expect(saveStep!.ui!.confirmText).toBeDefined();
      expect(saveStep!.ui!.bottomActionText).toBeDefined();
    });

    it('poison step should have required UI fields for seat tap confirm', () => {
      const poisonStep = SCHEMAS.witchAction.steps.find((s) => s.key === 'poison');
      expect(poisonStep!.ui).toBeDefined();
      expect(poisonStep!.ui!.confirmText).toBeDefined();
      expect(poisonStep!.ui!.bottomActionText).toBeDefined();
    });
  });
});
