/** GalleryPagerControls contract: icon pager + standalone position text; paging state stays with the game. */
import { fireEvent, render } from '@testing-library/react-native';

import { GalleryPagerControls } from '../GalleryPagerControls';

const baseProps = {
  total: 5,
  prevLabel: '上一本',
  nextLabel: '下一本',
};

describe('GalleryPagerControls', () => {
  it('renders the standalone position text and dispatches both directions', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const view = render(
      <GalleryPagerControls {...baseProps} current={2} onPrev={onPrev} onNext={onNext} />,
    );

    expect(view.getByText('3 / 5')).toBeVisible();
    fireEvent.press(view.getByLabelText('上一本'));
    fireEvent.press(view.getByLabelText('下一本'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables prev on the first page and next on the last page', () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const first = render(
      <GalleryPagerControls {...baseProps} current={0} onPrev={onPrev} onNext={onNext} />,
    );
    fireEvent.press(first.getByLabelText('上一本'));
    expect(onPrev).not.toHaveBeenCalled();
    fireEvent.press(first.getByLabelText('下一本'));
    expect(onNext).toHaveBeenCalledTimes(1);

    const last = render(
      <GalleryPagerControls {...baseProps} current={4} onPrev={onPrev} onNext={onNext} />,
    );
    fireEvent.press(last.getByLabelText('下一本'));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.press(last.getByLabelText('上一本'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });
});
