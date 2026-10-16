/**
 * The controlled-seat banner model lives in the shared factory, once:
 * the banner reports an active takeover only. While the host controls a
 * bot seat the model exists (the release entry must never vanish); with
 * no active takeover the factory returns null and no banner renders.
 */
import { createControlledSeatModel } from '../createControlledSeatModel';

const release = jest.fn();

describe('createControlledSeatModel', () => {
  it('builds the banner model for an active takeover', () => {
    expect(
      createControlledSeatModel({
        controlledSeat: 2,
        controlledBotName: '机器人甲',
        release,
        gameName: 'Test',
      }),
    ).toEqual({ seat: 2, displayName: '机器人甲', onRelease: release });
  });

  it('returns null when no seat is being controlled', () => {
    expect(
      createControlledSeatModel({
        controlledSeat: null,
        controlledBotName: null,
        release,
        gameName: 'Test',
      }),
    ).toBeNull();
  });

  it('throws when a controlled seat has no display name', () => {
    expect(() =>
      createControlledSeatModel({
        controlledSeat: 1,
        controlledBotName: null,
        release,
        gameName: 'Test',
      }),
    ).toThrow('Controlled Test bot seat 1 has no player');
  });
});
