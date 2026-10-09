/** GalleryPlaybackControls contract: shared playback bar shape; command assembly stays with the game. */
import { fireEvent, render } from '@testing-library/react-native';

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
    onRewind: jest.fn(),
    onAdvance: jest.fn(),
    onTogglePlay: jest.fn(),
    onFinish: jest.fn(),
  };
}

describe('GalleryPlaybackControls', () => {
  it('dispatches rewind, advance, toggle and finish', () => {
    const h = handlers();
    const view = render(<GalleryPlaybackControls {...baseProps} {...h} />);

    fireEvent.press(view.getByLabelText('上一项'));
    fireEvent.press(view.getByLabelText('下一项'));
    // Playing state shows the pause action.
    fireEvent.press(view.getByLabelText('暂停'));
    fireEvent.press(view.getByText('全部揭晓'));
    expect(h.onRewind).toHaveBeenCalledTimes(1);
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
    expect(h.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(h.onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows the play action when paused and hides the toggle when autoplay is unavailable', () => {
    const h = handlers();
    const paused = render(<GalleryPlaybackControls {...baseProps} {...h} isPlaying={false} />);
    expect(paused.getByLabelText('播放')).toBeVisible();
    expect(paused.queryByLabelText('暂停')).toBeNull();

    const noToggle = render(
      <GalleryPlaybackControls {...baseProps} {...h} canTogglePlay={false} />,
    );
    expect(noToggle.queryByLabelText('暂停')).toBeNull();
    expect(noToggle.queryByLabelText('播放')).toBeNull();
  });

  it('switches advance to a primary text button in primary form and forwards its testID', () => {
    const h = handlers();
    const view = render(
      <GalleryPlaybackControls
        {...baseProps}
        {...h}
        advanceForm="primary"
        advanceLabel="结束揭晓"
        advanceTestID="gallery-advance"
      />,
    );
    expect(view.getByText('结束揭晓')).toBeVisible();
    fireEvent.press(view.getByTestId('gallery-advance'));
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });

  it('blocks rewind on the first item and blocks everything while submitting', () => {
    const h = handlers();
    const first = render(<GalleryPlaybackControls {...baseProps} {...h} isFirst />);
    fireEvent.press(first.getByLabelText('上一项'));
    expect(h.onRewind).not.toHaveBeenCalled();

    const busy = render(<GalleryPlaybackControls {...baseProps} {...h} isSubmitting />);
    fireEvent.press(busy.getByLabelText('上一项'));
    fireEvent.press(busy.getByLabelText('下一项'));
    fireEvent.press(busy.getByLabelText('暂停'));
    fireEvent.press(busy.getByText('全部揭晓'));
    expect(h.onRewind).not.toHaveBeenCalled();
    expect(h.onAdvance).not.toHaveBeenCalled();
    expect(h.onTogglePlay).not.toHaveBeenCalled();
    expect(h.onFinish).not.toHaveBeenCalled();
  });
});
