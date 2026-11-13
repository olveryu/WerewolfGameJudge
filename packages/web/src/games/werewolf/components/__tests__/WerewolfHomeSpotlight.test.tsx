import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { WerewolfHomeSpotlight } from '@/games/werewolf/components/WerewolfHomeSpotlight';

describe('WerewolfHomeSpotlight', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not aria-hide the focused action while the card flips', () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <WerewolfHomeSpotlight />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const refreshButton = screen.getByRole('button', { name: '换一个' });
    refreshButton.focus();
    fireEvent.click(refreshButton);

    expect(refreshButton).toHaveFocus();
    expect(refreshButton.closest('[aria-hidden="true"]')).toBeNull();
  });
});
