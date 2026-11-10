/** Strict local persistence for Werewolf AI chat messages. */

import { parseRoomId } from '@game-judge/game-engine/platform/protocol/roomLocator';

import type { DisplayMessage } from '@/games/werewolf/state/WerewolfAIChatState';
import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@werewolf:ai-chat:messages:';
const STORAGE_VERSION = 1;
const MAX_PERSISTED_AI_CHAT_MESSAGES = 50;

export interface AIChatStorageOwner {
  readonly userId: string;
  readonly roomId: string;
}

type JsonObject = Record<string, unknown>;

interface StoredAIChatMessages {
  readonly version: 1;
  readonly messages: readonly DisplayMessage[];
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMessage(value: unknown, index: number): DisplayMessage {
  if (!isJsonObject(value)) throw new Error(`Stored AI chat message ${index} must be an object`);
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'content,id,role,timestamp') {
    throw new Error(`Stored AI chat message ${index} has unsupported fields`);
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`Stored AI chat message ${index} has an invalid ID`);
  }
  if (value.role !== 'user' && value.role !== 'assistant') {
    throw new Error(`Stored AI chat message ${index} has an invalid role`);
  }
  if (typeof value.content !== 'string') {
    throw new Error(`Stored AI chat message ${index} has invalid content`);
  }
  const timestamp = value.timestamp;
  if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error(`Stored AI chat message ${index} has an invalid timestamp`);
  }
  return {
    id: value.id,
    role: value.role,
    content: value.content,
    timestamp,
  };
}

function getStorageKey(owner: AIChatStorageOwner): string {
  if (owner.userId.length === 0) throw new Error('AI chat user ID must not be empty');
  const roomId = parseRoomId(owner.roomId);
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(owner.userId)}:${encodeURIComponent(roomId)}`;
}

function parseStoredMessages(value: unknown): StoredAIChatMessages {
  if (!isJsonObject(value)) throw new Error('Stored AI chat state must be an object');
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'messages,version') {
    throw new Error('Stored AI chat state has unsupported fields');
  }
  if (value.version !== STORAGE_VERSION || !Array.isArray(value.messages)) {
    throw new Error('Stored AI chat state has an unsupported version or message list');
  }
  if (value.messages.length > MAX_PERSISTED_AI_CHAT_MESSAGES) {
    throw new Error('Stored AI chat messages exceed the persistence limit');
  }
  const messages = value.messages.map(parseMessage);
  if (new Set(messages.map(({ id }) => id)).size !== messages.length) {
    throw new Error('Stored AI chat messages contain duplicate IDs');
  }
  return { version: STORAGE_VERSION, messages };
}

export function readAIChatMessages(owner: AIChatStorageOwner): DisplayMessage[] {
  const raw = storage.getString(getStorageKey(owner));
  if (raw === undefined) return [];
  const parsed: unknown = JSON.parse(raw);
  return [...parseStoredMessages(parsed).messages];
}

export function writeAIChatMessages(
  owner: AIChatStorageOwner,
  messages: readonly DisplayMessage[],
): void {
  const parsedMessages = messages.slice(-MAX_PERSISTED_AI_CHAT_MESSAGES).map(parseMessage);
  if (new Set(parsedMessages.map(({ id }) => id)).size !== parsedMessages.length) {
    throw new Error('AI chat messages contain duplicate IDs');
  }
  const persisted: StoredAIChatMessages = {
    version: STORAGE_VERSION,
    messages: parsedMessages,
  };
  storage.set(getStorageKey(owner), JSON.stringify(persisted));
}

export function clearAIChatMessages(owner: AIChatStorageOwner): void {
  storage.remove(getStorageKey(owner));
}
