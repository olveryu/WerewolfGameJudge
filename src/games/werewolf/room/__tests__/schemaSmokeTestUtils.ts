import type { RoleAction } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { CurrentNightResults } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { getSchema, type SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import type React from 'react';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';
import type { LocalPlayer } from '@/games/werewolf/state/LocalGameState';

type RoomScreenProps = React.ComponentProps<typeof WerewolfRoomScreen>;

type MakeUseGameRoomArgs = {
  schemaId: SchemaId;
  currentActionRole: RoleId;
  myRole: RoleId;
  mySeat?: number;
  numberOfPlayers?: number;
  /** Optional per-test override for hook return */
  overrides?: Record<string, unknown>;
  /** Optional override for gameState fields (merged into gameState) */
  gameStateOverrides?: Record<string, unknown>;
};

export const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as RoomScreenProps['navigation'];

export const mockRoom: RoomRecord = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: 'host-uid',
  createdAt: new Date(0),
};

export function makeBaseUseGameRoomReturn({
  schemaId,
  currentActionRole,
  myRole,
  mySeat = 0,
  numberOfPlayers = 12,
  overrides,
  gameStateOverrides,
}: MakeUseGameRoomArgs) {
  const players = new Map<number, LocalPlayer>(
    Array.from({ length: numberOfPlayers }).map((_, i) => [
      i,
      {
        userId: `p${i}`,
        seat: i,
        displayName: `P${i + 1}`,
        avatarUrl: undefined,
        role: i === mySeat ? myRole : ('villager' satisfies RoleId),
        hasViewedRole: true,
      },
    ]),
  );

  const gameState = {
    ...WEREWOLF_STATE_IDENTITY,
    status: GameStatus.Ongoing,
    template: {
      name: 'test',
      numberOfPlayers,
      roles: Array.from({ length: numberOfPlayers }).map((): RoleId => 'villager'),
      actionOrder: [currentActionRole],
    },
    players,
    actions: new Map<RoleId, RoleAction>(),
    wolfVotes: new Map<number, number>(),
    currentStepIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [] as number[],
    nightmareBlockedSeat: undefined as number | undefined,
    templateRoles: [] as RoleId[],
    hostUserId: 'host',
    roomCode: '1234',
    pendingRevealAcks: [] as string[],
    hypnotizedSeats: [] as number[],
    piperRevealAcks: [] as number[],
    conversionRevealAcks: [] as number[],
    cupidLoversRevealAcks: [] as number[],
    currentNightResults: {} as CurrentNightResults,
    ...(gameStateOverrides ?? {}),
  };

  return {
    gameState,

    connectionStatus: 'live',

    isHost: false,
    roomStatus: GameStatus.Ongoing,

    currentActionRole,
    currentSchema: getSchema(schemaId),
    isAudioPlaying: false,

    mySeat,
    myRole,
    myUserId: `p${mySeat}`,

    // Debug mode fields
    isDebugMode: false,
    controlledSeat: null,
    effectiveSeat: mySeat,
    effectiveRole: myRole,
    fillWithBots: jest.fn(),
    markAllBotsViewed: jest.fn(),
    markAllBotsGroupConfirmed: jest.fn(),
    takeOverBot: jest.fn(),
    releaseBot: jest.fn(),

    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),

    submitAction: jest.fn(),

    hasWolfVoted: () => false,
    viewedRole: jest.fn(),

    getLastNightInfo: jest.fn().mockReturnValue(''),

    submitRevealAck: jest.fn().mockResolvedValue({ success: true }),
    submitGroupConfirmAck: jest.fn().mockResolvedValue({ success: true }),

    isBgmPlaying: false,
    playBgm: jest.fn(),
    stopBgm: jest.fn(),

    ...(overrides ?? {}),
  };
}
