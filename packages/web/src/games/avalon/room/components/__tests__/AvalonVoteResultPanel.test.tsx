/** 投票结算面板：公投/暗投结果和全员确认进度。 */

import type {
  AvalonLastVoteResultView,
  AvalonSeatView,
} from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react';

import { AvalonVoteResultPanel } from '../AvalonVoteResultPanel';

const SEATS = [
  { seat: 0, displayName: '阿明', isBot: false, isLeader: true, role: null },
  { seat: 1, displayName: '小红', isBot: false, isLeader: false, role: null },
  { seat: 2, displayName: '机器人3号', isBot: true, isLeader: false, role: null },
  { seat: 3, displayName: '阿强', isBot: false, isLeader: false, role: null },
] as AvalonSeatView[];

const REJECTED_RESULT: AvalonLastVoteResultView = {
  approved: false,
  rejectStreak: 2,
  ballots: { 0: 'approve', 1: 'reject', 2: 'reject' },
  approveCount: 1,
  rejectCount: 2,
  abstainCount: 1,
};

function renderPanel(
  result: AvalonLastVoteResultView = REJECTED_RESULT,
  seats: readonly AvalonSeatView[] = SEATS,
) {
  const utils = render(
    <AvalonVoteResultPanel result={result} seats={seats} remainingSeconds={4} />,
  );
  return utils;
}

describe('AvalonVoteResultPanel', () => {
  it('shows the rejection banner with the streak count', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('avalon-vote-result-banner')).toHaveTextContent('组队被否决·第 2 次');
  });

  it('shows the banner artwork above the banner text', () => {
    const { getByTestId } = renderPanel();
    const image = getByTestId('avalon-vote-result-banner-image');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('src')).toBeTruthy();
  });

  it('uses different banner artwork for approval and rejection', () => {
    const approved = renderPanel({ ...REJECTED_RESULT, approved: true, rejectStreak: 0 });
    const approvedSrc = approved.getByTestId('avalon-vote-result-banner-image').getAttribute('src');
    approved.unmount();
    const rejectedSrc = renderPanel()
      .getByTestId('avalon-vote-result-banner-image')
      .getAttribute('src');
    expect(approvedSrc).toBeTruthy();
    expect(rejectedSrc).toBeTruthy();
    expect(approvedSrc).not.toBe(rejectedSrc);
  });

  it('shows the approval banner when the team passed', () => {
    const { getByTestId } = renderPanel({ ...REJECTED_RESULT, approved: true, rejectStreak: 0 });
    expect(getByTestId('avalon-vote-result-banner')).toHaveTextContent('组队通过');
  });

  it('lists every seat with its ballot in public mode, abstainers included', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('avalon-vote-result-row-0')).toHaveTextContent('1号 阿明 · 赞成');
    expect(getByTestId('avalon-vote-result-row-1')).toHaveTextContent('2号 小红 · 反对');
    expect(getByTestId('avalon-vote-result-row-2')).toHaveTextContent('3号 机器人3号 · 反对');
    expect(getByTestId('avalon-vote-result-row-3')).toHaveTextContent('4号 阿强 · 弃权');
    expect(getByTestId('avalon-vote-result-summary')).toHaveTextContent(
      '汇总：赞成 1 · 反对 2 · 弃权 1',
    );
  });

  it('shows only counts in secret mode (D7)', () => {
    const { getByTestId, queryByTestId } = renderPanel({ ...REJECTED_RESULT, ballots: null });
    expect(getByTestId('avalon-vote-result-counts')).toHaveTextContent('赞成 1 · 反对 2 · 弃权 1');
    expect(queryByTestId('avalon-vote-result-row-0')).toBeNull();
  });

  it('displays the timer without a confirmation or dismiss action', () => {
    const { getByTestId, getByText, queryByRole } = renderPanel();
    expect(getByText('4 秒后继续')).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getByTestId('avalon-vote-result-panel')).toBeVisible();
    expect(queryByRole('button', { name: '知道了' })).toBeNull();
  });
});
