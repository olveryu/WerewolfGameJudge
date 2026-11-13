/** Guide navigation and live public configuration; hidden modes remain host-only. */
import type {
  GameRuleOverrides,
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { EncyclopediaScreen } from '@/games/werewolf/screens/EncyclopediaScreen/EncyclopediaScreen';
import {
  createFakeRoomLink,
  type FakeRoomLink,
  idleLinkSnapshot,
  readyLinkSnapshot,
  testIdentity,
} from '@/test-utils/linkSnapshot';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

vi.mock('@/features/encyclopedia/EncyclopediaRolesContent', () => ({
  EncyclopediaRolesContent: () => null,
}));
vi.mock('@/games/werewolf/screens/EncyclopediaScreen/BoardsGuideContent', () => ({
  BoardsGuideContent: () => null,
}));

type WerewolfFakeLink = FakeRoomLink<GameState, WerewolfPublicCommand>;

function createSession(): WerewolfFakeLink {
  return createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>());
}

function publishRoom(
  session: WerewolfFakeLink,
  { roomCode, userId, rules }: { roomCode: string; userId: string; rules: GameRuleOverrides },
) {
  const state = buildWerewolfTestState({
    roomCode,
    hostUserId: 'host',
    templateRoles: ['wolf', 'witch', 'villager'],
    rules,
  });
  session.publish(
    readyLinkSnapshot<GameState>(
      testIdentity('werewolf', { roomCode, hostUserId: 'host', userId }),
      createRoomSnapshot(state, 1),
    ),
  );
}

function renderGuide(entry: string, session = createSession()) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>home</p> },
      {
        path: '/game/:gameType/guide/:roomCode?',
        element: <EncyclopediaScreen session={session} />,
      },
    ],
    { initialEntries: ['/', entry], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('EncyclopediaScreen gameplay guide', () => {
  it('opens gameplay by default without catalog tools and preserves tab navigation', async () => {
    const router = renderGuide('/game/werewolf/guide');

    expect(screen.getByRole('tab', { name: '玩法' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '基本流程' })).toBeVisible();
    expect(screen.getByText(/不是整局自动裁判/)).toBeVisible();
    expect(screen.queryByText('本局规则')).toBeNull();
    expect(screen.queryByRole('button', { name: '搜索' })).toBeNull();
    expect(screen.queryByRole('button', { name: '搜索板子' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /^角色/ }));
    expect(await screen.findByRole('button', { name: '搜索' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: /^板子/ }));
    expect(await screen.findByRole('button', { name: '搜索板子' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('navigates between guide segments with horizontal arrow keys', async () => {
    renderGuide('/game/werewolf/guide');

    const gameplayTab = screen.getByRole('tab', { name: '玩法' });
    const rolesTab = screen.getByRole('tab', { name: /^角色/ });
    const boardsTab = screen.getByRole('tab', { name: /^板子/ });
    gameplayTab.focus();

    fireEvent.keyDown(gameplayTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(rolesTab).toHaveFocus();
      expect(rolesTab).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(rolesTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(boardsTab).toHaveFocus();
      expect(boardsTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('keeps role links on the role tab', () => {
    renderGuide('/game/werewolf/guide?roleId=seer');
    expect(screen.getByRole('tab', { name: /^角色/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('honors an explicit board tab', () => {
    renderGuide('/game/werewolf/guide?initialTab=boards');
    expect(screen.getByRole('tab', { name: /^板子/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows live public rules and only reveals plague mode to the host', () => {
    const session = createSession();
    publishRoom(session, {
      roomCode: '1234',
      userId: 'player',
      rules: { witchCanSelfHeal: true, isSheriffElectionEnabled: true, isPlagueMode: true },
    });
    renderGuide('/game/werewolf/guide/1234', session);

    expect(screen.getByText('本局板子 · 3 人')).toBeVisible();
    expect(screen.getByText('已开启：女巫可以对自己使用解药。')).toBeVisible();
    expect(screen.getByText('已开启：首夜结束后进行首日警长竞选。')).toBeVisible();
    expect(screen.queryByText('黑死病模式（仅房主可见）')).toBeNull();

    act(() =>
      publishRoom(session, {
        roomCode: '1234',
        userId: 'host',
        rules: { witchCanSelfHeal: false, isSheriffElectionEnabled: false, isPlagueMode: true },
      }),
    );

    expect(screen.getByText('黑死病模式（仅房主可见）')).toBeVisible();
    expect(screen.getByText('未开启：女巫不能对自己使用解药。')).toBeVisible();
    expect(screen.getByText('未开启：本局不进行首日警长竞选。')).toBeVisible();
  });

  it('does not substitute another room configuration', () => {
    const session = createSession();
    publishRoom(session, { roomCode: '5678', userId: 'player', rules: {} });
    renderGuide('/game/werewolf/guide/1234', session);

    expect(screen.getByText('暂未获取本局配置，请返回房间确认连接后重试。')).toBeVisible();
    expect(screen.queryByText('女巫自救')).toBeNull();
  });
});
