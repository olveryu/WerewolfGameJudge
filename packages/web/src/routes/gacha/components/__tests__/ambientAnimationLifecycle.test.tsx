/** The ambient loops (draw-button shimmer, near-pity pulse) stop when they no longer apply. */
import { render, screen } from '@testing-library/react';

import { DrawButton } from '../DrawButton';
import { PityProgressBar } from '../PityProgressBar';

describe('gacha ambient animation lifecycle', () => {
  it('removes the draw-button shimmer when the button becomes disabled', () => {
    const { rerender } = render(
      <DrawButton
        label="抽 ×10"
        disabled={false}
        onPress={vi.fn()}
        reducedMotion={false}
        isAnimationActive
      />,
    );
    expect(screen.getByTestId('draw-button-shimmer')).toBeInTheDocument();

    rerender(
      <DrawButton
        label="抽 ×10"
        disabled
        onPress={vi.fn()}
        reducedMotion={false}
        isAnimationActive
      />,
    );

    expect(screen.queryByTestId('draw-button-shimmer')).toBeNull();
  });

  it('stops the pity pulse when the app goes to the background', () => {
    const { rerender } = render(
      <PityProgressBar pity={8} threshold={10} reducedMotion={false} isAnimationActive />,
    );
    expect(screen.getByTestId('pity-bar-fill')).toHaveAttribute('data-pulse', 'true');

    rerender(
      <PityProgressBar pity={8} threshold={10} reducedMotion={false} isAnimationActive={false} />,
    );

    expect(screen.getByTestId('pity-bar-fill')).toHaveAttribute('data-pulse', 'false');
  });
});
