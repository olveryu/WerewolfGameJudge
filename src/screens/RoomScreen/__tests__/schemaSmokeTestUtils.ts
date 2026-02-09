import type { SchemaId } from '@/models/roles/spec/schemas';

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
  /** Optional override for gameState fields (merged into gameState) */
  gameStateOverrides?: Record<string, any>;
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
  gameStateOverrides,
}: MakeUseGameRoomArgs): UseGameRoomReturn {
  const { getSchema } = require('@/models/roles/spec/schemas');

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
      currentStepIndex: 0,
      isAudioPlaying: false,
      lastNightDeaths: [],
      nightmareBlockedSeat: null,
      templateRoles: [],
      hostUid: 'host',
      roomCode: '1234',
      ...(gameStateOverrides ?? {}),
    },

    connectionStatus: 'live',

    isHost: false,
    roomStatus: require('@/models/GameStatus').GameStatus.ongoing,

    currentActionRole,
    currentSchema: getSchema(schemaId),
    isAudioPlaying: false,

    mySeatNumber,
    myRole,
    myUid: `p${mySeatNumber}`,

    // Debug mode fields
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: mySeatNumber,
    effectiveRole: myRole,
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    setControlledSeat: jest.fn(),

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

    getLastNightInfo: jest.fn().mockReturnValue(''),

    submitRevealAck: jest.fn(),

    isBgmEnabled: true,
    toggleBgm: jest.fn(),

    ...(overrides ?? {}),
  };
}
