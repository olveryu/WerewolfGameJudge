import { render } from '@testing-library/react-native';

import { CampDistributionBar } from '../CampDistributionBar';

describe('CampDistributionBar', () => {
  it('renders camp percentages from counts', () => {
    const { getByText } = render(
      <CampDistributionBar
        campStats={{ total: 10, counts: { wolf: 5, god: 3, villager: 2, third: 0 } }}
      />,
    );
    expect(getByText('50%')).toBeTruthy(); // wolf 5/10
    expect(getByText('30%')).toBeTruthy(); // god 3/10
    expect(getByText('20%')).toBeTruthy(); // villager 2/10
    expect(getByText('0%')).toBeTruthy(); // third 0/10 still shown
  });

  it('shows empty-state copy when no games are visible', () => {
    const { getByText, queryByText } = render(
      <CampDistributionBar
        campStats={{ total: 0, counts: { wolf: 0, god: 0, villager: 0, third: 0 } }}
      />,
    );
    expect(getByText('暂无阵营数据')).toBeTruthy();
    expect(queryByText('0%')).toBeNull();
  });
});
