import { render } from '@testing-library/react-native';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type { RoomSessionSnapshot } from '@/features/room/session/types';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

import { WerewolfAppOverlay } from '../WerewolfAppOverlay';

const mockUseRoomSessionSnapshot = jest.fn<RoomSessionSnapshot<GameState>, [unknown]>();
const mockAIChatBubble = jest.fn<void, [{ readonly triggerPulse: boolean }]>();

jest.mock('@/features/room/controllers/useRoomSessionSnapshot', () => ({
  useRoomSessionSnapshot: (session: unknown) => mockUseRoomSessionSnapshot(session),
}));

jest.mock('@/games/werewolf/components/AIChatBubble', () => ({
  AIChatBubble: ({ triggerPulse }: { readonly triggerPulse: boolean }) => {
    mockAIChatBubble({ triggerPulse });
    return null;
  },
}));

const client = { roomSession: {} } as unknown as WerewolfGameClient;

function readySnapshot(status: GameStatus): RoomSessionSnapshot<GameState> {
  return {
    phase: 'ready',
    epoch: 1,
    identity: {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'host',
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
      },
      userId: 'host',
    },
    connection: 'live',
    snapshot: {
      gameType: 'werewolf',
      stateVersion: 1,
      revision: 1,
      state: { status } as GameState,
    },
    lastCommand: null,
    error: null,
  };
}

describe('WerewolfAppOverlay', () => {
  beforeEach(() => {
    mockAIChatBubble.mockClear();
  });

  it('does not mount Werewolf UI without an active Werewolf room session', () => {
    mockUseRoomSessionSnapshot.mockReturnValue({
      phase: 'idle',
      epoch: 0,
      identity: null,
      connection: 'disconnected',
      snapshot: null,
      lastCommand: null,
      error: null,
    });

    render(<WerewolfAppOverlay client={client} />);

    expect(mockAIChatBubble).not.toHaveBeenCalled();
  });

  it.each([
    [GameStatus.Seated, false],
    [GameStatus.Ongoing, true],
  ])('mounts for a ready Werewolf room with pulse=%s', (status, triggerPulse) => {
    mockUseRoomSessionSnapshot.mockReturnValue(readySnapshot(status));

    render(<WerewolfAppOverlay client={client} />);

    expect(mockAIChatBubble).toHaveBeenCalledWith({ triggerPulse });
  });
});
