/** Contract tests for game-neutral setup-room capability policy. */

import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomSetupCapabilitiesInput,
} from '../RoomCapabilities';

function createInput(
  overrides: Partial<RoomSetupCapabilitiesInput> = {},
): RoomSetupCapabilitiesInput {
  return {
    isSetup: true,
    isHost: true,
    supportsBots: true,
    mySeat: null,
    hasOccupiedSeats: true,
    isRoomFull: false,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    shareRoom: jest.fn(),
    ...overrides,
  };
}

describe('createRoomSetupCapabilities', () => {
  it('allows an unseated host to operate an occupied setup room', () => {
    const capabilities = createRoomSetupCapabilities(createInput());

    expect(capabilities.canTakeSeat.isAllowed).toBe(true);
    expect(capabilities.canMoveSeat.isAllowed).toBe(false);
    expect(capabilities.canLeaveSeat.isAllowed).toBe(false);
    expect(capabilities.canKickSeat.isAllowed).toBe(true);
    expect(capabilities.canClearSeats.isAllowed).toBe(true);
    expect(capabilities.canFillBots.isAllowed).toBe(true);
    expect(capabilities.canConfigureGame.isAllowed).toBe(true);
    expect(capabilities.canShareRoom.isAllowed).toBe(true);
  });

  it('keeps seated-player actions while hiding fill for a full room', () => {
    const capabilities = createRoomSetupCapabilities(createInput({ mySeat: 0, isRoomFull: true }));

    expect(capabilities.canTakeSeat.isAllowed).toBe(false);
    expect(capabilities.canMoveSeat.isAllowed).toBe(true);
    expect(capabilities.canLeaveSeat.isAllowed).toBe(true);
    expect(capabilities.canFillBots.isAllowed).toBe(false);
    expect(capabilities.canClearSeats.isAllowed).toBe(true);
  });

  it('keeps player and sharing actions independent of host authority', () => {
    const capabilities = createRoomSetupCapabilities(createInput({ isHost: false }));

    expect(capabilities.canTakeSeat.isAllowed).toBe(true);
    expect(capabilities.canKickSeat.isAllowed).toBe(false);
    expect(capabilities.canClearSeats.isAllowed).toBe(false);
    expect(capabilities.canFillBots.isAllowed).toBe(false);
    expect(capabilities.canConfigureGame.isAllowed).toBe(false);
    expect(capabilities.canShareRoom.isAllowed).toBe(true);
  });

  it('locks every setup mutation and room sharing outside setup', () => {
    const capabilities = createRoomSetupCapabilities(createInput({ isSetup: false, mySeat: 0 }));

    expect(capabilities.canTakeSeat.isAllowed).toBe(false);
    expect(capabilities.canMoveSeat.isAllowed).toBe(false);
    expect(capabilities.canLeaveSeat.isAllowed).toBe(false);
    expect(capabilities.canKickSeat.isAllowed).toBe(false);
    expect(capabilities.canClearSeats.isAllowed).toBe(false);
    expect(capabilities.canFillBots.isAllowed).toBe(false);
    expect(capabilities.canConfigureGame.isAllowed).toBe(false);
    expect(capabilities.canShareRoom.isAllowed).toBe(false);
  });
});

describe('createBotTakeoverCapability', () => {
  it('allows the host and routes execute to the given takeOver', () => {
    const takeOver = jest.fn();
    const capability = createBotTakeoverCapability(true, takeOver);
    expect(capability.isAllowed).toBe(true);
    if (capability.isAllowed) capability.execute(4);
    expect(takeOver).toHaveBeenCalledWith(4);
  });

  it('denies non-hosts with the shared reason', () => {
    const capability = createBotTakeoverCapability(false, jest.fn());
    expect(capability).toEqual({ isAllowed: false, reason: '只有房主可以接管机器人' });
  });
});
