/** Typed response contracts for the standalone admin portal. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

export interface AdminUser {
  id: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  lastCountry: string | null;
  lastColo: string | null;
  createdAt: string;
  updatedAt: string;
  level: number;
  xp: number;
  gamesPlayed: number;
}

export interface AdminRoom {
  id: string;
  code: string;
  gameType: GameType;
  status: 'creating' | 'active' | 'deleting' | 'failed';
  reconciliationAttemptCount: number;
  reconcileAfter: string | null;
  lastError: string | null;
  hostUserId: string;
  hostName: string | null;
  hostCountry: string | null;
  gamesStarted: number;
  lastStartedAt: string | null;
  participantCount: number;
  createdAt: string;
}

export interface AdminRoomPlayer {
  userId: string;
  displayName: string | null;
  lastCountry: string | null;
  lastColo: string | null;
  createdAt: string;
  joinedAt: string;
  level: number;
  xp: number;
  gamesPlayed: number;
}

export interface AdminStats {
  registered: number;
  active: number;
  totalGames: number;
  countries: Array<{ country: string; count: number }>;
  colos: Array<{ colo: string; count: number }>;
}

export interface AdminAnalytics {
  avgLoadMs: number;
  avgTtfbMs: number;
  totalRequests: number;
  countries: Array<{ country: string; count: number; avgLoadMs: number }>;
  colos: Array<{ colo: string; count: number }>;
  isps: Array<{ isp: string; count: number }>;
}

export interface AdminAIUsage {
  totalRequests: number;
  avgTtfrMs: number;
  errorRate: number;
  providers: Array<{ label: string; count: number }>;
  models: Array<{ label: string; count: number }>;
  countries: Array<{ label: string; count: number }>;
  statuses: Array<{ label: string; count: number }>;
  topUsers: Array<{ userId: string; displayName: string | null; count: number }>;
}

export interface AdminRequestTraffic {
  generatedAt: string;
  platform: {
    requests: number;
    errors: number;
    subrequests: number;
  };
  /** Platform request estimate minus application-instrumented HTTP requests. */
  requestCountDelta: number;
  http: {
    totalRequests: number;
    clientErrorRequests: number;
    serverErrorRequests: number;
    successfulWebSocketConnections: number;
    failedWebSocketConnections: number;
    routes: Array<{
      method: string;
      route: string;
      count: number;
      errorCount: number;
      avgDurationMs: number;
      sharePercent: number;
      statusCounts: Array<{ status: number; count: number }>;
    }>;
    series: Array<{ timestamp: string; count: number }>;
  };
  realtime: {
    stateSyncRequests: number;
    stateUpdateBroadcasts: number;
    stateUpdateDeliveries: number;
    /** STATE_UPDATE UTF-8 payload bytes after WebSocket fanout. */
    stateUpdateBytes: number;
    downlinkDeliveries: number;
    /** All business downlink UTF-8 payload bytes after WebSocket fanout. */
    downlinkBytes: number;
    userEventAcks: number;
    invalidClientMessages: number;
  };
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRoomsResponse {
  rooms: AdminRoom[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRoomPlayersResponse {
  players: AdminRoomPlayer[];
}

export type TimePreset = '1h' | '24h' | 'today' | '7d' | '30d' | 'custom';
