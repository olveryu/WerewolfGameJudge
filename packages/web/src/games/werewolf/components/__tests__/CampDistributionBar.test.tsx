import { render, screen } from '@testing-library/react';

import { CampDistributionBar } from '../CampDistributionBar';

describe('CampDistributionBar', () => {
  it('renders camp percentages from counts', () => {
    render(
      <CampDistributionBar
        campStats={{ total: 10, counts: { wolf: 5, god: 3, villager: 2, third: 0 } }}
      />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument(); // wolf 5/10
    expect(screen.getByText('30%')).toBeInTheDocument(); // god 3/10
    expect(screen.getByText('20%')).toBeInTheDocument(); // villager 2/10
    expect(screen.getByText('0%')).toBeInTheDocument(); // third 0/10 still shown
  });

  it('shows empty-state copy when no games are visible', () => {
    render(
      <CampDistributionBar
        campStats={{ total: 0, counts: { wolf: 0, god: 0, villager: 0, third: 0 } }}
      />,
    );
    expect(screen.getByText('暂无阵营数据')).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('shows the 2-hour settlement delay hint', () => {
    render(
      <CampDistributionBar
        campStats={{ total: 10, counts: { wolf: 5, god: 3, villager: 2, third: 0 } }}
      />,
    );
    expect(screen.getByText(/仅统计两小时前结束的对局/)).toBeInTheDocument();
  });
});
