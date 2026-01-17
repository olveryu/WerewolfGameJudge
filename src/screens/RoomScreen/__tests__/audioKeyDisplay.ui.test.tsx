import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { RoomScreen } from '../RoomScreen';

// Mock SafeAreaContext (RoomScreen tests use this)
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({}));

// Mock the room hook using the dynamic impl pattern (stable across tests)
type UseGameRoomReturn = any;
let mockUseGameRoomImpl: () => UseGameRoomReturn;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomImpl(),
}));

function makeBaseUseGameRoomReturn(overrides?: Partial<UseGameRoomReturn>): UseGameRoomReturn {
  return {
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers: 1,
        roles: ['villager'],
        actionOrder: [],
      },
      players: new Map([
        [
          0,
          {
            uid: 'p0',
            seatNumber: 0,
            displayName: 'P1',
            avatarUrl: undefined,
            role: 'villager',
            hasViewedRole: true,
          },
        ],
      ]),
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: true,
      currentStepId: 'seerCheck',
      lastNightDeaths: [],
      nightmareBlockedSeat: null,
      templateRoles: [],
      hostUid: 'host',
      roomCode: '0000',
    },

    connectionStatus: 'live',

    isHost: false,
    roomStatus: require('../../../models/Room').GameStatus.ongoing,
    currentActionRole: null,
    currentSchema: null,
    currentStepId: 'seerCheck',
    isAudioPlaying: true,

    mySeatNumber: 0,
    myRole: 'villager',
    myUid: 'p0',

    createRoom: jest.fn(),
    joinRoom: jest.fn().mockResolvedValue(true),
    takeSeat: jest.fn(),
    takeSeatWithAck: jest.fn(),
    leaveSeat: jest.fn(),
    leaveSeatWithAck: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),
    submitAction: jest.fn(),
    submitWolfVote: jest.fn(),
    submitRevealAck: jest.fn(),
    hasWolfVoted: () => false,
    getAllWolfSeats: () => [],
    requestSnapshot: jest.fn(),
    viewedRole: jest.fn(),

    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    waitForActionRejected: jest.fn().mockResolvedValue(null),

    getWitchContext: jest.fn().mockReturnValue(null),
    getLastNightInfo: jest.fn().mockReturnValue(''),
    getLastNightDeaths: jest.fn().mockReturnValue([]),

    getSeerReveal: jest.fn().mockReturnValue(null),
    getPsychicReveal: jest.fn().mockReturnValue(null),
    getGargoyleReveal: jest.fn().mockReturnValue(null),
    getWolfRobotReveal: jest.fn().mockReturnValue(null),
    getActionRejected: jest.fn().mockReturnValue(null),
    waitForSeerReveal: jest.fn().mockResolvedValue(null),
    waitForPsychicReveal: jest.fn().mockResolvedValue(null),
    waitForGargoyleReveal: jest.fn().mockResolvedValue(null),
    waitForWolfRobotReveal: jest.fn().mockResolvedValue(null),

    stateRevision: 0,
    loading: false,
    error: null,
    roomRecord: null,
    currentSchemaId: null,

    ...(overrides ?? {}),
  };
}

describe('RoomScreen (Commit 6): audioKey display', () => {
  beforeEach(() => {
    mockUseGameRoomImpl = () => makeBaseUseGameRoomReturn();
  });

  it('shows current audioKey while audio is playing (UI-only)', async () => {
    render(
      <RoomScreen
        route={{
          key: 'Room',
          name: 'Room',
          params: { roomNumber: '0000', isHost: false, template: null },
        } as any}
        navigation={{} as any}
      />
    );

  expect(await screen.findByText('正在播放：seer')).toBeTruthy();
  });
});
