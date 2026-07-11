import { render } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';

import type { WerewolfGameClient } from '../WerewolfGameClient';
import { useWerewolfGame, WerewolfGameProvider } from '../WerewolfGameContext';

function createRoomSession(): WerewolfGameClient['roomSession'] {
  return {
    getSnapshot: () => ({
      phase: 'entering',
      epoch: 1,
      identity: {
        room: {
          roomCode: '1234',
          roomId: 'room-id',
          gameType: 'werewolf',
          hostUserId: 'u1',
          createdAt: new Date('2026-07-11T12:00:00.000Z'),
        },
        userId: 'u1',
      },
      connection: 'connecting',
      snapshot: null,
      lastCommand: null,
      error: null,
    }),
  } as unknown as WerewolfGameClient['roomSession'];
}

function createFakeClient(): WerewolfGameClient {
  return {
    roomSession: createRoomSession(),
    assignRoles: async () => ({ success: true }),
    updateTemplate: async () => ({ success: true }),
    startNight: async () => ({ success: true }),
    restartGame: async () => ({ success: true }),
    markAllBotsViewed: async () => ({ success: true }),
    markAllBotsGroupConfirmed: async () => ({ success: true }),
    markViewedRole: async () => ({ success: true }),
    submitAction: async () => ({ success: true }),
    submitRevealAck: async () => ({ success: true }),
    submitGroupConfirmAck: async () => ({ success: true }),
    setAudioPlaying: async () => ({ success: true }),
    postProgression: async () => ({ success: true }),
    sendWolfRobotHunterStatusViewed: async () => ({ success: true }),
    wasAudioInterrupted: false,
    resumeAfterRejoin: async () => {},
    shareNightReview: async () => ({ success: true }),
    updatePlayerProfile: async () => ({ success: true }),
    boardNominate: async () => ({ success: true }),
    boardUpvote: async () => ({ success: true }),
    boardWithdraw: async () => ({ success: true }),
  };
}

const Consumer: React.FC = () => {
  const client = useWerewolfGame();
  const room = client.roomSession.getSnapshot();
  return <Text testID="userId">{room.phase === 'idle' ? 'null' : room.identity.userId}</Text>;
};

describe('WerewolfGameProvider / useWerewolfGame', () => {
  it('throws when used without provider', () => {
    expect(() => render(<Consumer />)).toThrow(
      '[useWerewolfGame] Missing <WerewolfGameProvider> in component tree',
    );
  });

  it('provides the explicit facade prop', () => {
    const client = createFakeClient();
    const ui = render(
      <WerewolfGameProvider client={client}>
        <Consumer />
      </WerewolfGameProvider>,
    );

    expect(ui.getByTestId('userId').props.children).toBe('u1');
  });
});
