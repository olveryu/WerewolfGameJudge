import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  buildPanelFlowSteps,
  EMPTY_PANEL_FLOW_PROGRESS,
  PANEL_FLOW_SHARE_HINT,
  type PanelFlowProgress,
  type PanelFlowViewer,
  resolvePanelFlowCurrentStep,
  resolvePanelFlowHint,
} from '../panelFlow';

const INFO_CONFIRMED: PanelFlowProgress = {
  lastNightInfoConfirmed: true,
  nightReviewOpened: false,
};
const REVIEW_OPENED: PanelFlowProgress = { lastNightInfoConfirmed: true, nightReviewOpened: true };

const HOST: PanelFlowViewer = { role: 'host', reviewShared: false, reviewAuthorized: true };
const HOST_SHARED: PanelFlowViewer = { role: 'host', reviewShared: true, reviewAuthorized: true };
const PLAYER: PanelFlowViewer = { role: 'player', reviewShared: false, reviewAuthorized: true };
const PLAYER_UNAUTHORIZED: PanelFlowViewer = {
  role: 'player',
  reviewShared: false,
  reviewAuthorized: false,
};
const SPECTATOR: PanelFlowViewer = {
  role: 'spectator',
  reviewShared: false,
  reviewAuthorized: true,
};

describe('resolvePanelFlowCurrentStep', () => {
  it('Day starts at the last-night info step', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS, PLAYER)).toBe(
      'lastNightInfo',
    );
  });

  it('Day pauses once the info is confirmed (phase actions resume)', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, INFO_CONFIRMED, PLAYER)).toBeNull();
    expect(resolvePanelFlowCurrentStep(GameStatus.Day, REVIEW_OPENED, PLAYER)).toBeNull();
  });

  it('Ended walks info → review → closing for a player (review completes on open)', () => {
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS, PLAYER)).toBe(
      'lastNightInfo',
    );
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED, PLAYER)).toBe(
      'nightReview',
    );
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, REVIEW_OPENED, PLAYER)).toBe('closing');
  });

  it('Day progress carries into Ended: a confirmed info step is never re-asked', () => {
    // Same progress record, status flips Day → Ended mid-game
    // (e.g. a wolf self-detonates during the day).
    expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED, PLAYER)).toBe(
      'nightReview',
    );
  });

  it('does not apply outside Day/Ended', () => {
    expect(
      resolvePanelFlowCurrentStep(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS, PLAYER),
    ).toBeNull();
    expect(
      resolvePanelFlowCurrentStep(GameStatus.Assigned, EMPTY_PANEL_FLOW_PROGRESS, PLAYER),
    ).toBeNull();
  });

  describe('host share gate (engine-driven: reviewShared = a seat was shared the review)', () => {
    it('stays on the review step until the host has both opened and shared', () => {
      expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED, HOST)).toBe(
        'nightReview',
      );
      // Opened alone does not complete the host's step.
      expect(resolvePanelFlowCurrentStep(GameStatus.Ended, REVIEW_OPENED, HOST)).toBe(
        'nightReview',
      );
      // Shared alone does not complete it either: the step is the
      // review itself, so it still has to be opened.
      expect(resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED, HOST_SHARED)).toBe(
        'nightReview',
      );
      expect(resolvePanelFlowCurrentStep(GameStatus.Ended, REVIEW_OPENED, HOST_SHARED)).toBe(
        'closing',
      );
    });
  });

  describe('player without the review shared with them', () => {
    it('skips the review step entirely: info → closing', () => {
      expect(
        resolvePanelFlowCurrentStep(
          GameStatus.Ended,
          EMPTY_PANEL_FLOW_PROGRESS,
          PLAYER_UNAUTHORIZED,
        ),
      ).toBe('lastNightInfo');
      expect(
        resolvePanelFlowCurrentStep(GameStatus.Ended, INFO_CONFIRMED, PLAYER_UNAUTHORIZED),
      ).toBe('closing');
      expect(
        resolvePanelFlowCurrentStep(GameStatus.Ended, REVIEW_OPENED, PLAYER_UNAUTHORIZED),
      ).toBe('closing');
    });
  });

  describe('spectator', () => {
    it('never enters the flow, whatever the progress', () => {
      for (const progress of [EMPTY_PANEL_FLOW_PROGRESS, INFO_CONFIRMED, REVIEW_OPENED]) {
        expect(resolvePanelFlowCurrentStep(GameStatus.Day, progress, SPECTATOR)).toBeNull();
        expect(resolvePanelFlowCurrentStep(GameStatus.Ended, progress, SPECTATOR)).toBeNull();
      }
    });
  });
});

