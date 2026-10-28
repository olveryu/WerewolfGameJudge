/** Scriptable WebSocket double for realtime tests. */

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

export class FakeWebSocket {
  readonly url: string;
  readyState: number = CONNECTING;
  readonly sent: string[] = [];
  closedWith: { code: number; reason: string } | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

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
    this.onopen?.(new Event('open'));
  }

  serverSend(data: unknown): void {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.onmessage?.({ data: payload } as MessageEvent);
  }

  serverClose(code: number, reason = ''): void {
    this.readyState = CLOSED;
    this.onclose?.({ code, reason, wasClean: true } as CloseEvent);
  }
}

/** Create FakeWebSockets and keep them for assertions. */
export function createSocketFactory(): {
  readonly sockets: FakeWebSocket[];
  readonly create: (url: string) => WebSocket;
  readonly latest: () => FakeWebSocket;
} {
  const sockets: FakeWebSocket[] = [];
  return {
    sockets,
    create: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    latest: () => {
      const socket = sockets[sockets.length - 1];
      if (socket === undefined) throw new Error('No socket was created');
      return socket;
    },
  };
}
