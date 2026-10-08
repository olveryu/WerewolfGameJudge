/**
 * Contract tests for executeProfileKick.
 *
 * Verifies the shared kick behavior (aligned to Werewolf):
 * - null selection → throws
 * - capability denied → throws with reason
 * - capability allowed → executes with target seat
 */

import { executeProfileKick } from '../executeProfileKick';

describe('executeProfileKick', () => {
  it('throws when selection is null', () => {
    const capabilities = {
      canKickSeat: { isAllowed: true as const, execute: jest.fn() },
    };
    expect(() => executeProfileKick(capabilities, null)).toThrow(
      'Cannot kick without an open profile',
    );
  });

  it('throws with reason when capability is denied', () => {
    const capabilities = {
      canKickSeat: { isAllowed: false as const, reason: 'not_host' },
    };
    const selection = { target: { seat: 2 } };
    expect(() => executeProfileKick(capabilities, selection)).toThrow(
      'Cannot kick from profile: not_host',
    );
  });

  it('executes with target seat when allowed', () => {
    const execute = jest.fn();
    const capabilities = {
      canKickSeat: { isAllowed: true as const, execute },
    };
    const selection = { target: { seat: 3 } };
    executeProfileKick(capabilities, selection);
    expect(execute).toHaveBeenCalledWith(3);
  });
});
