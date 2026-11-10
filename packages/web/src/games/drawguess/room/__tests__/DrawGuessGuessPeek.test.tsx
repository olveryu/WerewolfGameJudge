/** 窄屏猜词摘要条与猜中提示：最近两条、条数、打开完整记录；猜中提示只为新猜中弹出并自动消失。 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TESTIDS } from '@/testids';

import { DrawGuessCorrectToast } from '../components/DrawGuessCorrectToast';
import type { DrawGuessGuessMessage } from '../components/DrawGuessGuessLog';
import { DrawGuessGuessPeek } from '../components/DrawGuessGuessPeek';

const guess = (seat: number, text: string | null, at: number, correct = false) =>
  ({ seat, displayName: `玩家${seat + 1}`, text, correct, at }) satisfies DrawGuessGuessMessage;

const MESSAGES: readonly DrawGuessGuessMessage[] = [
  guess(1, '熊', 1),
  guess(2, '猫', 2),
  guess(3, null, 3, true),
];

describe('DrawGuessGuessPeek', () => {
  it('shows the last two guesses and the total, and announces the newest one', () => {
    render(<DrawGuessGuessPeek messages={MESSAGES} viewerSeat={1} />);
    const peek = screen.getByTestId(TESTIDS.drawGuessGuessPeek);
    expect(peek).toHaveAccessibleName('查看全部猜词记录，共 3 条');
    expect(peek).toHaveAttribute('aria-haspopup', 'dialog');
    expect(peek).toHaveTextContent('玩家3：猫🎯 玩家4 猜中了3 条');
    expect(peek).not.toHaveTextContent('熊');
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('🎯 玩家4 猜中了');
  });

  it('reads 还没有人猜 before the first guess', () => {
    render(<DrawGuessGuessPeek messages={[]} viewerSeat={1} />);
    expect(screen.getByTestId(TESTIDS.drawGuessGuessPeek)).toHaveTextContent('还没有人猜0 条');
  });

  it('opens every guess in the log sheet and closes it', async () => {
    const user = userEvent.setup();
    render(<DrawGuessGuessPeek messages={MESSAGES} viewerSeat={3} />);
    await user.click(screen.getByTestId(TESTIDS.drawGuessGuessPeek));

    const sheet = await screen.findByTestId(TESTIDS.drawGuessGuessLogSheet);
    expect(within(sheet).getByRole('heading', { name: '猜词记录3 条' })).toBeInTheDocument();
    const log = within(sheet).getByRole('list', { name: '猜词消息' });
    expect(
      within(log)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['玩家2：熊', '玩家3：猫', '🎉 你猜中了！']);

    await user.click(within(sheet).getByRole('button', { name: '关闭猜词记录' }));
    await waitFor(() =>
      expect(screen.queryByTestId(TESTIDS.drawGuessGuessLogSheet)).not.toBeInTheDocument(),
    );
  });
});

describe('DrawGuessCorrectToast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays silent for correct guesses that happened before it mounted', () => {
    const { container } = render(<DrawGuessCorrectToast messages={MESSAGES} viewerSeat={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a new correct guess briefly', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <DrawGuessCorrectToast messages={MESSAGES.slice(0, 2)} viewerSeat={1} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<DrawGuessCorrectToast messages={MESSAGES} viewerSeat={1} />);
    expect(container).toHaveTextContent('玩家4 猜中了！');

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('congratulates the viewer on their own hit', () => {
    const { container, rerender } = render(<DrawGuessCorrectToast messages={[]} viewerSeat={3} />);
    rerender(<DrawGuessCorrectToast messages={MESSAGES} viewerSeat={3} />);
    expect(container).toHaveTextContent('你猜中了！');
  });
});
