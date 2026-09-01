/** WebSocket business-message encoding for the shared request_traffic Analytics Engine dataset. */

export const WEBSOCKET_MESSAGE_EVENT_KIND = 'WEBSOCKET_MESSAGE';

const DOWNLINK_REALTIME_TRAFFIC_MESSAGE_TYPES = [
  'STATE_UPDATE',
  'STATE_SYNC_RESPONSE',
  'USER_EVENT_DELIVERY',
] as const;

export const REALTIME_TRAFFIC_MESSAGE_TYPES = [
  'STATE_SYNC_REQUEST',
  ...DOWNLINK_REALTIME_TRAFFIC_MESSAGE_TYPES,
  'USER_EVENT_ACK',
  'INVALID_CLIENT_MESSAGE',
] as const;

export type RealtimeTrafficMessageType = (typeof REALTIME_TRAFFIC_MESSAGE_TYPES)[number];

export interface RealtimeTrafficEvent {
  readonly messageType: RealtimeTrafficMessageType;
  /** UTF-8 bytes in one WebSocket frame payload. */
  readonly payloadBytes: number;
  /** Number of frames successfully received or sent. */
  readonly deliveryCount: number;
  readonly deploymentId: string;
}

/** Return the WebSocket payload size using its transmitted UTF-8 representation. */
export function getWebSocketMessageByteLength(message: string | ArrayBuffer): number {
  return typeof message === 'string'
    ? new TextEncoder().encode(message).byteLength
    : message.byteLength;
}

/** Record one WebSocket business message without storing room or user identity. */
export function recordRealtimeTraffic(
  dataset: AnalyticsEngineDataset,
  event: RealtimeTrafficEvent,
): void {
  dataset.writeDataPoint({
    indexes: [`websocket:${event.messageType}`],
    blobs: [WEBSOCKET_MESSAGE_EVENT_KIND, event.messageType, event.deploymentId],
    doubles: [event.payloadBytes, event.deliveryCount, event.payloadBytes * event.deliveryCount],
  });
}
