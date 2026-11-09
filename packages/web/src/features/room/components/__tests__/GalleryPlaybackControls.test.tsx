/** GalleryPlaybackControls contract: shared playback bar shape; command assembly stays with the game. */

import { fireEvent, render, screen } from '@testing-library/react';

import { GalleryPlaybackControls } from '../GalleryPlaybackControls';

const baseProps = {
  isPlaying: true,
  canTogglePlay: true,
  isFirst: false,
  isSubmitting: false,
  advanceForm: 'icon' as const,
  advanceLabel: '下一项',
  rewindLabel: '上一项',
  playLabel: '播放',
  pauseLabel: '暂停',
  finishLabel: '全部揭晓',
};

function handlers() {
  return {
    onRewind: vi.fn<() => void>(),
    onAdvance: vi.fn<() => void>(),
    onTogglePlay: vi.fn<() => void>(),
    onFinish: vi.fn<() => void>(),
  };
}

const button = (name: string) => screen.getByRole('button', { name });

describe('GalleryPlaybackControls', () => {
  it('dispatches rewind, advance, toggle and finish', () => {
    const h = handlers();
    render(<GalleryPlaybackControls {...baseProps} {...h} />);
    fireEvent.click(button('上一项'));
    fireEvent.click(button('下一项'));
    // Playing state shows the pause action.
    fireEvent.click(button('暂停'));
    fireEvent.click(button('全部揭晓'));
    expect(h.onRewind).toHaveBeenCalledTimes(1);
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
    expect(h.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(h.onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows the play action when paused and hides the toggle when autoplay is unavailable', () => {
    const h = handlers();
    const paused = render(<GalleryPlaybackControls {...baseProps} {...h} isPlaying={false} />);
    expect(button('播放')).toBeVisible();
    expect(screen.queryByRole('button', { name: '暂停' })).toBeNull();
    paused.unmount();
    render(<GalleryPlaybackControls {...baseProps} {...h} canTogglePlay={false} />);
    expect(screen.queryByRole('button', { name: '暂停' })).toBeNull();
    expect(screen.queryByRole('button', { name: '播放' })).toBeNull();
  });

  it('switches advance to a primary text button in primary form and forwards its test id', () => {
    const h = handlers();
    render(
      <GalleryPlaybackControls
        {...baseProps}
        {...h}
        advanceForm="primary"
        advanceLabel="结束揭晓"
        advanceTestId="gallery-advance"
      />,
    );
    expect(screen.getByTestId('gallery-advance')).toHaveAccessibleName('结束揭晓');
    fireEvent.click(screen.getByTestId('gallery-advance'));
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('blocks rewind on the first item and blocks everything while submitting', () => {
    const h = handlers();
    const first = render(<GalleryPlaybackControls {...baseProps} {...h} isFirst />);
    expect(button('上一项')).toBeDisabled();
    first.unmount();
    render(<GalleryPlaybackControls {...baseProps} {...h} isSubmitting />);
    for (const name of ['上一项', '下一项', '暂停', '全部揭晓']) {
      expect(button(name)).toBeDisabled();
    }
  });
});
