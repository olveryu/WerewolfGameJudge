/**
 * The Story Relay stage shows the shared answering top bar in the
 * answering phase — and no longer shows the old "剩余 X 秒" line or the
 * per-seat progress name list.
 */

import { render, screen } from '@testing-library/react';

import { StoryRelayStage } from '../StoryRelayStage';
import {
  botAnsweringState,
  testSeatModel,
  testSeatView,
  testStageSession,
} from './storyRelayStageFixtures';

describe('StoryRelayStage answering top bar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the top bar with the 82/90 countdown and no old remaining-seconds line', () => {
    const state = botAnsweringState(90);
    // deadlineAt = 1000 + 90_000; at nowMs 9000 the remaining time is 82 seconds.
    expect(state.deadlineAt).toBe(91_000);
    vi.spyOn(Date, 'now').mockReturnValue(9_000);
    const { session, submit } = testStageSession(state);
    const seatModel = testSeatModel(
      (seat) =>
        testSeatView(seat, {
          isBot: true,
          statusBadge:
            seat === 0
              ? { label: '已准备', tone: 'success' }
              : { label: '写作中', tone: 'warning' },
        }),
      null,
    );
    render(
      <StoryRelayStage
        state={state}
        effectiveSeat={null}
        controlledSeat={null}
        userId="host"
        isHost
        canControlBots
        seatModel={seatModel}
        session={session}
        submit={submit}
        isSubmitting={false}
        openReview={vi.fn()}
      />,
    );
    expect(screen.getByTestId('answering-top-bar')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('3人作答中')).toBeInTheDocument();
    expect(screen.getByText(/1已提交/)).toBeInTheDocument();
    expect(screen.queryByText(/剩余/)).not.toBeInTheDocument();
  });
});
