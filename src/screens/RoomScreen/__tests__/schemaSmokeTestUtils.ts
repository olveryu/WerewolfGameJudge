import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getSchema, type SchemaId } from '@werewolf/game-engine/models/roles/spec/schemas';
import type { CurrentNightResults } from '@werewolf/game-engine/resolvers/types';
import type React from 'react';

import type { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import type { LocalPlayer } from '@/types/GameStateTypes';

type RoomScreenProps = React.ComponentProps<typeof RoomScreen>;

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

export const mockRoomRoute = {
  params: { roomCode: '1234', isHost: false },
} as unknown as RoomScreenProps['route'];

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
        role: i === mySeat ? myRole : ('villager' as RoleId),
        hasViewedRole: true,
      },
    ]),
  );

  const gameState = {
    status: GameStatus.Ongoing,
    template: {
      name: 'test',
      numberOfPlayers,
      roles: Array.from({ length: numberOfPlayers }).map(() => 'villager' as RoleId),
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
    facade: { getState: () => gameState },
    gameState,

    connectionStatus: ConnectionStatus.Live,

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
    setControlledSeat: jest.fn(),

    joinRoom: jest.fn().mockResolvedValue(true),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    assignRoles: jest.fn(),
    startGame: jest.fn(),
    restartGame: jest.fn(),

    submitAction: jest.fn(),

    hasWolfVoted: () => false,
    getWolfVoteSummary: () => '0/0 狼人已确认',
    requestSnapshot: jest.fn(),
    viewedRole: jest.fn(),

    lastSeatError: null,
    clearLastSeatError: jest.fn(),

    getLastNightInfo: jest.fn().mockReturnValue(''),

    submitRevealAck: jest.fn(),
    submitGroupConfirmAck: jest.fn(),

    isBgmEnabled: true,
    isBgmPlaying: false,
    toggleBgm: jest.fn(),
    playBgm: jest.fn(),
    stopBgm: jest.fn(),

    ...(overrides ?? {}),
  };
}
