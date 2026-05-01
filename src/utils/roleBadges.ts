/**
 * roleBadges — 角色徽章资源索引
 *
 * Metro bundler 要求 require() 使用静态字符串字面量，因此需要手动映射每个 roleId。
 * 导出 getRoleBadge(roleId) 获取 512px PNG 的 ImageSourcePropType。
 * 不含业务逻辑、不 import service。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ImageSourcePropType } from 'react-native';

import badge_avenger from '../../assets/badges/png/512/role_avenger.png';
import badge_awakenedGargoyle from '../../assets/badges/png/512/role_awakenedGargoyle.png';
import badge_bloodMoon from '../../assets/badges/png/512/role_bloodMoon.png';
import badge_crow from '../../assets/badges/png/512/role_crow.png';
import badge_cupid from '../../assets/badges/png/512/role_cupid.png';
import badge_cursedFox from '../../assets/badges/png/512/role_cursedFox.png';
import badge_dancer from '../../assets/badges/png/512/role_dancer.png';
import badge_darkWolfKing from '../../assets/badges/png/512/role_darkWolfKing.png';
import badge_dreamcatcher from '../../assets/badges/png/512/role_dreamcatcher.png';
import badge_drunkSeer from '../../assets/badges/png/512/role_drunkSeer.png';
import badge_gargoyle from '../../assets/badges/png/512/role_gargoyle.png';
import badge_graveyardKeeper from '../../assets/badges/png/512/role_graveyardKeeper.png';
import badge_guard from '../../assets/badges/png/512/role_guard.png';
import badge_hunter from '../../assets/badges/png/512/role_hunter.png';
import badge_idiot from '../../assets/badges/png/512/role_idiot.png';
import badge_knight from '../../assets/badges/png/512/role_knight.png';
import badge_magician from '../../assets/badges/png/512/role_magician.png';
import badge_maskedMan from '../../assets/badges/png/512/role_maskedMan.png';
import badge_masquerade from '../../assets/badges/png/512/role_masquerade.png';
import badge_mirrorSeer from '../../assets/badges/png/512/role_mirrorSeer.png';
import badge_nightmare from '../../assets/badges/png/512/role_nightmare.png';
import badge_piper from '../../assets/badges/png/512/role_piper.png';
import badge_poisoner from '../../assets/badges/png/512/role_poisoner.png';
import badge_psychic from '../../assets/badges/png/512/role_psychic.png';
import badge_pureWhite from '../../assets/badges/png/512/role_pureWhite.png';
import badge_seer from '../../assets/badges/png/512/role_seer.png';
import badge_shadow from '../../assets/badges/png/512/role_shadow.png';
import badge_silenceElder from '../../assets/badges/png/512/role_silenceElder.png';
import badge_slacker from '../../assets/badges/png/512/role_slacker.png';
import badge_spiritKnight from '../../assets/badges/png/512/role_spiritKnight.png';
import badge_thief from '../../assets/badges/png/512/role_thief.png';
import badge_treasureMaster from '../../assets/badges/png/512/role_treasureMaster.png';
import badge_villager from '../../assets/badges/png/512/role_villager.png';
import badge_votebanElder from '../../assets/badges/png/512/role_votebanElder.png';
import badge_warden from '../../assets/badges/png/512/role_warden.png';
import badge_wildChild from '../../assets/badges/png/512/role_wildChild.png';
import badge_witch from '../../assets/badges/png/512/role_witch.png';
import badge_witcher from '../../assets/badges/png/512/role_witcher.png';
import badge_wolf from '../../assets/badges/png/512/role_wolf.png';
import badge_wolfKing from '../../assets/badges/png/512/role_wolfKing.png';
import badge_wolfQueen from '../../assets/badges/png/512/role_wolfQueen.png';
import badge_wolfRobot from '../../assets/badges/png/512/role_wolfRobot.png';
import badge_wolfWitch from '../../assets/badges/png/512/role_wolfWitch.png';

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

/** 获取角色徽章 PNG 资源（512px），用于 `<Image source={...} />` */
export function getRoleBadge(roleId: RoleId): ImageSourcePropType {
  return BADGE_MAP[roleId];
}
