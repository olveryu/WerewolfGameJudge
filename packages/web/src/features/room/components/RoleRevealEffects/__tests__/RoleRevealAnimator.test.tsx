import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RoleRevealAnimator } from '../RoleRevealAnimator';

vi.mock('../RevealEffectStage', () => ({
  default: ({ onAvailabilityChange }: { onAvailabilityChange: (available: boolean) => void }) => (
    <>
      <button onClick={() => onAvailabilityChange(false)}>lose scene</button>
      <button onClick={() => onAvailabilityChange(true)}>restore scene</button>
    </>
  ),
  prefetchRevealEffect: vi.fn(),
}));

it('offers a focused way to view the role while the scene is unavailable', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(
    <RoleRevealAnimator
      effectType="tarot"
      role={{ id: 'seer', name: '预言家', alignment: 'god' }}
      onComplete={onComplete}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'lose scene' }));
  expect(screen.getByRole('alert').textContent).toContain('动画暂时无法显示');
  const fallback = screen.getByRole('button', { name: '查看身份' });
  expect(document.activeElement).toBe(fallback);
  await user.click(fallback);
  expect(onComplete).toHaveBeenCalledOnce();
});

it('paints an opaque backdrop, so the page never shows through behind the reveal', () => {
  render(
    <RoleRevealAnimator
      effectType="tarot"
      role={{ id: 'seer', name: '预言家', alignment: 'god' }}
      onComplete={vi.fn()}
    />,
  );
  // jsdom serialises a translucent colour as rgba(…); an opaque one as rgb(…).
  expect(getComputedStyle(screen.getByRole('dialog')).backgroundColor).toBe('rgb(0, 0, 0)');
});
