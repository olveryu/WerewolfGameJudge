/**
 * roleBadges — 角色徽章资源索引 (web: WebP)
 *
 * Web 使用 128px WebP badge，对应 native 版的 512px PNG。
 * Metro 根据平台自动选择 .web.ts。
 * 由 scripts/process_avatars.py 生成 WebP 资源。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ImageSourcePropType } from 'react-native';

import badge_avenger from '../../assets/badges/web/role_avenger.webp';
import badge_awakenedGargoyle from '../../assets/badges/web/role_awakenedGargoyle.webp';
import badge_bloodMoon from '../../assets/badges/web/role_bloodMoon.webp';
import badge_crow from '../../assets/badges/web/role_crow.webp';
import badge_cupid from '../../assets/badges/web/role_cupid.webp';
import badge_cursedFox from '../../assets/badges/web/role_cursedFox.webp';
import badge_dancer from '../../assets/badges/web/role_dancer.webp';
import badge_darkWolfKing from '../../assets/badges/web/role_darkWolfKing.webp';
import badge_dreamcatcher from '../../assets/badges/web/role_dreamcatcher.webp';
import badge_drunkSeer from '../../assets/badges/web/role_drunkSeer.webp';
import badge_gargoyle from '../../assets/badges/web/role_gargoyle.webp';
import badge_graveyardKeeper from '../../assets/badges/web/role_graveyardKeeper.webp';
import badge_guard from '../../assets/badges/web/role_guard.webp';
import badge_hunter from '../../assets/badges/web/role_hunter.webp';
import badge_idiot from '../../assets/badges/web/role_idiot.webp';
import badge_knight from '../../assets/badges/web/role_knight.webp';
import badge_magician from '../../assets/badges/web/role_magician.webp';
import badge_maskedMan from '../../assets/badges/web/role_maskedMan.webp';
import badge_masquerade from '../../assets/badges/web/role_masquerade.webp';
import badge_mirrorSeer from '../../assets/badges/web/role_mirrorSeer.webp';
import badge_nightmare from '../../assets/badges/web/role_nightmare.webp';
import badge_piper from '../../assets/badges/web/role_piper.webp';
import badge_poisoner from '../../assets/badges/web/role_poisoner.webp';
import badge_psychic from '../../assets/badges/web/role_psychic.webp';
import badge_pureWhite from '../../assets/badges/web/role_pureWhite.webp';
import badge_seer from '../../assets/badges/web/role_seer.webp';
import badge_shadow from '../../assets/badges/web/role_shadow.webp';
import badge_silenceElder from '../../assets/badges/web/role_silenceElder.webp';
import badge_slacker from '../../assets/badges/web/role_slacker.webp';
import badge_spiritKnight from '../../assets/badges/web/role_spiritKnight.webp';
import badge_thief from '../../assets/badges/web/role_thief.webp';
import badge_treasureMaster from '../../assets/badges/web/role_treasureMaster.webp';
import badge_villager from '../../assets/badges/web/role_villager.webp';
import badge_votebanElder from '../../assets/badges/web/role_votebanElder.webp';
import badge_warden from '../../assets/badges/web/role_warden.webp';
import badge_wildChild from '../../assets/badges/web/role_wildChild.webp';
import badge_witch from '../../assets/badges/web/role_witch.webp';
import badge_witcher from '../../assets/badges/web/role_witcher.webp';
import badge_wolf from '../../assets/badges/web/role_wolf.webp';
import badge_wolfKing from '../../assets/badges/web/role_wolfKing.webp';
import badge_wolfQueen from '../../assets/badges/web/role_wolfQueen.webp';
import badge_wolfRobot from '../../assets/badges/web/role_wolfRobot.webp';
import badge_wolfWitch from '../../assets/badges/web/role_wolfWitch.webp';

const BADGE_MAP: Record<RoleId, ImageSourcePropType> = {
  // ── Villager ──
  villager: badge_villager,
  mirrorSeer: badge_mirrorSeer,
  drunkSeer: badge_drunkSeer,
  // ── God ──
  seer: badge_seer,
  witch: badge_witch,
  hunter: badge_hunter,
  guard: badge_guard,
  idiot: badge_idiot,
  knight: badge_knight,
  magician: badge_magician,
  witcher: badge_witcher,
  psychic: badge_psychic,
  dreamcatcher: badge_dreamcatcher,
  graveyardKeeper: badge_graveyardKeeper,
  pureWhite: badge_pureWhite,
  dancer: badge_dancer,
  silenceElder: badge_silenceElder,
  votebanElder: badge_votebanElder,
  crow: badge_crow,
  maskedMan: badge_maskedMan,
  poisoner: badge_poisoner,
  // ── Wolf ──
  wolf: badge_wolf,
  wolfQueen: badge_wolfQueen,
  wolfKing: badge_wolfKing,
  darkWolfKing: badge_darkWolfKing,
  nightmare: badge_nightmare,
  gargoyle: badge_gargoyle,
  awakenedGargoyle: badge_awakenedGargoyle,
  bloodMoon: badge_bloodMoon,
  wolfRobot: badge_wolfRobot,
  wolfWitch: badge_wolfWitch,
  spiritKnight: badge_spiritKnight,
  masquerade: badge_masquerade,
  warden: badge_warden,
  // ── Special ──
  slacker: badge_slacker,
  wildChild: badge_wildChild,
  piper: badge_piper,
  shadow: badge_shadow,
  avenger: badge_avenger,
  thief: badge_thief,
  cupid: badge_cupid,
  treasureMaster: badge_treasureMaster,
  cursedFox: badge_cursedFox,
};

/** 获取角色徽章 WebP 资源（128px），用于 `<Image source={...} />` */
export function getRoleBadge(roleId: RoleId): ImageSourcePropType {
  return BADGE_MAP[roleId];
}
