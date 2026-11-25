import { formatStepCompletion } from '../formatStepCompletion';

const BASE = { isActor: true, deadlineMs: null, nowMs: 0 } as const;

describe('formatStepCompletion', () => {
  it('counts viewers of a shared view step and stays silent for a single viewer', () => {
    expect(
      formatStepCompletion({
        ...BASE,
        progressKind: 'confirmation',
        progress: { done: 3, total: 12 },
      }),
    ).toBe('已查看 3/12');
    expect(
      formatStepCompletion({
        ...BASE,
        progressKind: 'confirmation',
        progress: { done: 0, total: 1 },
      }),
    ).toBeNull();
  });

  it('counts votes, then shows the settle countdown once every vote is in', () => {
    const vote = { ...BASE, progressKind: 'vote', progress: { done: 2, total: 3 } } as const;

    expect(formatStepCompletion(vote)).toBe('已投 2/3');
    expect(formatStepCompletion({ ...vote, deadlineMs: 5000, nowMs: 100 })).toBe(
      '已全部投票，5 秒后结算（可改票或撤回）',
    );
  });

  it('says nothing to a non-actor or for a step without shared progress', () => {
    const progress = { done: 1, total: 3 };

    expect(
      formatStepCompletion({ ...BASE, isActor: false, progressKind: 'vote', progress }),
    ).toBeNull();
    expect(formatStepCompletion({ ...BASE, progressKind: null, progress })).toBeNull();
  });
});
