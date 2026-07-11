import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Text } from 'react-native';

import { useServices } from '@/contexts/ServiceContext';
import type { GameUiModule } from '@/features/room/model/GameUiModule';
import type { RootStackParamList } from '@/navigation/types';
import type { IRoomDirectoryService, RoomRecord } from '@/services/types/IRoomDirectoryService';

import { RoomResolverScreen } from '../RoomResolverScreen';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/contexts/ServiceContext', () => ({ useServices: jest.fn() }));

const mockUseServices = jest.mocked(useServices);
const getRoom = jest.fn<Promise<RoomRecord | null>, [string]>();
const roomDirectory = { getRoom } as unknown as IRoomDirectoryService;
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as NativeStackScreenProps<RootStackParamList, 'Room'>['navigation'];

const WerewolfRoom: React.FC<React.ComponentProps<GameUiModule['roomScreen']>> = ({ room }) => (
  <Text>{`狼人杀房间 ${room.roomCode}`}</Text>
);
const AccountStatsSection: React.FC<{ readonly userId: string }> = () => null;
const module: GameUiModule = {
  gameType: 'werewolf',
  roomScreen: WerewolfRoom,
  accountStatsSection: AccountStatsSection,
};
const getGameModule = jest.fn(() => module);

function renderResolver(roomCode = '1234') {
  return render(
    <RoomResolverScreen
      route={{ key: 'room', name: 'Room', params: { roomCode } }}
      navigation={navigation}
      getGameModule={getGameModule}
    />,
  );
}

describe('RoomResolverScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseServices.mockReturnValue({ roomDirectory } as ReturnType<typeof useServices>);
  });

  it('resolves metadata before selecting the registered game screen', async () => {
    getRoom.mockResolvedValue({
      roomCode: '1234',
      roomId: 'room-id-1234',
      gameType: 'werewolf',
      hostUserId: 'host-1',
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    const view = renderResolver();

    expect(view.getByText('正在查找房间')).toBeTruthy();
    await waitFor(() => expect(view.getByText('狼人杀房间 1234')).toBeTruthy());
    expect(getGameModule).toHaveBeenCalledWith('werewolf');
  });

  it('stops before game rendering when the active room is missing', async () => {
    getRoom.mockResolvedValue(null);
    const view = renderResolver();

    await waitFor(() => expect(view.getByText('房间不存在')).toBeTruthy());
    expect(getGameModule).not.toHaveBeenCalled();
  });

  it('rejects malformed deep-link codes without issuing a request', async () => {
    const view = renderResolver('werewolf');

    await waitFor(() => expect(view.getByText('房间号格式错误')).toBeTruthy());
    expect(getRoom).not.toHaveBeenCalled();
  });

  it('retries metadata resolution with the same canonical room code', async () => {
    getRoom.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      roomCode: '1234',
      roomId: 'room-id-1234',
      gameType: 'werewolf',
      hostUserId: 'host-1',
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
    });
    const view = renderResolver();
    await waitFor(() => expect(view.getByText('房间加载失败，请重试')).toBeTruthy());

    fireEvent.press(view.getByText('重试'));
    await waitFor(() => expect(view.getByText('狼人杀房间 1234')).toBeTruthy());
    expect(getRoom).toHaveBeenNthCalledWith(1, '1234');
    expect(getRoom).toHaveBeenNthCalledWith(2, '1234');
  });
});
