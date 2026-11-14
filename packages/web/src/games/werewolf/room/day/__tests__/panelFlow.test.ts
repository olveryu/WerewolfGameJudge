import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  buildPanelFlowSteps,
  EMPTY_PANEL_FLOW_PROGRESS,
  PANEL_FLOW_ACTION_KEYS,
  type PanelFlowProgress,
  resolvePanelFlowCurrentStep,
} from '@/games/werewolf/room/day/panelFlow';

const INFO_CONFIRMED: PanelFlowProgress = {
  lastNightInfoConfirmed: true,
};

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
  });

  it('Ended continues to granting access after the info step', () => {
    // Same progress record, status flips Day → Ended mid-game
    // (e.g. a wolf self-detonates during the day).
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED))).toBe('grantReview');
  });

  it('does not apply outside Day/Ended', () => {
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Assigned, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
  });

  it('reaches closing only while at least one seat is authorized', () => {
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED, true))).toBe(
      'closing',
    );
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED, false))).toBe(
      'grantReview',
    );
  });
});

describe('buildPanelFlowSteps', () => {
  it('shows the Day guidance steps in order', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS));
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '授权', '收尾']);
  });

  it('keeps the Ended grant step between last-night info and closing', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, INFO_CONFIRMED));
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '授权', '收尾']);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current', 'upcoming']);
    expect(steps?.map((step) => step.actionKey)).toEqual([
      PANEL_FLOW_ACTION_KEYS.lastNightInfo,
      PANEL_FLOW_ACTION_KEYS.grantReview,
      undefined,
    ]);
  });

  it('marks the Ended grant complete when access was already shared during Day', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, INFO_CONFIRMED, true));
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'complete', 'current']);
  });

  it('marks the Day grant step complete only after the host shares access', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS, true));
    expect(steps?.map((step) => step.state)).toEqual(['current', 'complete', 'upcoming']);
  });

  it('returns null outside Day/Ended and on Day once the info is confirmed', () => {
    expect(buildPanelFlowSteps(flow(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS))).toBeNull();
    expect(buildPanelFlowSteps(flow(GameStatus.Day, INFO_CONFIRMED))).toBeNull();
  });
});
