/** Resolve Werewolf role IDs to their badge artwork (encyclopedia role cards). */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

const badgeFiles = import.meta.glob<string>('../../../../../../assets/badges/web/role_*.webp', {
  eager: true,
  import: 'default',
});

const BADGE_URLS: ReadonlyMap<string, string> = new Map(
  Object.entries(badgeFiles).map(([path, url]) => [
    path.slice(path.lastIndexOf('/role_') + '/role_'.length, -'.webp'.length),
    url,
  ]),
);

export function getRoleBadge(roleId: RoleId): string {
  const url = BADGE_URLS.get(roleId);
  if (url === undefined) throw new Error(`Missing badge assets/badges/web/role_${roleId}.webp`);
  return url;
}
