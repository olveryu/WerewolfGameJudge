import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { SpotmatchStatsPanel } from '../SpotmatchStatsPanel';

const query = vi.hoisted(() => {
  const state: {
    data:
      | {
          gameType: 'spotmatch';
          gamesPlayed: number;
          wins: number;
          correctCards: number;
          mistakes: number;
        }
      | undefined;
    isPending: boolean;
    isError: boolean;
  } = { data: undefined, isPending: false, isError: false };
  return state;
});
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => query,
}));

it('reports loading/error/empty counts and avoids duplicate profile game counts', () => {
  const onGamesPlayedChange = vi.fn();
  query.isPending = true;
  const view = render(
    <SpotmatchStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />,
  );
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isPending = false;
  query.isError = true;
  view.rerender(<SpotmatchStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByRole('alert')).toHaveTextContent('一眼成对战绩加载失败');
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isError = false;
  query.data = { gameType: 'spotmatch', gamesPlayed: 0, wins: 0, correctCards: 0, mistakes: 0 };
  view.rerender(<SpotmatchStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByText('暂无一眼成对战绩')).toBeInTheDocument();
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(0);
  query.data = { gameType: 'spotmatch', gamesPlayed: 2, wins: 1, correctCards: 12, mistakes: 3 };
  view.rerender(<SpotmatchStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.queryByText('2局')).not.toBeInTheDocument();
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(2);
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText('12张')).toBeInTheDocument();
  expect(screen.getByText('3次')).toBeInTheDocument();
  view.rerender(<SpotmatchStatsPanel userId="user" />);
  expect(screen.getByText('2局')).toBeInTheDocument();
});
