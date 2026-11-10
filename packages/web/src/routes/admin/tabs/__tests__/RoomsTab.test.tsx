/** Admin room entry uses the canonical room route independently of participant expansion. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminRoom } from '@/features/admin/model/adminContracts';
import { fetchRoomPlayers, fetchRooms } from '@/features/admin/services/adminApi';

import { RoomsTab } from '../RoomsTab';

vi.mock('@/features/admin/services/adminApi', () => ({
  fetchRooms: vi.fn(),
  fetchRoomPlayers: vi.fn(),
}));

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

function RoomProbe() {
  const { roomCode } = useParams();
  return <p>room page {roomCode}</p>;
}

function renderRoomsTab() {
  const router = createMemoryRouter(
    [
      { path: '/admin', element: <RoomsTab /> },
      { path: '/room/:roomCode', element: <RoomProbe /> },
    ],
    { initialEntries: ['/admin'] },
  );
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('RoomsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchRooms).mockResolvedValue({ rooms: [room], total: 1, page: 1, limit: 50 });
    vi.mocked(fetchRoomPlayers).mockResolvedValue({ players: [] });
  });

  it('enters the selected room without opening participants or assigning host privileges', async () => {
    const router = renderRoomsTab();
    fireEvent.click(await screen.findByRole('button', { name: '进入房间 1234' }));
    expect(await screen.findByText('room page 1234')).toBeDefined();
    expect(router.state.historyAction).toBe('PUSH');
    expect(fetchRoomPlayers).not.toHaveBeenCalled();
  });

  it('preserves participant expansion without entering the room', async () => {
    const router = renderRoomsTab();
    fireEvent.click(await screen.findByText('#1234'));
    await waitFor(() =>
      expect(fetchRoomPlayers).toHaveBeenCalledWith('1234', expect.any(AbortSignal)),
    );
    expect(await screen.findByText('无参与者记录')).toBeDefined();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('shows a failed participant read and reads again on retry', async () => {
    vi.mocked(fetchRoomPlayers)
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce({ players: [] });
    renderRoomsTab();
    fireEvent.click(await screen.findByText('#1234'));
    expect((await screen.findByRole('alert')).textContent).toBe('读取参与者失败：HTTP 500');
    fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
    expect(await screen.findByText('无参与者记录')).toBeDefined();
    expect(fetchRoomPlayers).toHaveBeenCalledTimes(2);
  });
});
