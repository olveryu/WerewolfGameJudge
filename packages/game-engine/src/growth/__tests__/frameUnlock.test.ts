import { FRAME_UNLOCK_CONDITIONS, getFrameUnlockCondition, isFrameUnlocked } from '../frameUnlock';

describe('frameUnlock', () => {
  describe('FRAME_UNLOCK_CONDITIONS', () => {
    it('has 10 conditions (one per frame)', () => {
      expect(FRAME_UNLOCK_CONDITIONS).toHaveLength(10);
    });

    it('all frameIds are unique', () => {
      const ids = FRAME_UNLOCK_CONDITIONS.map((c) => c.frameId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('getFrameUnlockCondition', () => {
    it('returns condition for known frame', () => {
      const condition = getFrameUnlockCondition('ironForge');
      expect(condition).toEqual({
        frameId: 'ironForge',
        type: 'register',
        value: 0,
        description: '注册即得',
      });
    });

    it('returns undefined for unknown frame', () => {
      expect(getFrameUnlockCondition('nonExistent')).toBeUndefined();
    });
  });

  describe('isFrameUnlocked', () => {
    it('register frame is always unlocked', () => {
      expect(isFrameUnlocked('ironForge', 0, 0)).toBe(true);
    });

    it('level frame is locked below required level', () => {
      expect(isFrameUnlocked('moonSilver', 1, 0)).toBe(false);
    });

    it('level frame is unlocked at required level', () => {
      expect(isFrameUnlocked('moonSilver', 2, 0)).toBe(true);
    });

    it('level frame is unlocked above required level', () => {
      expect(isFrameUnlocked('moonSilver', 10, 0)).toBe(true);
    });

    it('collection frame is locked below required count', () => {
      expect(isFrameUnlocked('boneGate', 0, 4)).toBe(false);
    });

    it('collection frame is unlocked at required count', () => {
      expect(isFrameUnlocked('boneGate', 0, 5)).toBe(true);
    });

    it('collection frame is unlocked above required count', () => {
      expect(isFrameUnlocked('boneGate', 0, 20)).toBe(true);
    });

    it('returns false for unknown frame', () => {
      expect(isFrameUnlocked('nonExistent', 20, 43)).toBe(false);
    });

    // Verify all level frames
    it.each([
      ['moonSilver', 2],
      ['darkVine', 5],
      ['frostCrystal', 10],
      ['pharaohGold', 15],
    ] as const)('level frame %s unlocks at Lv.%i', (frameId, level) => {
      expect(isFrameUnlocked(frameId, level - 1, 0)).toBe(false);
      expect(isFrameUnlocked(frameId, level, 0)).toBe(true);
    });

    // Verify all collection frames
    it.each([
      ['boneGate', 5],
      ['runicSeal', 10],
      ['bloodThorn', 20],
      ['hellFire', 30],
      ['voidRift', 40],
    ] as const)('collection frame %s unlocks at %i roles', (frameId, count) => {
      expect(isFrameUnlocked(frameId, 0, count - 1)).toBe(false);
      expect(isFrameUnlocked(frameId, 0, count)).toBe(true);
    });
  });
});
