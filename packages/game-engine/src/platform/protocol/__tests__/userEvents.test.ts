import { createUserEventAckMessage, parseUserEventAckMessage } from '../userEvents';

describe('durable user event acknowledgements', () => {
  it('creates and parses the strict acknowledgement shape', () => {
    const acknowledgement = createUserEventAckMessage('event-1');

    expect(acknowledgement).toEqual({ type: 'USER_EVENT_ACK', eventId: 'event-1' });
    expect(parseUserEventAckMessage(acknowledgement)).toEqual(acknowledgement);
  });

  it('rejects empty IDs and additional fields', () => {
    expect(() => createUserEventAckMessage('')).toThrow('must be non-empty');
    expect(() =>
      parseUserEventAckMessage({ type: 'USER_EVENT_ACK', eventId: 'event-1', roomCode: 'ROOM' }),
    ).toThrow('unsupported fields');
  });
});
