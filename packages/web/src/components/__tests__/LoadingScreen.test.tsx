import { fireEvent, render, screen } from '@testing-library/react';

import { LoadingScreen } from '@/components/LoadingScreen';

describe('LoadingScreen', () => {
  it('announces 加载中 under the app icon when the caller gives no message', () => {
    render(<LoadingScreen />);

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('presentation')).toHaveClass('loading-screen-icon');
    expect(screen.getByRole('status')).toHaveTextContent('加载中');
  });

  it('announces the caller message instead of the default', () => {
    render(<LoadingScreen message="正在加载音频" />);

    expect(screen.getByRole('status')).toHaveTextContent('正在加载音频');
    expect(screen.queryByText('加载中')).not.toBeInTheDocument();
  });

  it('keeps the icon and offers retry and an outlined back action on error', () => {
    const handleRetry = vi.fn();
    const handleBack = vi.fn();
    render(<LoadingScreen error="加载失败" onRetry={handleRetry} onBack={handleBack} />);

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('presentation')).toHaveClass('loading-screen-icon');
    expect(screen.getByRole('alert')).toHaveTextContent('加载失败');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    const backButton = screen.getByRole('button', { name: '返回首页' });
    expect(backButton).toHaveAttribute('data-variant', 'outline');
    fireEvent.click(backButton);

    expect(handleRetry).toHaveBeenCalledOnce();
    expect(handleBack).toHaveBeenCalledOnce();
  });
});
