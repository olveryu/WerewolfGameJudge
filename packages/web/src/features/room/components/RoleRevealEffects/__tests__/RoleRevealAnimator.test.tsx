import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { debugLogStore } from '@/utils/debugLogStore';

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
  const addLog = vi.spyOn(debugLogStore, 'addLog');
  await user.click(fallback);
  expect(onComplete).toHaveBeenCalledOnce();
  // The skip is logged with its reason, next to the `[Scene]` loss that caused it.
  const reason = JSON.stringify({ effectType: 'tarot', reason: 'sceneUnavailable' });
  expect(
    addLog.mock.calls.filter(
      ([line]) =>
        line.includes('[RoleReveal]') && line.includes('fallback button') && line.includes(reason),
    ),
  ).toHaveLength(1);
  addLog.mockRestore();
});
