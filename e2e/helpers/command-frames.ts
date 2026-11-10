/**
 * command-frames — observe and gate room COMMAND traffic over the live socket.
 *
 * The client sends every room command as a COMMAND frame on the room WebSocket
 * and receives its decision as a COMMAND_RESULT frame. These helpers observe
 * that traffic from the test side.
 *
 * Both helpers must be installed BEFORE the page enters a room: Playwright
 * only routes and listens to WebSockets created after the route/listener is
 * registered (see the routeWebSocket docs), and the room socket is created
 * on room entry. Attaching later silently misses the live socket.
 */
import type { Page, WebSocket, WebSocketRoute } from '@playwright/test';

export interface ObservedCommand {
  readonly commandId: string;
  readonly command: unknown;
  readonly atMs: number;
}

export interface ObservedCommandResult {
  readonly commandId: string;
  readonly outcome: 'decided' | 'unavailable' | 'throttled';
  readonly result: unknown;
  readonly atMs: number;
}

export interface CommandFrameObservation {
  /** COMMAND frames the page sent, in order. */
  readonly commands: () => readonly ObservedCommand[];
  /** COMMAND_RESULT frames the page received, in order. */
  readonly results: () => readonly ObservedCommandResult[];
  /** The next COMMAND frame whose command.type matches, or a timeout error. */
  waitForCommand(commandType: string, timeoutMs?: number): Promise<ObservedCommand>;
  /** The COMMAND_RESULT for a sent commandId, or a timeout error. */
  waitForResult(commandId: string, timeoutMs?: number): Promise<ObservedCommandResult>;
  stop(): Promise<void>;
}

interface CommandWaiter {
  readonly matches: (frame: ObservedCommand) => boolean;
  readonly resolve: (frame: ObservedCommand) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface ResultWaiter {
  readonly commandId: string;
  readonly resolve: (frame: ObservedCommandResult) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** True when the value parses as a COMMAND frame; its command object otherwise. */
function commandOf(payload: string | Buffer): ObservedCommand | null {
  if (typeof payload !== 'string') return null;
  let value: unknown = null;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('type' in value)) return null;
  if (value.type !== 'COMMAND') return null;
  if (!('commandId' in value) || typeof value.commandId !== 'string') return null;
  if (!('command' in value)) return null;
  return { commandId: value.commandId, command: value.command, atMs: Date.now() };
}

/** True when the value parses as a COMMAND_RESULT frame. */
function resultOf(payload: string | Buffer): ObservedCommandResult | null {
  if (typeof payload !== 'string') return null;
  let value: unknown = null;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('type' in value)) return null;
  if (value.type !== 'COMMAND_RESULT') return null;
  if (!('commandId' in value) || typeof value.commandId !== 'string') return null;
  if (!('outcome' in value) || typeof value.outcome !== 'string') return null;
  if (
    value.outcome !== 'decided' &&
    value.outcome !== 'unavailable' &&
    value.outcome !== 'throttled'
  ) {
    return null;
  }
  return {
    commandId: value.commandId,
    outcome: value.outcome,
    result: 'result' in value ? value.result : null,
    atMs: Date.now(),
  };
}

function commandTypeOf(command: unknown): string | null {
  if (typeof command !== 'object' || command === null || !('type' in command)) return null;
  return typeof command.type === 'string' ? command.type : null;
}

/**
 * Passively record COMMAND / COMMAND_RESULT frames. Call before the page
 * enters a room; frames sent before installation are not observed.
 */
