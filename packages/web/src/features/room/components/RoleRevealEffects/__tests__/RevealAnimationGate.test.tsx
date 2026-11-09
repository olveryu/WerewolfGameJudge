import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { RevealAnimationGate } from '../RevealAnimationGate';
import type { RoleRevealAnimatorProps } from '../types';

const animatorProps = vi.fn<(props: RoleRevealAnimatorProps) => void>();

vi.mock('../RoleRevealAnimator', () => ({
  RoleRevealAnimator: (props: RoleRevealAnimatorProps) => {
    animatorProps(props);
    return (
      <button type="button" onClick={props.onComplete}>
        {`animating ${props.role.id} with ${props.effectType}`}
      </button>
    );
  },
}));

const role: RevealRoleData = { id: 'seer', name: '预言家', alignment: 'god' };

function gate(overrides: Partial<ComponentProps<typeof RevealAnimationGate>> = {}) {
  return (
    <RevealAnimationGate visible effectType="tarot" shouldPlay role={role} {...overrides}>
      <p>static card</p>
    </RevealAnimationGate>
  );
}

describe('RevealAnimationGate', () => {
  beforeEach(() => {
    animatorProps.mockClear();
  });

  it('plays the equipped effect on the first view', async () => {
    render(gate());
    expect(await screen.findByRole('button', { name: 'animating seer with tarot' })).toBeTruthy();
    expect(screen.queryByText('static card')).toBeNull();
    expect(animatorProps).toHaveBeenCalledWith(
      expect.objectContaining({ effectType: 'tarot', role }),
    );
  });

  it('shows the static card without an equipped effect', () => {
    render(gate({ effectType: null }));
    expect(screen.getByText('static card')).toBeTruthy();
    expect(animatorProps).not.toHaveBeenCalled();
  });

  it('shows the static card once the reveal is on record', () => {
    render(gate({ shouldPlay: false }));
    expect(screen.getByText('static card')).toBeTruthy();
    expect(animatorProps).not.toHaveBeenCalled();
  });

  it('switches to the static card when the effect completes and notifies once', async () => {
    const onPlayComplete = vi.fn();
    render(gate({ onPlayComplete }));
    await userEvent.click(await screen.findByRole('button'));
    expect(screen.getByText('static card')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(onPlayComplete).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates after close, so reopening plays again while the server allows it', async () => {
    const view = render(gate());
    await userEvent.click(await screen.findByRole('button'));
    view.rerender(gate({ visible: false }));
    view.rerender(gate());
    expect(await screen.findByRole('button')).toBeTruthy();
  });
});
