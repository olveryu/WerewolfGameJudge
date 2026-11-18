import { DEFAULT_PICTIONARY_CONFIG } from '@game-judge/game-engine/games/pictionary/public';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PictionaryRoomSummary } from '../PictionaryRoomSummary';

describe('PictionaryRoomSummary', () => {
  it.each([
    { duration: 60, expected: '60 秒' },
    { duration: null, expected: '不限时' },
  ] as const)(
    'keeps occupancy visible when the $expected setting is collapsed',
    async ({ duration, expected }) => {
      const user = userEvent.setup();
      render(
        <PictionaryRoomSummary
          guide={{ onPress: vi.fn(), label: '查看你画我猜接龙玩法' }}
          config={{
            ...DEFAULT_PICTIONARY_CONFIG,
            numberOfPlayers: 8,
            drawingDurationSeconds: duration,
          }}
          occupiedSeatCount={5}
        />,
      );
      expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
        '总棒数',
        '绘画时限',
        '文字时限',
        '每棒间隔',
        '揭晓停留',
      ]);
      expect(screen.getAllByRole('definition').map((definition) => definition.textContent)).toEqual(
        ['8 棒', expected, '45 秒', '5 秒', '5 秒'],
      );
      await user.click(screen.getByRole('button', { name: '收起配置' }));
      expect(screen.queryByRole('definition')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('5/8 人就座');
    },
  );

  it('labels an unlimited gallery as manual paging', () => {
    render(
      <PictionaryRoomSummary
        guide={{ onPress: vi.fn(), label: '查看你画我猜接龙玩法' }}
        config={{
          ...DEFAULT_PICTIONARY_CONFIG,
          galleryItemDurationSeconds: null,
        }}
        occupiedSeatCount={4}
      />,
    );

    expect(screen.getByText('揭晓停留').nextElementSibling).toHaveTextContent('手动翻页');
  });
});
