import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  EMPTY_PANEL_FLOW_PROGRESS,
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

  it('keeps a completed review complete when access is revoked and restored', () => {
    const completed = { ...INFO_CONFIRMED, reviewCompleted: true };
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, completed, true))).toBeNull();
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, completed))).toBe('grantReview');
    expect(resolvePanelFlowCurrentStep(flow(GameStatus.Ended, completed, true))).toBeNull();
  });
});
