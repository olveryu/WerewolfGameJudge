/** WebSocket business-message encoding for the shared request_traffic Analytics Engine dataset. */

export const WEBSOCKET_MESSAGE_EVENT_KIND = 'WEBSOCKET_MESSAGE';

export const REALTIME_TRAFFIC_MESSAGE_TYPES = [
  'STATE_SYNC_REQUEST',
  'USER_EVENT_ACK',
  'INVALID_CLIENT_MESSAGE',
] as const;

export type RealtimeTrafficMessageType = (typeof REALTIME_TRAFFIC_MESSAGE_TYPES)[number];

/** Record one WebSocket business message without storing room or user identity. */
export function recordRealtimeTraffic(
  dataset: AnalyticsEngineDataset,
  messageType: RealtimeTrafficMessageType,
  deploymentId: string,
): void {
  dataset.writeDataPoint({
    indexes: [`websocket:${messageType}`],
    blobs: [WEBSOCKET_MESSAGE_EVENT_KIND, messageType, deploymentId],
  });
}
