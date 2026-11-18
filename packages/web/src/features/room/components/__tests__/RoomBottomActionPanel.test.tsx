import { render, screen } from '@testing-library/react';

import { RoomBottomActionPanel } from '../RoomBottomActionPanel';

it('keeps a game summary inside the bottom panel when it has no other content', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: null,
        progress: null,
        layout: { primary: [], secondary: [], ghost: [] },
      }}
      summary={<button type="button">对局记录</button>}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenHostManagement={() => {
        throw new Error('Host management is unavailable');
      }}
    />,
  );

  const panel = screen.getByTestId('bottom-action-panel');
  const summary = screen.getByRole('button', { name: '对局记录' });

  expect(panel).toContainElement(summary);
  expect(summary.parentElement).toHaveClass('bottom-action-summary');
});

it('places the summary before existing progress messages and actions', () => {
  render(
    <RoomBottomActionPanel
      model={{
        kind: 'stacked',
        message: '等待下一阶段',
        progress: null,
        layout: { primary: [], secondary: [], ghost: [] },
      }}
      summary={<button type="button">对局记录</button>}
      isAudioPlaying={false}
      hostManagement={null}
      onOpenHostManagement={() => {
        throw new Error('Host management is unavailable');
      }}
    />,
  );

  const panel = screen.getByTestId('bottom-action-panel');
  const summaryWrapper = panel.firstElementChild;
  const message = screen.getByText('等待下一阶段');

  expect(summaryWrapper).toHaveClass('bottom-action-summary');
  expect(summaryWrapper?.nextElementSibling).toBe(message);
});
