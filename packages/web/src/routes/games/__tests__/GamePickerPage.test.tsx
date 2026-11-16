/**
 * Game picker: shared ScreenHeader, tier tabs, the drawing-game family card, and the
 * 轮流讲故事 rename. Navigation (create → config, guide → guide) is unchanged.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

import { TESTIDS } from '@/testids';

import { GamePickerPage } from '../GamePickerPage';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderPicker({
  purpose = 'create',
  entries = [`/games?purpose=${purpose}`],
  initialIndex = 0,
}: {
  purpose?: 'create' | 'guide';
  entries?: string[];
  initialIndex?: number;
} = {}) {
  const router = createMemoryRouter(
    [
      { path: '/games', Component: GamePickerPage },
      { path: '*', Component: LocationProbe },
    ],
    { initialEntries: entries, initialIndex },
  );
  render(<RouterProvider router={router} />);
}

async function openMiniTab() {
  await userEvent.click(screen.getByTestId(TESTIDS.gameModePickerTab('mini')));
}

describe('GamePickerPage', () => {
  describe('header and default tab', () => {
    it('renders the shared header and the create intro with 主游戏 active', () => {
      renderPicker();

      expect(screen.getByTestId(TESTIDS.screenHeaderTitle)).toHaveTextContent('创建游戏');
      expect(screen.getByText('选择本局要创建的游戏')).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.gameModePickerTab('main'))).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByTestId(TESTIDS.gameModePickerTab('mini'))).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.getByTestId(TESTIDS.gameModePickerOption('werewolf'))).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.gameModePickerOption('avalon'))).toBeInTheDocument();
      expect(
        screen.queryByTestId(TESTIDS.gameModePickerOption('storyrelay')),
      ).not.toBeInTheDocument();
    });

    it('returns to Home through the header back button', async () => {
      renderPicker({ entries: ['/', '/games?purpose=create'], initialIndex: 1 });

      await userEvent.click(screen.getByRole('button', { name: '返回' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });

    it('renders the guide title and intro for the guide purpose', () => {
      renderPicker({ purpose: 'guide' });

      expect(screen.getByTestId(TESTIDS.screenHeaderTitle)).toHaveTextContent('选择游戏图鉴');
      expect(screen.getByText('选择要查看的游戏')).toBeInTheDocument();
    });
  });

  describe('tier tabs', () => {
    it('switches to 小游戏 and hides the main games', async () => {
      renderPicker();
      await openMiniTab();

      expect(screen.getByTestId(TESTIDS.gameModePickerTab('mini'))).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByTestId(TESTIDS.gameModePickerOption('fibking'))).toBeInTheDocument();
      expect(
        screen.queryByTestId(TESTIDS.gameModePickerOption('werewolf')),
      ).not.toBeInTheDocument();
    });

    it('switches back to 主游戏', async () => {
      renderPicker();
      await openMiniTab();
      await userEvent.click(screen.getByTestId(TESTIDS.gameModePickerTab('main')));

      expect(screen.getByTestId(TESTIDS.gameModePickerOption('werewolf'))).toBeInTheDocument();
      expect(screen.queryByTestId(TESTIDS.gameModePickerOption('fibking'))).not.toBeInTheDocument();
    });
  });

  describe('drawing-game family', () => {
    it('groups 你画我猜 and 你画我猜接龙 in one family card with the member count', async () => {
      renderPicker();
      await openMiniTab();

      const family = screen.getByTestId(TESTIDS.gameModePickerFamilyGroup('drawguess'));
      expect(
        within(family).getByText('你画我猜', { selector: '.picker-family-title' }),
      ).toBeInTheDocument();
      expect(within(family).getByText('2 个玩法')).toBeInTheDocument();
      expect(
        within(family).getByTestId(TESTIDS.gameModePickerOption('drawguess')),
      ).toBeInTheDocument();
      expect(
        within(family).getByTestId(TESTIDS.gameModePickerOption('pictionary')),
      ).toBeInTheDocument();
      expect(within(family).getAllByRole('button')).toHaveLength(2);
    });

    it('keeps the other mini games outside the family card', async () => {
      renderPicker();
      await openMiniTab();

      const family = screen.getByTestId(TESTIDS.gameModePickerFamilyGroup('drawguess'));
      expect(
        within(family).queryByTestId(TESTIDS.gameModePickerOption('fibking')),
      ).not.toBeInTheDocument();
      expect(
        within(family).queryByTestId(TESTIDS.gameModePickerOption('storyrelay')),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.gameModePickerOption('fibking'))).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.gameModePickerOption('undercover'))).toBeInTheDocument();
    });

    it('paints the row art on the game gradient matte', () => {
      renderPicker();

      const row = screen.getByTestId(TESTIDS.gameModePickerOption('werewolf'));
      const art = row.querySelector('.picker-option-art');
      expect(art?.getAttribute('style')).toContain('linear-gradient');
    });
  });

  describe('rename', () => {
    it('shows 轮流讲故事 instead of the old name', async () => {
      renderPicker();
      await openMiniTab();

      const row = screen.getByTestId(TESTIDS.gameModePickerOption('storyrelay'));
      expect(within(row).getByText('轮流讲故事')).toBeInTheDocument();
      expect(screen.queryByText('故事接龙')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('opens the config create path for the selected game', async () => {
      renderPicker();

      await userEvent.click(screen.getByTestId(TESTIDS.gameModePickerOption('werewolf')));

      expect(screen.getByTestId('location')).toHaveTextContent('/game/werewolf/config/create');
    });

    it('opens the guide path for the selected game in guide mode', async () => {
      renderPicker({ purpose: 'guide' });
      await openMiniTab();

      await userEvent.click(screen.getByTestId(TESTIDS.gameModePickerOption('storyrelay')));

      expect(screen.getByTestId('location')).toHaveTextContent('/game/storyrelay/guide');
    });
  });
});
