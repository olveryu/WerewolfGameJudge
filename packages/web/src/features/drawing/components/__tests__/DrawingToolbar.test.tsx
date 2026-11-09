/** DrawingToolbar: tool, colour and width panels, recent colours, and disabled gating. */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DrawingToolbar, type DrawingToolbarProps } from '../DrawingToolbar';

const PALETTE = [
  { value: '#000000', name: '黑色' },
  { value: '#FF0000', name: '红色' },
];

function renderToolbar(overrides: Partial<DrawingToolbarProps> = {}) {
  const props: DrawingToolbarProps = {
    tool: 'brush',
    color: '#000000',
    strokeWidth: 6,
    canUndo: true,
    disabled: false,
    palette: PALETTE,
    widths: [3, 6, 12],
    onToolChange: vi.fn(),
    onColorChange: vi.fn(),
    onWidthChange: vi.fn(),
    onUndo: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  const view = render(<DrawingToolbar {...props} />);
  return { props, ...view };
}

describe('DrawingToolbar', () => {
  it('chooses a tool from the tool panel and closes it', async () => {
    const user = userEvent.setup();
    const { props } = renderToolbar();
    await user.click(screen.getByRole('button', { name: '选择工具，当前画笔' }));
    await user.click(await screen.findByRole('button', { name: '矩形' }));

    expect(props.onToolChange).toHaveBeenCalledWith('rectangle');
    await waitFor(() => expect(screen.queryByText('绘画工具')).not.toBeInTheDocument());
  });

  it('forwards clear only when there is something to clear', async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderToolbar({ canUndo: false });
    await user.click(screen.getByRole('button', { name: '选择工具，当前画笔' }));
    expect(await screen.findByRole('button', { name: '清空画布' })).toBeDisabled();

    rerender(<DrawingToolbar {...props} canUndo />);
    await user.click(screen.getByRole('button', { name: '清空画布' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('chooses a preset colour and a stroke width', async () => {
    const user = userEvent.setup();
    const { props } = renderToolbar();
    await user.click(screen.getByRole('button', { name: '选择颜色，当前黑色' }));
    await user.click(await screen.findByTestId('drawing-toolbar-color-红色'));
    expect(props.onColorChange).toHaveBeenCalledWith('#FF0000');

    await user.click(screen.getByRole('button', { name: '选择粗细，当前 6 像素' }));
    await user.click(await screen.findByTestId('drawing-toolbar-width-12'));
    expect(props.onWidthChange).toHaveBeenCalledWith(12);
  });

  it('remembers a custom colour as a recent colour once its panel closes', async () => {
    const user = userEvent.setup();
    const { props } = renderToolbar({ color: '#123456' });
    const colorButton = screen.getByRole('button', { name: '选择颜色，当前自定义颜色' });
    await user.click(colorButton);
    expect(await screen.findByRole('heading', { name: '颜色' })).toBeInTheDocument();
    expect(screen.queryByText('最近使用')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭选择面板' }));
    await waitFor(() => expect(screen.queryByText('最近使用')).not.toBeInTheDocument());

    await user.click(colorButton);
    await user.click(await screen.findByRole('button', { name: '最近颜色 1' }));
    expect(props.onColorChange).toHaveBeenCalledWith('#123456');
  });

  it('offers redo only when the game supports it', () => {
    const { rerender, props } = renderToolbar();
    expect(screen.queryByRole('button', { name: '重做' })).not.toBeInTheDocument();
    rerender(<DrawingToolbar {...props} canRedo={false} onRedo={vi.fn()} />);
    expect(screen.getByRole('button', { name: '重做' })).toBeDisabled();
  });

  it('disables every control while drawing is disabled', () => {
    renderToolbar({ disabled: true, onRedo: vi.fn(), canRedo: true });
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
