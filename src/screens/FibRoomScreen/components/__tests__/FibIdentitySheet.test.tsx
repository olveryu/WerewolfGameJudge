import { render } from '@testing-library/react-native';

import { FibIdentitySheet } from '../FibIdentitySheet';

describe('FibIdentitySheet', () => {
  it('shows the word but not the real definition for the guesser', () => {
    const { getByText, queryByText } = render(
      <FibIdentitySheet
        visible
        role="guesser"
        word="踟蹰"
        definition="徘徊不前"
        onClose={jest.fn()}
      />,
    );

    expect(getByText('踟蹰')).toBeTruthy();
    expect(queryByText('徘徊不前')).toBeNull();
    expect(getByText('( 没有释义 —— 听大家解释后指认老实人 )')).toBeTruthy();
  });
});
