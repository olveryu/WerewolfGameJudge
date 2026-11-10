/** Room task frame contract: no scrolling container, footer pinned, caps declared per game. */

import { render, screen, within } from '@testing-library/react';

import { RoomTaskFrame } from '../RoomTaskFrame';

describe('RoomTaskFrame', () => {
  it('renders header, body and footer', () => {
    render(
      <RoomTaskFrame header={<h2>任务标题</h2>} footer={<p>底部操作</p>} maxWidth={430}>
        <textarea value="" readOnly aria-label="任务输入" />
        <p>任务内容</p>
      </RoomTaskFrame>,
    );
    expect(screen.getByText('任务标题')).toBeVisible();
    expect(screen.getByText('任务内容')).toBeVisible();
    expect(screen.getByText('底部操作')).toBeVisible();
    expect(screen.getByRole('textbox', { name: '任务输入' })).toBeVisible();
  });

  it('applies the test id, the game-declared max width and the geometry class', () => {
    render(
      <RoomTaskFrame
        header={<h2>任务标题</h2>}
        footer={null}
        maxWidth={800}
        testId="task-frame"
        className="game-task"
      >
        <p>任务内容</p>
      </RoomTaskFrame>,
    );
    const column = screen.getByTestId('task-frame');
    expect(within(column).getByText('任务标题')).toBeVisible();
    expect(within(column).getByText('任务内容')).toBeVisible();
    expect(column).toHaveStyle({ maxWidth: '800px' });
    expect(column).toHaveClass('room-task-frame', 'game-task');
  });

  it('omits the footer wrapper when the footer is null', () => {
    const { container } = render(
      <RoomTaskFrame header={<h2>任务标题</h2>} footer={null} maxWidth={430}>
        <p>任务内容</p>
      </RoomTaskFrame>,
    );
    expect(container.querySelector('.room-task-frame-footer')).toBeNull();
    expect(screen.getByText('任务内容')).toBeVisible();
  });
});
