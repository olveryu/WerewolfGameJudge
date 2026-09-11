/** Admin room entry uses the canonical room route independently of participant expansion. */

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AdminRoom } from '@/features/admin/model/adminContracts';
import { fetchRoomPlayers, fetchRooms } from '@/features/admin/services/adminApi';

import { RoomsTab } from '../RoomsTab';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    getState: () => ({ routes: [{ name: 'Home' }, { name: 'Admin' }] }),
  }),
}));
jest.mock('@/features/admin/services/adminApi');

const room: AdminRoom = {
  id: 'room-id',
  code: '1234',
  gameType: 'fibking',
  status: 'active',
  reconciliationAttemptCount: 0,
  reconcileAfter: null,
  lastError: null,
  hostUserId: 'host-id',
  hostName: '房主',
  hostCountry: null,
  gamesStarted: 0,
  lastStartedAt: null,
  participantCount: 0,
  createdAt: '2026-09-11T00:00:00Z',
};

describe('RoomsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchRooms).mockResolvedValue({ rooms: [room], total: 1, page: 1, limit: 50 });
    jest.mocked(fetchRoomPlayers).mockResolvedValue({ players: [] });
  });

  it('enters the selected room without opening participants or assigning host privileges', async () => {
    const view = render(<RoomsTab />);
    fireEvent.press(await view.findByRole('button', { name: '进入房间 1234' }));
    expect(mockNavigate).toHaveBeenCalledWith('Room', { roomCode: '1234' });
    expect(fetchRoomPlayers).not.toHaveBeenCalled();
  });

  it('preserves participant expansion without entering the room', async () => {
    const view = render(<RoomsTab />);
    fireEvent.press(await view.findByText('#1234'));
    await waitFor(() => expect(fetchRoomPlayers).toHaveBeenCalledWith('1234'));
    expect(await view.findByText('无参与者记录')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
