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

  it('Ended proceeds to closing after the info step without requiring grants', () => {
    // Same progress record, status flips Day → Ended mid-game
    // (e.g. a wolf self-detonates during the day).
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED))).toBe('closing');
  });

  it('does not apply outside Day/Ended', () => {
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
    expect(
      resolvePanelFlowCurrentStep(flow(GameStatus.Assigned, EMPTY_PANEL_FLOW_PROGRESS)),
    ).toBeNull();
  });

  it('does not make the Ended closing step depend on Day review grants', () => {
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED))).toBe('closing');
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, INFO_CONFIRMED, true))).toBe(
      'closing',
    );
  });
});

describe('buildPanelFlowSteps', () => {
  it('shows the Day guidance steps in order', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS));
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '授权', '收尾']);
  });

  it('omits the no-longer-needed grant step after the game ends', () => {
    const steps = buildPanelFlowSteps(flow(GameStatus.Ended, INFO_CONFIRMED));
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current']);
    expect(steps?.map((step) => step.actionKey)).toEqual([
      PANEL_FLOW_ACTION_KEYS.lastNightInfo,
      undefined,
    ]);
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
