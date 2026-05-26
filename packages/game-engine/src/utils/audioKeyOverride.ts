/**
 * Audio key override - multi-Seer label audio rewrite
 *
 * When multiple displayAs='seer' roles are in play, `seerLabelMap` is randomly generated during ASSIGN_ROLES,
 * recording each role's corresponding number (1, 2, ...). This function maps the original audioKey to a numbered audio file key.
 *
 * Rules:
 * - seerLabelMap exists and audioKey has a corresponding number in map -> `'seer_N'`
 * - Otherwise return as-is
 *
 * Does not handle the case where only a single seer-like role is in play — in that case there is no seerLabelMap and the role's original audio plays directly.
 */
export function resolveSeerAudioKey(
  audioKey: string,
  seerLabelMap?: Readonly<Record<string, number>>,
): string {
  if (!seerLabelMap) return audioKey;

  const label = seerLabelMap[audioKey];
  if (label != null) {
    return `seer_${label}`;
  }

  return audioKey;
}
