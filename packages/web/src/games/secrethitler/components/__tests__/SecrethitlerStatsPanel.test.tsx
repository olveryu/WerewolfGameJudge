import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { SecrethitlerStatsPanel } from '../SecrethitlerStatsPanel';

const query = vi.hoisted(() => {
  const state: {
    data:
      | {
          gameType: 'secrethitler';
          gamesPlayed: number;
          liberalWins: number;
          fascistWins: number;
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
    <SecrethitlerStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />,
  );
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isPending = false;
  query.isError = true;
  view.rerender(<SecrethitlerStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByRole('alert')).toHaveTextContent('秘密希特勒战绩加载失败');
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isError = false;
  query.data = {
    gameType: 'secrethitler',
    gamesPlayed: 0,
    liberalWins: 0,
    fascistWins: 0,
  };
  view.rerender(<SecrethitlerStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByText('暂无秘密希特勒战绩')).toBeInTheDocument();
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(0);
  query.data = {
    gameType: 'secrethitler',
    gamesPlayed: 2,
    liberalWins: 1,
    fascistWins: 1,
  };
  view.rerender(<SecrethitlerStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.queryByText('2局')).not.toBeInTheDocument();
  expect(screen.getByText('自由派胜场')).toBeInTheDocument();
  expect(screen.getByText('法西斯胜率')).toBeInTheDocument();
  expect(screen.getAllByText('50%')).toHaveLength(2);
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(2);
  view.rerender(<SecrethitlerStatsPanel userId="user" />);
  expect(screen.getByText('2局')).toBeInTheDocument();
});
