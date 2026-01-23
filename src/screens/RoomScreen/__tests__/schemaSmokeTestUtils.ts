import type { SchemaId } from '../../../models/roles/spec/schemas';

type RoleId = any;

type UseGameRoomReturn = any;

type MakeUseGameRoomArgs = {
  schemaId: SchemaId;
  currentActionRole: RoleId;
  myRole: RoleId;
  mySeatNumber?: number;
  numberOfPlayers?: number;
  /** Optional per-test override for hook return */
  overrides?: Partial<UseGameRoomReturn>;
};

export const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

export function makeBaseUseGameRoomReturn({
  schemaId,
  currentActionRole,
  myRole,
  mySeatNumber = 0,
  numberOfPlayers = 12,
  overrides,
}: MakeUseGameRoomArgs): UseGameRoomReturn {
  const { getSchema } = require('../../../models/roles/spec/schemas');

  const players = new Map(
    Array.from({ length: numberOfPlayers }).map((_, i) => [
      i,
      {
        uid: `p${i}`,
        seatNumber: i,
        displayName: `P${i + 1}`,
        avatarUrl: undefined,
        role: i === mySeatNumber ? myRole : 'villager',
        hasViewedRole: true,
      },
    ]),
  );

  return {
    gameState: {
      status: 'ongoing',
      template: {
        numberOfPlayers,
        roles: Array.from({ length: numberOfPlayers }).map(() => 'villager'),
        actionOrder: [currentActionRole],
      },
      players,
      actions: new Map(),
      wolfVotes: new Map(),
      currentActionerIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      nightmareBlockedSeat: null,
      templateRoles: [],
      hostUid: 'host',
      roomCode: '1234',
    },

    connectionStatus: 'live',

    isHost: false,
    roomStatus: require('../../../models/Room').GameStatus.ongoing,

    currentActionRole,
    currentSchema: getSchema(schemaId),
    isAudioPlaying: false,

    mySeatNumber,
    myRole,

    createRoom: jest.fn(),
    joinRoom: jest.fn().mockResolvedValue(true),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),

    submitAction: jest.fn(),
    submitWolfVote: jest.fn(),

    hasWolfVoted: () => false,
    requestSnapshot: jest.fn(),
    viewedRole: jest.fn(),

    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    getWitchContext: jest.fn().mockReturnValue(null),
    getLastNightInfo: jest.fn().mockReturnValue(''),
    getLastNightDeaths: jest.fn().mockReturnValue([]),

    waitForSeerReveal: jest.fn(),
    waitForPsychicReveal: jest.fn(),
    waitForGargoyleReveal: jest.fn(),
    waitForWolfRobotReveal: jest.fn(),
    submitRevealAck: jest.fn(),

    ...(overrides ?? {}),
  };
}
