/** WebSocket business-message metric contract tests. */

import { describe, expect, it, vi } from 'vitest';

import { recordRealtimeTraffic, WEBSOCKET_MESSAGE_EVENT_KIND } from '../realtimeTraffic';

describe('realtime traffic metrics', () => {
  it('encodes a message without room or user identity', () => {
    const writeDataPoint = vi.fn<AnalyticsEngineDataset['writeDataPoint']>();
    const dataset: AnalyticsEngineDataset = { writeDataPoint };

    recordRealtimeTraffic(dataset, 'STATE_SYNC_REQUEST', 'deployment-1');

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['websocket:STATE_SYNC_REQUEST'],
      blobs: [WEBSOCKET_MESSAGE_EVENT_KIND, 'STATE_SYNC_REQUEST', 'deployment-1'],
    });
  });
});
