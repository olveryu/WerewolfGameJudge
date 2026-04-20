/**
 * roleBadges — 角色徽章资源索引 (web: WebP)
 *
 * Web 使用 128px WebP badge，对应 native 版的 512px PNG。
 * Metro 根据平台自动选择 .web.ts。
 * 由 scripts/process_avatars.py 生成 WebP 资源。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ImageSourcePropType } from 'react-native';

const BADGE_MAP: Record<RoleId, ImageSourcePropType> = {
  // ── Villager ──
  villager: require('../../assets/badges/web/role_villager.webp'),
  mirrorSeer: require('../../assets/badges/web/role_mirrorSeer.webp'),
  drunkSeer: require('../../assets/badges/web/role_drunkSeer.webp'),

  // ── God ──
  seer: require('../../assets/badges/web/role_seer.webp'),
  witch: require('../../assets/badges/web/role_witch.webp'),
  hunter: require('../../assets/badges/web/role_hunter.webp'),
  guard: require('../../assets/badges/web/role_guard.webp'),
  idiot: require('../../assets/badges/web/role_idiot.webp'),
  knight: require('../../assets/badges/web/role_knight.webp'),
  magician: require('../../assets/badges/web/role_magician.webp'),
  witcher: require('../../assets/badges/web/role_witcher.webp'),
  psychic: require('../../assets/badges/web/role_psychic.webp'),
  dreamcatcher: require('../../assets/badges/web/role_dreamcatcher.webp'),
  graveyardKeeper: require('../../assets/badges/web/role_graveyardKeeper.webp'),
  pureWhite: require('../../assets/badges/web/role_pureWhite.webp'),
  dancer: require('../../assets/badges/web/role_dancer.webp'),
  silenceElder: require('../../assets/badges/web/role_silenceElder.webp'),
  votebanElder: require('../../assets/badges/web/role_votebanElder.webp'),
  crow: require('../../assets/badges/web/role_crow.webp'),
  maskedMan: require('../../assets/badges/web/role_maskedMan.webp'),
  poisoner: require('../../assets/badges/web/role_poisoner.webp'),

  // ── Wolf ──
  wolf: require('../../assets/badges/web/role_wolf.webp'),
  wolfQueen: require('../../assets/badges/web/role_wolfQueen.webp'),
  wolfKing: require('../../assets/badges/web/role_wolfKing.webp'),
  darkWolfKing: require('../../assets/badges/web/role_darkWolfKing.webp'),
  nightmare: require('../../assets/badges/web/role_nightmare.webp'),
  gargoyle: require('../../assets/badges/web/role_gargoyle.webp'),
  awakenedGargoyle: require('../../assets/badges/web/role_awakenedGargoyle.webp'),
  bloodMoon: require('../../assets/badges/web/role_bloodMoon.webp'),
  wolfRobot: require('../../assets/badges/web/role_wolfRobot.webp'),
  wolfWitch: require('../../assets/badges/web/role_wolfWitch.webp'),
  spiritKnight: require('../../assets/badges/web/role_spiritKnight.webp'),
  masquerade: require('../../assets/badges/web/role_masquerade.webp'),
  warden: require('../../assets/badges/web/role_warden.webp'),

  // ── Special ──
  slacker: require('../../assets/badges/web/role_slacker.webp'),
  wildChild: require('../../assets/badges/web/role_wildChild.webp'),
  piper: require('../../assets/badges/web/role_piper.webp'),
  shadow: require('../../assets/badges/web/role_shadow.webp'),
  avenger: require('../../assets/badges/web/role_avenger.webp'),
  thief: require('../../assets/badges/web/role_thief.webp'),
  cupid: require('../../assets/badges/web/role_cupid.webp'),
  treasureMaster: require('../../assets/badges/web/role_treasureMaster.webp'),
  cursedFox: require('../../assets/badges/web/role_cursedFox.webp'),
};

/** 获取角色徽章 WebP 资源（128px），用于 `<Image source={...} />` */
export function getRoleBadge(roleId: RoleId): ImageSourcePropType {
  return BADGE_MAP[roleId];
}
