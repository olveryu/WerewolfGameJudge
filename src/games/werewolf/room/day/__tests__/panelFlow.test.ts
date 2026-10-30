import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  buildPanelFlowSteps,
  EMPTY_PANEL_FLOW_PROGRESS,
  PANEL_FLOW_ACTION_KEYS,
  PANEL_FLOW_SHARE_HINT,
  type PanelFlowProgress,
  resolvePanelFlowCurrentStep,
} from '@/games/werewolf/room/day/panelFlow';

const INFO_CONFIRMED: PanelFlowProgress = {
  lastNightInfoConfirmed: true,
  nightReviewOpened: false,
};
const REVIEW_OPENED: PanelFlowProgress = { lastNightInfoConfirmed: true, nightReviewOpened: true };

const flow = (roomStatus: GameStatus, progress: PanelFlowProgress, reviewShared = false) => ({
  roomStatus,
  progress,
  reviewShared,
});

describe('resolvePanelFlowCurrentStep', () => {
  it('Day starts at the last-night info step', () => {
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS))).toBe(
      'lastNightInfo',
    );
  });

  it('Day pauses once the info is confirmed (the election task takes over)', () => {
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Day, INFO_CONFIRMED))).toBeNull();
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Day, REVIEW_OPENED))).toBeNull();
  });

  it('Day progress carries into Ended: a confirmed info step is never re-asked', () => {
    // Same progress record, status flips Day → Ended mid-game
    // (e.g. a wolf self-detonates during the day).
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED))).toBe('nightReview');
  });

  it('does not apply outside Day/Ended', () => {
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Assigned, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
  });

  describe('share gate (engine-driven: reviewShared = a seat was shared the review)', () => {
    it('stays on the review step until the host has both opened and shared', () => {
      expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED))).toBe(
        'nightReview',
      );
      // Opened alone does not complete the step.
      expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, REVIEW_OPENED))).toBe(
        'nightReview',
      );
      // Shared alone does not complete it either: the step is the
      // review itself, so it still has to be opened.
      expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED, true))).toBe(
        'nightReview',
      );
      expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, REVIEW_OPENED, true))).toBe(
        'closing',
      );
    });
  });
});

describe('buildPanelFlowSteps', () => {
  it('labels the three steps in order', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS));
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '本局复盘', '收尾']);
  });

  it('marks states and references the info/review sheet actions; closing has no action', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, INFO_CONFIRMED));
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current', 'upcoming']);
    expect(steps?.map((step) => step.actionKey)).toEqual([
      PANEL_FLOW_ACTION_KEYS.lastNightInfo,
      PANEL_FLOW_ACTION_KEYS.nightReview,
      undefined,
    ]);
  });

  it('the closing step becomes current once the review was opened and shared', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, REVIEW_OPENED, true));
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'complete', 'current']);
  });

  it('an opened-but-unshared review is still the current step, not complete', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, REVIEW_OPENED));
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current', 'upcoming']);
  });

  it('returns null outside Day/Ended and on Day once the info is confirmed', () => {
    expect(buildPanelFlowSteps(flow(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS))).toBeNull();
    expect(buildPanelFlowSteps(flow(GameStatus.Day, INFO_CONFIRMED))).toBeNull();
  });

  it('exposes the share reminder copy', () => {
    expect(PANEL_FLOW_SHARE_HINT).toBe('记得把复盘分享给第一天出局的玩家');
  });
});
