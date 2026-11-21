import { describe, expect, it } from 'vitest';

import {
  COMMAND_IN_FLIGHT_REASON,
  resolveCommandActionState,
  type RoomActionState,
} from '../RoomAction';

describe('resolveCommandActionState', () => {
  const ready: RoomActionState = { kind: 'ready', onPress: () => undefined };

  it('preserves the idle state when no command is submitting', () => {
    expect(
      resolveCommandActionState({
        key: 'start',
        isSubmitting: false,
        pendingActionKey: null,
        whenIdle: ready,
      }),
    ).toBe(ready);
  });

  it('marks only the submitted action busy and blocks a different action with the shared reason', () => {
    const submission = {
      isSubmitting: true,
      pendingActionKey: 'start',
      whenIdle: ready,
    } as const;

    expect(resolveCommandActionState({ ...submission, key: 'start' })).toEqual({
      kind: 'busy',
    });
    expect(resolveCommandActionState({ ...submission, key: 'restart' })).toEqual({
      kind: 'blocked',
      reason: COMMAND_IN_FLIGHT_REASON,
    });
  });
});
