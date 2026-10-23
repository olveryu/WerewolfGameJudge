/** Share progress presentation: real band counts while generating, an honest spinner while uploading. */
import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';

import { ShareProgressModal } from '../ShareProgressModal';

describe('ShareProgressModal', () => {
  it('shows the generating phase with the capture band count and a progress bar', () => {
    const view = render(
      <ShareProgressModal
        run={{ phase: 'capturing', progress: { done: 1, total: 3 } }}
        onCancel={jest.fn()}
      />,
    );
    expect(view.getByTestId(TESTIDS.shareProgressModal)).toBeTruthy();
    expect(view.getByText('生成中 1/3 段')).toBeTruthy();
    expect(view.getByRole('progressbar').props.accessibilityValue).toEqual({
      now: 1,
      min: 0,
      max: 3,
    });
  });

  it('shows a plain generating label before the first band is reported', () => {
    const view = render(
      <ShareProgressModal run={{ phase: 'capturing', progress: null }} onCancel={jest.fn()} />,
    );
    expect(view.getByText('生成中…')).toBeTruthy();
    expect(view.queryByRole('progressbar')).toBeNull();
  });

  it('shows the uploading phase without inventing a progress number', () => {
    const view = render(<ShareProgressModal run={{ phase: 'uploading' }} onCancel={jest.fn()} />);
    expect(view.getByText('正在上传…')).toBeTruthy();
    expect(view.queryByRole('progressbar')).toBeNull();
  });

  it('reports cancellation from the cancel button', () => {
    const onCancel = jest.fn();
    const view = render(<ShareProgressModal run={{ phase: 'uploading' }} onCancel={onCancel} />);
    fireEvent.press(view.getByRole('button', { name: '取消分享' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
