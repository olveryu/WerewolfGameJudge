import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import {
  domainRejectedRoomCommand,
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';

const state = testRoomState('werewolf');
const roomCommandFailureCases: ReadonlyArray<
  readonly [string, RoomCommandDispatchOutcome<typeof state>, string]
> = [
  [
    'committed domain rejection',
    domainRejectedRoomCommand(state, 'domain-rejected'),
    'domain-rejected',
  ],
  [
    'pre-commit rejection',
    rejectedRoomCommand<typeof state>('pre-commit-rejected'),
    'pre-commit-rejected',
  ],
  [
    'known non-delivery',
    {
      kind: 'notDecided',
      commandId: 'not-decided-command',
      reason: 'not-decided',
    },
    'not-decided',
  ],
  [
    'unknown delivery',
    {
      kind: 'deliveryUnknown',
      commandId: 'delivery-unknown-command',
      reason: 'delivery-unknown',
    },
    'delivery-unknown',
  ],
];

describe('room command result readers', () => {
  it('recognizes only an authoritative committed success', () => {
    const result = successfulRoomCommand(state, 'successful-command');

    expect(isSuccessfulRoomCommand(result)).toBe(true);
    expect(() => getRoomCommandFailureReason(result)).toThrow(
      '[FAIL-FAST] Successful room command has no failure reason',
    );
  });

  it.each(roomCommandFailureCases)(
    'preserves the exact reason for %s',
    (_label, result, expectedReason) => {
      expect(isSuccessfulRoomCommand(result)).toBe(false);
      expect(getRoomCommandFailureReason(result)).toBe(expectedReason);
    },
  );
});
