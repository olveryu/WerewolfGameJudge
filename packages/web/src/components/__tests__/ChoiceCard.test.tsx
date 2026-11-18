import { fireEvent, render, screen } from '@testing-library/react';

import { ChoiceCard } from '../ChoiceCard';

it('renders the image and label, reports clicks, and shows the check badge only when selected', () => {
  const onClick = vi.fn();
  const { rerender } = render(
    <ChoiceCard
      label="赞成"
      imageSrc="/approve.webp"
      isSelected={false}
      isDisabled={false}
      testId="vote-approve"
      onClick={onClick}
    />,
  );
  const card = screen.getByTestId('vote-approve');
  expect(card).toHaveAttribute('aria-pressed', 'false');
  expect(card.querySelector('.choice-check')).toBeNull();
  expect(card.querySelector('img')?.getAttribute('src')).toBe('/approve.webp');
  fireEvent.click(card);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <ChoiceCard
      label="赞成"
      imageSrc="/approve.webp"
      isSelected
      isDisabled={false}
      testId="vote-approve"
      onClick={onClick}
    />,
  );
  const selected = screen.getByTestId('vote-approve');
  expect(selected).toHaveAttribute('aria-pressed', 'true');
  expect(selected.querySelector('.choice-check')?.textContent).toBe('✓');
});

it('disables the card while submitting', () => {
  render(
    <ChoiceCard
      label="反对"
      imageSrc="/reject.webp"
      isSelected={false}
      isDisabled
      testId="vote-reject"
      onClick={() => {}}
    />,
  );
  expect(screen.getByTestId('vote-reject')).toBeDisabled();
});
