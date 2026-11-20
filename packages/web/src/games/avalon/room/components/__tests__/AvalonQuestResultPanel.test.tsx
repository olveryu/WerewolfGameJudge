/** 任务结算面板：结论横幅、成功/失败牌数及确认。 */

import type { AvalonQuestHistoryView } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react';

import { AvalonQuestResultPanel } from '../AvalonQuestResultPanel';

const ENTRY: AvalonQuestHistoryView = {
  round: 2,
  leaderSeat: 0,
  teamSeats: [0, 1, 2],
  ballots: null,
  approveCount: 5,
  rejectCount: 0,
  abstainCount: 0,
  automatic: false,
  result: 'fail',
  successCount: 2,
  failCount: 1,
};

function renderPanel(entry: AvalonQuestHistoryView = ENTRY) {
  const utils = render(<AvalonQuestResultPanel entry={entry} remainingSeconds={3} />);
  return utils;
}

describe('AvalonQuestResultPanel', () => {
  it('shows the failure banner with the round and the card counts', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('avalon-quest-result-banner')).toHaveTextContent('第 2 轮 · 任务失败');
    expect(getByTestId('avalon-quest-result-counts')).toHaveTextContent('成功牌 2 · 失败牌 1');
  });

  it('shows the banner artwork above the banner text', () => {
    const { getByTestId } = renderPanel();
    const image = getByTestId('avalon-quest-result-banner-image');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('src')).toBeTruthy();
  });

  it('uses different banner artwork for success and failure', () => {
    const failed = renderPanel();
    const failedSrc = failed.getByTestId('avalon-quest-result-banner-image').getAttribute('src');
    failed.unmount();
    const succeeded = renderPanel({
      ...ENTRY,
      result: 'success',
      failCount: 0,
      successCount: 3,
    });
    const succeededSrc = succeeded
      .getByTestId('avalon-quest-result-banner-image')
      .getAttribute('src');
    expect(failedSrc).toBeTruthy();
    expect(succeededSrc).toBeTruthy();
    expect(succeededSrc).not.toBe(failedSrc);
  });

  it('shows the success banner when the quest succeeded', () => {
    const { getByTestId } = renderPanel({
      ...ENTRY,
      result: 'success',
      failCount: 0,
      successCount: 3,
    });
    expect(getByTestId('avalon-quest-result-banner')).toHaveTextContent('第 2 轮 · 任务成功');
  });

  it('shows the remaining time without a dismiss action', () => {
    const panel = renderPanel();
    expect(panel.getByText('3 秒后继续')).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel.getByTestId('avalon-quest-result-panel')).toBeVisible();
    expect(panel.queryByRole('button', { name: '知道了' })).toBeNull();
  });
});