export function observeCommandFrames(page: Page): CommandFrameObservation {
  const sent: ObservedCommand[] = [];
  const received: ObservedCommandResult[] = [];
  const commandWaiters: CommandWaiter[] = [];
  const resultWaiters: ResultWaiter[] = [];
  const sockets = new Set<WebSocket>();

  const onFrameSent = ({ payload }: { payload: string | Buffer }): void => {
    const frame = commandOf(payload);
    if (frame === null) return;
    sent.push(frame);
    for (let i = commandWaiters.length - 1; i >= 0; i -= 1) {
      const waiter = commandWaiters[i]!;
      if (!waiter.matches(frame)) continue;
      commandWaiters.splice(i, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(frame);
    }
  };
  const onFrameReceived = ({ payload }: { payload: string | Buffer }): void => {
    const frame = resultOf(payload);
    if (frame === null) return;
    received.push(frame);
    for (let i = resultWaiters.length - 1; i >= 0; i -= 1) {
      const waiter = resultWaiters[i]!;
      if (waiter.commandId !== frame.commandId) continue;
      resultWaiters.splice(i, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(frame);
    }
  };
  const onSocket = (socket: WebSocket): void => {
    sockets.add(socket);
    socket.on('framesent', onFrameSent);
    socket.on('framereceived', onFrameReceived);
  };
  page.on('websocket', onSocket);

  return {
    commands: () => sent,
    results: () => received,
    waitForCommand(commandType: string, timeoutMs = 30_000): Promise<ObservedCommand> {
      // Future frames only, like waitForResponse: a frame sent before this
      // call belongs to an earlier action and must not satisfy the wait.
      return new Promise<ObservedCommand>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No COMMAND frame of type ${commandType} within ${timeoutMs}ms`)),
          timeoutMs,
        );
        commandWaiters.push({
          matches: (frame) => commandTypeOf(frame.command) === commandType,
          resolve,
          reject,
          timer,
        });
      });
    },
    waitForResult(commandId: string, timeoutMs = 30_000): Promise<ObservedCommandResult> {
      // A result for this commandId is unambiguous (commandIds are unique
      // per dispatch), so return one already recorded before waiting for a
      // future frame: the server can answer while the caller is still
      // finishing the action that sent the command (e.g. waiting for a
      // confirm dialog to close), and a future-only wait would miss it.
      // waitForCommand stays future-only: a type repeats across actions,
      // so an old frame must not satisfy it.
      const recorded = received.find((frame) => frame.commandId === commandId);
      if (recorded !== undefined) return Promise.resolve(recorded);
      return new Promise<ObservedCommandResult>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No COMMAND_RESULT for ${commandId} within ${timeoutMs}ms`)),
          timeoutMs,
        );
        resultWaiters.push({ commandId, resolve, reject, timer });
      });
    },
    async stop(): Promise<void> {
      page.off('websocket', onSocket);
      for (const socket of sockets) {
        socket.off('framesent', onFrameSent);
        socket.off('framereceived', onFrameReceived);
      }
      sockets.clear();
      for (const waiter of commandWaiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Command frame observation stopped'));
      }
      for (const waiter of resultWaiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Command frame observation stopped'));
      }
    },
  };
}

export interface HeldCommand {
  readonly commandId: string;
  readonly command: unknown;
  /** Forward the held frame to the server. */
  release(): void;
}

export interface CommandFrameGate {
  /** The next held COMMAND frame whose command.type matches, or a timeout error. */
  waitForHeld(commandType: string, timeoutMs?: number): Promise<HeldCommand>;
  /** Forward every held frame. The route itself lives until the page closes. */
  stop(): Promise<void>;
}

interface HeldWaiter {
  readonly commandType: string;
  readonly resolve: (held: HeldCommand) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Hold matching COMMAND frames at the browser instead of delivering them,
 * so the test can assert on the in-flight state before releasing. Other
 * frames (SYNC, ping, unrelated commands) are forwarded immediately.
 *
 * Call before the page enters a room, and call waitForHeld before the
 * action that sends the command: only frames whose type already has a
 * waiter are held, so an unregistered type is never stalled.
 */
export async function gateCommandFrames(page: Page): Promise<CommandFrameGate> {
  const held: HeldCommand[] = [];
  const waiters: HeldWaiter[] = [];

  // Register on the browser context, not the page: a page-level route can
  // miss the room socket (the ack then bypasses the gate and reaches the
  // server, as the room-narration diagnostic run 42844905359 proved), while
  // the context route is established before any page in the context exists.
  // Each player page has its own context, so this still scopes to one page.
  await page.context().routeWebSocket('**/ws*', (ws: WebSocketRoute) => {
    // server.send() forwards to the server; ws.send() sends back to the
    // page. Forwarding must go through the server-side route, or every
    // client frame is echoed back to the page (and the server never sees
    // SYNC or any command).
    const server = ws.connectToServer();
    ws.onMessage((message: string | Buffer) => {
      const frame = commandOf(message);
      if (frame === null) {
        server.send(message);
        return;
      }
      const type = commandTypeOf(frame.command);
      const waiterIndex = type === null ? -1 : waiters.findIndex((w) => w.commandType === type);
      if (waiterIndex === -1) {
        server.send(message);
        return;
      }
      const waiter = waiters.splice(waiterIndex, 1)[0]!;
      clearTimeout(waiter.timer);
      // release() is idempotent and removes the frame from `held`: a
      // frame released by the test must not be sent again by stop().
      let released = false;
      const heldCommand: HeldCommand = {
        commandId: frame.commandId,
        command: frame.command,
        release: () => {
          if (released) return;
          released = true;
          const index = held.indexOf(heldCommand);
          if (index !== -1) held.splice(index, 1);
          server.send(message);
        },
      };
      held.push(heldCommand);
      waiter.resolve(heldCommand);
    });
  });

  return {
    waitForHeld(commandType: string, timeoutMs = 30_000): Promise<HeldCommand> {
      const index = held.findIndex((candidate) => commandTypeOf(candidate.command) === commandType);
      if (index !== -1) return Promise.resolve(held.splice(index, 1)[0]!);
      return new Promise<HeldCommand>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(`No COMMAND frame of type ${commandType} was held within ${timeoutMs}ms`),
            ),
          timeoutMs,
        );
        waiters.push({ commandType, resolve, reject, timer });
      });
    },
    async stop(): Promise<void> {
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Command frame gate stopped'));
      }
      for (const candidate of held.splice(0)) candidate.release();
    },
  };
}
