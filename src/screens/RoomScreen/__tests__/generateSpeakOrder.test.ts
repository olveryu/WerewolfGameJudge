/**
 * Tests for generateSpeakOrder
 */

import { type Rng } from '@werewolf/game-engine/utils/random';

import { generateSpeakOrder } from '@/screens/RoomScreen/useRoomHostDialogs';

describe('generateSpeakOrder', () => {
  it('should return seat 1 when rng returns 0', () => {
    const fixedRng: Rng = () => 0;
    const result = generateSpeakOrder(12, fixedRng);

    expect(result.startSeat).toBe(1);
    expect(result.direction).toBe('顺时针'); // randomBool(0) = true = 顺时针
  });

  it('should return max seat when rng returns close to 1', () => {
    const fixedRng: Rng = () => 0.9999;
    const result = generateSpeakOrder(12, fixedRng);

    expect(result.startSeat).toBe(12);
    expect(result.direction).toBe('逆时针'); // randomBool(0.9999) = false = 逆时针
  });

  it('should return 顺时针 when rng < 0.5', () => {
    const fixedRng: Rng = () => 0.3;
    const result = generateSpeakOrder(10, fixedRng);

    expect(result.direction).toBe('顺时针');
  });

  it('should return 逆时针 when rng >= 0.5', () => {
    const fixedRng: Rng = () => 0.5;
    const result = generateSpeakOrder(10, fixedRng);

    expect(result.direction).toBe('逆时针');
  });

  it('should produce valid results with default rng', () => {
    for (let i = 0; i < 50; i++) {
      const result = generateSpeakOrder(12);

      expect(result.startSeat).toBeGreaterThanOrEqual(1);
      expect(result.startSeat).toBeLessThanOrEqual(12);
      expect(['顺时针', '逆时针']).toContain(result.direction);
    }
  });

  it('should handle single player edge case', () => {
    const result = generateSpeakOrder(1);

    expect(result.startSeat).toBe(1);
    expect(['顺时针', '逆时针']).toContain(result.direction);
  });
});
