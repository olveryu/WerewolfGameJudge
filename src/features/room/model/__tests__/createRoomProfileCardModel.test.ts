import type { RoomProfileSelection } from '../../controllers/useRoomProfileController';
import { createRoomProfileCardModel } from '../createRoomProfileCardModel';
import type { RoomCapabilities } from '../RoomCapabilities';

const OTHER: RoomProfileSelection = {
  target: { seat: 2, userId: 'guest', rosterName: '客人', occupantKind: 'human' },
  isSelf: false,
};
const SELF: RoomProfileSelection = {
  target: { seat: 0, userId: 'me', rosterName: '我', occupantKind: 'human' },
  isSelf: true,
};

function makeCapabilities(kickAllowed: boolean, leaveAllowed: boolean) {
  const kick = jest.fn();
  const capabilities: Pick<RoomCapabilities, 'canKickSeat' | 'canLeaveSeat'> = {
    canKickSeat: kickAllowed
      ? { isAllowed: true, execute: kick }
      : { isAllowed: false, reason: '只有房主可以移出玩家' },
    canLeaveSeat: leaveAllowed
      ? { isAllowed: true, execute: jest.fn() }
      : { isAllowed: false, reason: '当前阶段不能离座' },
  };
  return { capabilities, kick };
}

const onClose = () => undefined;
const onLeaveSeat = () => undefined;

describe('createRoomProfileCardModel', () => {
  it('returns null when no profile is open', () => {
    const { capabilities } = makeCapabilities(true, true);
    expect(
      createRoomProfileCardModel({ selection: null, capabilities, onClose, onLeaveSeat }),
    ).toBeNull();
  });

  it('exposes kick (executing the target seat) for another player when allowed', () => {
    const { capabilities, kick } = makeCapabilities(true, true);
    const model = createRoomProfileCardModel({
      selection: OTHER,
      capabilities,
      onClose,
      onLeaveSeat,
    });
    expect(model?.isSelf).toBe(false);
    expect(model?.onLeaveSeat).toBeNull();
    model?.onKick?.();
    expect(kick).toHaveBeenCalledWith(2);
  });

  it('hides kick for another player when the capability denies it', () => {
    const { capabilities } = makeCapabilities(false, true);
    const model = createRoomProfileCardModel({
      selection: OTHER,
      capabilities,
      onClose,
      onLeaveSeat,
    });
    expect(model?.onKick).toBeNull();
  });

  it('exposes leave (and never kick) for the viewer when allowed', () => {
    const { capabilities } = makeCapabilities(true, true);
    const model = createRoomProfileCardModel({
      selection: SELF,
      capabilities,
      onClose,
      onLeaveSeat,
    });
    expect(model?.onKick).toBeNull();
    expect(model?.onLeaveSeat).toBe(onLeaveSeat);
  });

  it('hides leave for the viewer when the capability denies it', () => {
    const { capabilities } = makeCapabilities(true, false);
    const model = createRoomProfileCardModel({
      selection: SELF,
      capabilities,
      onClose,
      onLeaveSeat,
    });
    expect(model?.onLeaveSeat).toBeNull();
  });

  it('passes gameDetails through and defaults it to null', () => {
    const { capabilities } = makeCapabilities(true, true);
    const withDetails = createRoomProfileCardModel({
      selection: SELF,
      capabilities,
      onClose,
      onLeaveSeat,
      gameDetails: { title: '阵营分布', statsUserId: 'me' },
    });
    expect(withDetails?.gameDetails).toEqual({ title: '阵营分布', statsUserId: 'me' });
    const without = createRoomProfileCardModel({
      selection: SELF,
      capabilities,
      onClose,
      onLeaveSeat,
    });
    expect(without?.gameDetails).toBeNull();
    expect(without?.onClose).toBe(onClose);
    expect(without?.target).toBe(SELF.target);
  });
});
