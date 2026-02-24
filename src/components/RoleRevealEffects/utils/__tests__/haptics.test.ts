/**
 * haptics.test - Tests for haptic feedback utility
 *
 * Exercises guard logic (enabled flag, canUseHaptics check) and
 * the silent failure path when dynamic import fails.
 * NOTE: Jest CommonJS mode doesn't support dynamic import(),
 * so loadHaptics always hits the catch path — switch cases
 * are unreachable in unit tests.
 */

// Need to mock platform before importing
jest.mock('../platform', () => ({
  canUseHaptics: jest.fn(() => true),
  isIOS: true,
  isAndroid: false,
  isWeb: false,
}));

// Explicit mock so require('expo-haptics') resolves when needed
jest.mock('expo-haptics');

import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { canUseHaptics } from '@/components/RoleRevealEffects/utils/platform';

describe('triggerHaptic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (canUseHaptics as jest.Mock).mockReturnValue(true);
  });

  it('should do nothing when enabled=false', async () => {
    await expect(triggerHaptic('light', false)).resolves.toBeUndefined();
  });

  it('should do nothing when canUseHaptics returns false', async () => {
    (canUseHaptics as jest.Mock).mockReturnValue(false);
    await expect(triggerHaptic('medium')).resolves.toBeUndefined();
  });

  it('should silently handle dynamic import failure in loadHaptics', async () => {
    // Dynamic import('expo-haptics') fails in Jest CommonJS mode.
    // triggerHaptic's try-catch handles this gracefully.
    await expect(triggerHaptic('light')).resolves.toBeUndefined();
  });

  it('should handle all style values without throwing', async () => {
    // All styles hit the same import-failure path but exercise the function entry
    const styles = [
      'light',
      'medium',
      'heavy',
      'selection',
      'success',
      'warning',
      'error',
    ] as const;
    for (const style of styles) {
      await expect(triggerHaptic(style)).resolves.toBeUndefined();
    }
  });
});