describe('buildPanelFlowSteps', () => {
  const onOpenLastNightInfo = jest.fn();
  const onOpenNightReview = jest.fn();
  const build = (
    roomStatus: GameStatus,
    progress: PanelFlowProgress,
    viewer: PanelFlowViewer = PLAYER,
  ) =>
    buildPanelFlowSteps({ roomStatus, progress, viewer, onOpenLastNightInfo, onOpenNightReview });

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
    const steps = build(GameStatus.Ended, REVIEW_OPENED);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'complete', 'current']);
    expect(steps?.[2]?.onPress).toBeUndefined();
  });

  it('returns null outside Day/Ended', () => {
    expect(build(GameStatus.Ongoing, EMPTY_PANEL_FLOW_PROGRESS)).toBeNull();
  });

  it('host: an opened-but-unshared review is still the current step, not complete', () => {
    const steps = build(GameStatus.Ended, REVIEW_OPENED, HOST);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current', 'upcoming']);
    expect(steps?.[1]?.onPress).toBe(onOpenNightReview);
  });

  it('host: once shared, the review step completes and closing becomes current', () => {
    const steps = build(GameStatus.Ended, REVIEW_OPENED, HOST_SHARED);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'complete', 'current']);
  });

  it('unauthorized player: the step bar has only the info and closing steps', () => {
    const steps = build(GameStatus.Ended, INFO_CONFIRMED, PLAYER_UNAUTHORIZED);
    expect(steps?.map((step) => step.label)).toEqual(['昨夜信息', '收尾']);
    expect(steps?.map((step) => step.state)).toEqual(['complete', 'current']);
    expect(steps?.[1]?.onPress).toBeUndefined();

    const fresh = build(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS, PLAYER_UNAUTHORIZED);
    expect(fresh?.map((step) => step.state)).toEqual(['current', 'upcoming']);
    expect(fresh?.[0]?.onPress).toBe(onOpenLastNightInfo);
  });

  it('a player authorized mid-Ended gains the review step (state-driven derivation)', () => {
    // Same progress, two viewer facts: before the host shares, the
    // step does not exist; after, it appears as the current step.
    const before = build(GameStatus.Ended, INFO_CONFIRMED, PLAYER_UNAUTHORIZED);
    expect(before?.map((step) => step.key)).toEqual(['lastNightInfo', 'closing']);
    const after = build(GameStatus.Ended, INFO_CONFIRMED, PLAYER);
    expect(after?.map((step) => step.key)).toEqual(['lastNightInfo', 'nightReview', 'closing']);
    expect(after?.[1]?.state).toBe('current');
  });

  it('spectator: no step bar at Day or Ended', () => {
    expect(build(GameStatus.Day, EMPTY_PANEL_FLOW_PROGRESS, SPECTATOR)).toBeNull();
    expect(build(GameStatus.Ended, EMPTY_PANEL_FLOW_PROGRESS, SPECTATOR)).toBeNull();
    expect(build(GameStatus.Ended, REVIEW_OPENED, SPECTATOR)).toBeNull();
  });
});

describe('resolvePanelFlowHint', () => {
  it('reminds the host to share the review while the review step is current at Ended', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: INFO_CONFIRMED,
        reviewShared: false,
      }),
    ).toBe(PANEL_FLOW_SHARE_HINT);
    expect(PANEL_FLOW_SHARE_HINT).toBe('记得把复盘分享给第一天出局的玩家');
  });

  it('keeps reminding after the host opened the review but has not shared yet', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: REVIEW_OPENED,
        reviewShared: false,
      }),
    ).toBe(PANEL_FLOW_SHARE_HINT);
  });

  it('clears once the host has shared and the step completed', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: REVIEW_OPENED,
        reviewShared: true,
      }),
    ).toBeNull();
  });

  it('never shows for non-hosts, other steps, or during Day', () => {
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: false,
        progress: INFO_CONFIRMED,
        reviewShared: false,
      }),
    ).toBeNull();
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Ended,
        isHost: true,
        progress: EMPTY_PANEL_FLOW_PROGRESS,
        reviewShared: false,
      }),
    ).toBeNull();
    expect(
      resolvePanelFlowHint({
        roomStatus: GameStatus.Day,
        isHost: true,
        progress: INFO_CONFIRMED,
        reviewShared: false,
      }),
    ).toBeNull();
  });
});
