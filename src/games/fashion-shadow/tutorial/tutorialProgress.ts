import { storage } from '@/services/infra/localStorage';

const STORAGE_KEY_PREFIX = '@fashion-shadow:tutorial:';
const COMPLETION_MARKER = 'completed-v1';

function requireUserId(userId: string): string {
  if (userId.length === 0)
    throw new Error('[FAIL-FAST] Fashion tutorial user ID must not be empty');
  return userId;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(requireUserId(userId))}`;
}

export function hasCompletedFashionTutorial(userId: string): boolean {
  return storage.getString(getStorageKey(userId)) === COMPLETION_MARKER;
}

export function markFashionTutorialCompleted(userId: string): void {
  storage.set(getStorageKey(userId), COMPLETION_MARKER);
}
