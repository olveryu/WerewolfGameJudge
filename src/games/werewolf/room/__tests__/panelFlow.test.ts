import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  buildPanelFlowSteps,
  EMPTY_PANEL_FLOW_PROGRESS,
  PANEL_FLOW_SHARE_HINT,
  type PanelFlowProgress,
  resolvePanelFlowCurrentStep,
  resolvePanelFlowHint,
} from '../panelFlow';

const INFO_CONFIRMED: PanelFlowProgress = {
  lastNightInfoConfirmed: true,
  nightReviewOpened: false,
};
const DONE: PanelFlowProgress = { lastNightInfoConfirmed: true, nightReviewOpened: true };

describe('resolvePanelFlowCurrentStep', () => {
  it('Day starts at the last-night info step', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS)).toBe(
      'lastNightInfo',
    );
  });

  it('Day pauses once the info is confirmed (phase actions resume)', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, INFO_CONFIRMED)).toBeNull();
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, DONE)).toBeNull();
  });

  it('Ended walks info → review → closing', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS)).toBe(
      'lastNightInfo',
    );
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED)).toBe('nightReview');
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, DONE)).toBe('closing');
  });

  it('Day progress carries into Ended: a confirmed info step is never re-asked', () => {
    // Same progress record, status flips Day → Ended mid-game
    // (e.g. a wolf self-detonates during the day).
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED)).toBe('nightReview');
  });

  it('does not apply outside Day/Ended', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)).toBeNull();
    expect(resolvePanelFlowCurrentStep(GameStatus.Assigned, EMPTY_PANEL_FLOW_PROGRESS)).toBeNull();
  });
});

describe('buildPanelFlowSteps', () => {
  const onOpenLastNightInfo = jest.fn();
  const onOpenNightReview = jest.fn();
  const build = (roomStatus: GameStatus, progress: PanelFlowProgress) =>
    buildPanelFlowSteps({ roomStatus, progress, onOpenLastNightInfo, onOpenNightReview });

  it('labels the three steps in order', () => {
    const steps = build(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS);
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '本局复盘', '收尾']);
  });

  it('marks states and only wires presses for complete/current steps', () => {
    const steps = build(GameStatus.Ended, INFO_CONFIRMED);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current', 'upcoming']);
    expect(steps?.[0]?.onPress).toBe(onOpenLastNightInfo);
    expect(steps?.[1]?.onPress).toBe(onOpenNightReview);
    expect(steps?.[2]?.onPress).toBeUndefined();
  });

  it('the closing step itself is never a step-bar press', () => {
    const steps = build(GameStatus.Ended, DONE);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'complete', 'current']);
    expect(steps?.[2]?.onPress).toBeUndefined();
  });

  it('returns null outside Day/Ended', () => {
    expect(build(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)).toBeNull();
  });
});

describe('resolvePanelFlowHint', () => {
  it('reminds the host to share the review while the review step is current at Ended', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: INFO_CONFIRMED,
      }),
    ).toBe(PANEL_FLOW_SHARE_HINT);
    expect(PANEL_FLOW_SHARE_HINT).toBe('记得把复盘分享给第一天出局的玩家');
  });

  it('never shows for non-hosts, other steps, or during Day', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: false,
        progress: INFO_CONFIRMED,
      }),
    ).toBeNull();
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: EMPTY_PANEL_FLOW_PROGRESS,
      }),
    ).toBeNull();
    expect(
      resolvePanelFlowHint({ roomStatus: GameStatus.Day, isHost: true, progress: INFO_CONFIRMED }),
    ).toBeNull();
  });
});
