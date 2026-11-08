/** Scriptable WebSocket double for realtime tests. */

import type { RealtimeSocket } from '@/platform/realtime/SocketChannel';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

export class FakeWebSocket implements RealtimeSocket {
  readonly url: string;
  readyState: number = CONNECTING;
  readonly sent: string[] = [];
  closedWith: { code: number; reason: string } | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string): void {
    if (this.readyState !== OPEN) throw new Error('send on non-open socket');
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = CLOSED;
    this.closedWith = { code, reason };
  }

  // ─── Server-side script ───────────────────────────────────────────────────

  serverOpen(): void {
    this.readyState = OPEN;
    this.onopen?.();
  }

  serverSend(data: unknown): void {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }

  serverClose(code: number, reason = ''): void {
    this.readyState = CLOSED;
    this.onclose?.({ code, reason });
  }
}

/** Create FakeWebSockets and keep them for assertions. */
export function createSocketFactory(): {
  readonly sockets: FakeWebSocket[];
  readonly create: (url: string) => RealtimeSocket;
  readonly latest: () => FakeWebSocket;
} {
  const sockets: FakeWebSocket[] = [];
  return {
    sockets,
    create: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
    latest: () => {
      const socket = sockets[sockets.length - 1];
      if (socket === undefined) throw new Error('No socket was created');
      return socket;
    },
  };
}
