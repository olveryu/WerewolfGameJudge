import { PANEL_FLOW_PROGRESS_KEY } from '@/config/storageKeys';
import { storage } from '@/services/infra/localStorage';

import { EMPTY_PANEL_FLOW_PROGRESS } from '../../room/panelFlow';
import {
  type PanelFlowScope,
  readPanelFlowProgress,
  recordPanelFlowProgress,
} from '../panelFlowProgressStore';

jest.mock('@/services/infra/localStorage', () => {
  const data = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => data.get(key),
      set: (key: string, value: string) => {
        data.set(key, value);
      },
      delete: (key: string) => {
        data.delete(key);
      },
      __data: data,
    },
  };
});

const mockStorage = storage as unknown as {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  __data: Map<string, string>;
};

const SCOPE: PanelFlowScope = { roomId: 'room-1', userId: 'user-1', roleRevealRandomNonce: 'n1' };

describe('panelFlowProgressStore', () => {
  beforeEach(() => {
    mockStorage.__data.clear();
  });

  it('starts empty and round-trips recorded progress', () => {
    expect(readPanelFlowProgress(SCOPE)).toEqual(EMPTY_PANEL_FLOW_PROGRESS);

    const afterConfirm = recordPanelFlowProgress(SCOPE, { lastNightInfoConfirmed: true });
    expect(afterConfirm).toEqual({ lastNightInfoConfirmed: true, nightReviewOpened: false });

    const afterReview = recordPanelFlowProgress(SCOPE, { nightReviewOpened: true });
    expect(afterReview).toEqual({ lastNightInfoConfirmed: true, nightReviewOpened: true });
    expect(readPanelFlowProgress(SCOPE)).toEqual(afterReview);
  });

  it('partitions by room, user, and game round (nonce)', () => {
    recordPanelFlowProgress(SCOPE, { lastNightInfoConfirmed: true });

    expect(readPanelFlowProgress({ ...SCOPE, roleRevealRandomNonce: 'n2' })).toEqual(
      EMPTY_PANEL_FLOW_PROGRESS,
    );
    expect(readPanelFlowProgress({ ...SCOPE, userId: 'user-2' })).toEqual(
      EMPTY_PANEL_FLOW_PROGRESS,
    );
    expect(readPanelFlowProgress({ ...SCOPE, roomId: 'room-2' })).toEqual(
      EMPTY_PANEL_FLOW_PROGRESS,
    );
    expect(readPanelFlowProgress(SCOPE).lastNightInfoConfirmed).toBe(true);
  });

  it('degrades a corrupt or malformed record to no progress', () => {
    mockStorage.set(PANEL_FLOW_PROGRESS_KEY, 'not-json');
    expect(readPanelFlowProgress(SCOPE)).toEqual(EMPTY_PANEL_FLOW_PROGRESS);

    mockStorage.set(PANEL_FLOW_PROGRESS_KEY, JSON.stringify({ 'room-1:user-1:n1': { nope: 1 } }));
    expect(readPanelFlowProgress(SCOPE)).toEqual(EMPTY_PANEL_FLOW_PROGRESS);
  });
});
