/**
 * The controlled-seat banner gate lives in the shared factory, once:
 * while a takeover is active the banner always shows (the release entry
 * must never vanish); otherwise it shows only when the viewer can take
 * over and the room actually has bot seats. Games pass the two gate
 * inputs; none of them computes visibility itself.
 */
import { createControlledSeatModel } from '../createControlledSeatModel';

const release = jest.fn();

function model(input: {
  canControlBots: boolean;
  hasBots: boolean;
  controlledSeat: number | null;
}) {
  return createControlledSeatModel({
    ...input,
    controlledBotName: input.controlledSeat !== null ? '机器人甲' : null,
    release,
    gameName: 'Test',
  });
}

describe('createControlledSeatModel gate', () => {
  it('shows the controlled banner whenever a takeover is active', () => {
    for (const canControlBots of [true, false]) {
      for (const hasBots of [true, false]) {
        expect(model({ canControlBots, hasBots, controlledSeat: 2 })).toMatchObject({
          kind: 'controlled',
          seat: 2,
          displayName: '机器人甲',
        });
      }
    }
  });

  it('shows the hint only when the viewer can take over and bots exist', () => {
    expect(model({ canControlBots: true, hasBots: true, controlledSeat: null })).toEqual({
      kind: 'hint',
    });
    expect(model({ canControlBots: true, hasBots: false, controlledSeat: null })).toBeNull();
    expect(model({ canControlBots: false, hasBots: true, controlledSeat: null })).toBeNull();
    expect(model({ canControlBots: false, hasBots: false, controlledSeat: null })).toBeNull();
  });

  it('throws when a controlled seat has no display name', () => {
    expect(() =>
      createControlledSeatModel({
        canControlBots: true,
        hasBots: true,
        controlledSeat: 1,
        controlledBotName: null,
        release,
        gameName: 'Test',
      }),
    ).toThrow('Controlled Test bot seat 1 has no player');
  });
});
