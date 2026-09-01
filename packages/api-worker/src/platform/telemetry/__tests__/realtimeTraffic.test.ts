/** WebSocket business-message metric contract tests. */

import { describe, expect, it, vi } from 'vitest';

import {
  getWebSocketMessageByteLength,
  recordRealtimeTraffic,
  WEBSOCKET_MESSAGE_EVENT_KIND,
} from '../realtimeTraffic';

describe('realtime traffic metrics', () => {
  it('encodes a message without room or user identity', () => {
    const writeDataPoint = vi.fn<AnalyticsEngineDataset['writeDataPoint']>();
    const dataset: AnalyticsEngineDataset = { writeDataPoint };

    recordRealtimeTraffic(dataset, {
      messageType: 'STATE_UPDATE',
      payloadBytes: 320,
      deliveryCount: 4,
      deploymentId: 'deployment-1',
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['websocket:STATE_UPDATE'],
      blobs: [WEBSOCKET_MESSAGE_EVENT_KIND, 'STATE_UPDATE', 'deployment-1'],
      doubles: [320, 4, 1280],
    });
  });

  it('measures string payloads as UTF-8 bytes', () => {
    expect(getWebSocketMessageByteLength('\u72fc\u4eba')).toBe(6);
    expect(getWebSocketMessageByteLength(new ArrayBuffer(7))).toBe(7);
  });
});
