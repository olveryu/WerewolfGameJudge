/** The notepad page edits and persists this room's notes; another room's snapshot shows none. */
import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { AlertHost } from '@/components/AlertHost';
import { NotepadScreen } from '@/games/werewolf/screens/NotepadScreen/NotepadScreen';
import {
  getWerewolfNotepadRoundId,
  readWerewolfNotepad,
} from '@/games/werewolf/services/notepadRepository';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { alertStore, dismissAlert } from '@/utils/alert';

function renderNotepad(snapshotRoomCode: string) {
  const session = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot<GameState>(
      testIdentity('werewolf', { roomCode: snapshotRoomCode, userId: 'user-1' }),
      createRoomSnapshot(
        buildWerewolfTestState({
          roomCode: snapshotRoomCode,
          templateRoles: ['wolf', 'seer', 'villager'],
        }),
        1,
      ),
    ),
  );
  const router = createMemoryRouter(
    [
      { path: '/room/:roomCode', element: <p>room</p> },
      {
        path: '/game/:gameType/notepad/:roomCode',
        element: <NotepadScreen session={session} />,
      },
    ],
    { initialEntries: ['/game/werewolf/notepad/1234'] },
  );
  render(
    <>
      <RouterProvider router={router} />
      <AlertHost />
    </>,
  );
  return router;
}

describe('NotepadScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    const activeAlert = alertStore.getSnapshot();
    if (activeAlert !== null) dismissAlert(activeAlert.generation);
  });

  it('edits seat notes, guesses and sheriff tags, persists them, and clears them', async () => {
    const user = userEvent.setup();
    renderNotepad('1234');
    const owner = { userId: 'user-1', roomId: 'room-1234' };
    const roundId = getWerewolfNotepadRoundId(undefined);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await user.type(screen.getByRole('textbox', { name: '2号发言' }), '跳预言家');
    await user.click(screen.getByRole('button', { name: '2号上警' }));
    await user.click(screen.getByRole('button', { name: '2号 角色猜测：未选择' }));
    const picker = screen.getByRole('dialog', { name: '座位 2 · 角色猜测' });
    await user.click(within(picker).getByRole('button', { name: '预' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: '2号 角色猜测：预' })).toBeVisible();
    expect(screen.getByRole('button', { name: '2号上警' })).toHaveAttribute('aria-pressed', 'true');
    expect(readWerewolfNotepad(owner, roundId, 3)).toMatchObject({
      kind: 'found',
      state: {
        playerNotes: { 2: '跳预言家' },
        handStates: { 2: true },
        roleGuesses: { 2: 'seer' },
      },
    });

    await user.type(screen.getByRole('textbox', { name: '自由记录' }), '投票给 3 号');
    await user.click(screen.getByRole('button', { name: '清除笔记' }));
    expect(await screen.findByText('清除所有笔记？')).toBeVisible();
    expect(readWerewolfNotepad(owner, roundId, 3)).toMatchObject({
      kind: 'found',
      state: {
        playerNotes: { 2: '跳预言家' },
        publicNoteLeft: '投票给 3 号',
        handStates: { 2: true },
        roleGuesses: { 2: 'seer' },
      },
    });
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByRole('textbox', { name: '2号发言' })).toHaveValue('跳预言家');
    expect(screen.getByRole('textbox', { name: '自由记录' })).toHaveValue('投票给 3 号');
    expect(readWerewolfNotepad(owner, roundId, 3)).toMatchObject({
      kind: 'found',
      state: {
        playerNotes: { 2: '跳预言家' },
        publicNoteLeft: '投票给 3 号',
        handStates: { 2: true },
        roleGuesses: { 2: 'seer' },
      },
    });

    await user.click(screen.getByRole('button', { name: '清除笔记' }));
    expect(await screen.findByText('清除所有笔记？')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '清除' }));
    expect(screen.getByRole('textbox', { name: '2号发言' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: '自由记录' })).toHaveValue('');
    expect(readWerewolfNotepad(owner, roundId, 3)).toEqual({ kind: 'missing' });
  });

  it('shows no seats for another room and returns to its own room', async () => {
    const user = userEvent.setup();
    const router = renderNotepad('5678');

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(
      screen.getByText('等待玩家入座后会显示座位记录，也可以先在下方填写自由记录和投票记录。'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/room/1234'));
  });
});
