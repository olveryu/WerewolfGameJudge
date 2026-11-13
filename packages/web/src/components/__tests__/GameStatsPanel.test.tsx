import { render, screen } from '@testing-library/react';

import { GameStatsPanel, GameStatsRow } from '../GameStatsPanel';

const baseProps = {
  gamesPlayed: 0,
  isLoading: false,
  isError: false,
  loadingLabel: '加载战绩',
  errorLabel: '战绩加载失败',
  emptyTitle: '暂无战绩',
  emptyDescription: '完成对局后查看记录。',
  children: <GameStatsRow label="完成局数" value="0局" />,
};

describe('GameStatsPanel', () => {
  it('announces loading and explicit error states', () => {
    const { rerender } = render(<GameStatsPanel {...baseProps} isLoading />);
    expect(screen.getByRole('status', { name: '加载战绩' })).toBeInTheDocument();

    rerender(<GameStatsPanel {...baseProps} isError />);
    expect(screen.getByRole('alert')).toHaveTextContent('战绩加载失败');
  });

  it('shows the empty state instead of zero-valued stat rows', () => {
    render(<GameStatsPanel {...baseProps} />);

    expect(screen.getByRole('heading', { name: '暂无战绩' })).toBeInTheDocument();
    expect(screen.queryByText('0局')).toBeNull();
  });
});
