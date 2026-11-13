import { render, screen } from '@testing-library/react';

import type { RoomBottomStackModel } from '@/features/room/model/RoomBottomActions';

import { RoomBottomActionPanel } from '../RoomBottomActionPanel';

describe('RoomBottomActionPanel', () => {
  it('gives the step progress bar an accessible name from its visible labels', () => {
    const model: RoomBottomStackModel = {
      kind: 'stacked',
      message: null,
      progress: { current: 2, total: 5, label: '女巫行动' },
      layout: { primary: [], secondary: [], ghost: [] },
    };

    render(
      <RoomBottomActionPanel
        model={model}
        isAudioPlaying={false}
        hostManagement={null}
        onOpenHostManagement={vi.fn()}
      />,
    );

    expect(screen.getByRole('progressbar', { name: '第2步 / 共5步 女巫行动' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
  });
});
