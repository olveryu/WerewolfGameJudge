import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { DecryptoStatsPanel } from '../DecryptoStatsPanel';

const query = vi.hoisted(() => {
  const state: {
    data: { gameType: 'decrypto'; gamesPlayed: number } | undefined;
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
    <DecryptoStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />,
  );
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isPending = false;
  query.isError = true;
  view.rerender(<DecryptoStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByRole('alert')).toHaveTextContent('解码战战绩加载失败');
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(null);
  query.isError = false;
  query.data = { gameType: 'decrypto', gamesPlayed: 0 };
  view.rerender(<DecryptoStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.getByText('暂无解码战战绩')).toBeInTheDocument();
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(0);
  query.data = { gameType: 'decrypto', gamesPlayed: 2 };
  view.rerender(<DecryptoStatsPanel userId="user" onGamesPlayedChange={onGamesPlayedChange} />);
  expect(screen.queryByText('2局')).not.toBeInTheDocument();
  expect(onGamesPlayedChange).toHaveBeenLastCalledWith(2);
  view.rerender(<DecryptoStatsPanel userId="user" />);
  expect(screen.getByText('2局')).toBeInTheDocument();
});
