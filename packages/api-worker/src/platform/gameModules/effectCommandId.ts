/** Stable bounded command IDs for at-least-once game effect delivery. */

import { sha256Hex } from '../crypto/sha256Hex';

export async function createEffectCommandId(namespace: string, effectId: string): Promise<string> {
  if (namespace.length === 0 || effectId.length === 0) {
    throw new Error('Effect command ID namespace and effectId must be non-empty');
  }
  return `${namespace}:${await sha256Hex(effectId)}`;
}
