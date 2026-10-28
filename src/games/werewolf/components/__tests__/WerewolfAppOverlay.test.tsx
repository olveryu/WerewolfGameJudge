import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, WEREWOLF_STATE_VERSION } from '@game-judge/game-engine/games/werewolf/public';
import { render } from '@testing-library/react-native';

import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LinkSnapshot, RoomIdentity } from '@/platform/realtime/types';
import { idleLinkSnapshot, readyLinkSnapshot } from '@/test-utils/linkSnapshot';

import { WerewolfAppOverlay } from '../WerewolfAppOverlay';

const mockUseRoomSessionSnapshot = jest.fn<LinkSnapshot<GameState>, [unknown]>();
const mockAIChatBubble = jest.fn<
  void,
  [{ readonly triggerPulse: boolean; readonly identity: RoomIdentity }]
>();

jest.mock('@/features/room/controllers/useRoomLinkSnapshot', () => ({
  useRoomLinkSnapshot: (session: unknown) => mockUseRoomSessionSnapshot(session),
}));

jest.mock('@/games/werewolf/components/AIChatBubble', () => ({
  AIChatBubble: ({
    triggerPulse,
    identity,
  }: {
    readonly triggerPulse: boolean;
    readonly identity: RoomIdentity;
  }) => {
    mockAIChatBubble({ triggerPulse, identity });
    return null;
  },
}));

const client = { roomSession: {} } as unknown as WerewolfGameClient;

function readySnapshot(status: GameStatus): LinkSnapshot<GameState> {
  return readyLinkSnapshot<GameState>(
    {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'host',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
      },
      userId: 'host',
    },
    {
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      revision: 1,
      state: { status } as GameState,
    },
  );
}

describe('WerewolfAppOverlay', () => {
  beforeEach(() => {
    mockAIChatBubble.mockClear();
  });

  it('does not mount Werewolf UI without an active Werewolf room session', () => {
    mockUseRoomSessionSnapshot.mockReturnValue(idleLinkSnapshot<GameState>());

    render(<WerewolfAppOverlay client={client} />);

    expect(mockAIChatBubble).not.toHaveBeenCalled();
  });

  it.each([
    [GameStatus.Seated, false],
    [GameStatus.Ongoing, true],
  ])('mounts for a ready Werewolf room with pulse=%s', (status, triggerPulse) => {
    mockUseRoomSessionSnapshot.mockReturnValue(readySnapshot(status));

    render(<WerewolfAppOverlay client={client} />);

    const props = mockAIChatBubble.mock.calls[0]?.[0];
    if (props === undefined) throw new Error('AI chat bubble was not rendered');
    expect(props.triggerPulse).toBe(triggerPulse);
    expect(props.identity.userId).toBe('host');
  });
});
