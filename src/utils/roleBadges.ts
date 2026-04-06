/**
 * roleBadges — 角色徽章资源索引
 *
 * Metro bundler 要求 require() 使用静态字符串字面量，因此需要手动映射每个 roleId。
 * 导出 getRoleBadge(roleId) 获取 512px PNG 的 ImageSourcePropType。
 * 不含业务逻辑、不 import service。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ImageSourcePropType } from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports */
const BADGE_MAP: Record<RoleId, ImageSourcePropType> = {
  // ── Villager ──
  villager: require('../../assets/badges/png/512/role_villager.png'),
  mirrorSeer: require('../../assets/badges/png/512/role_mirrorSeer.png'),
  drunkSeer: require('../../assets/badges/png/512/role_drunkSeer.png'),

  // ── God ──
  seer: require('../../assets/badges/png/512/role_seer.png'),
  witch: require('../../assets/badges/png/512/role_witch.png'),
  hunter: require('../../assets/badges/png/512/role_hunter.png'),
  guard: require('../../assets/badges/png/512/role_guard.png'),
  idiot: require('../../assets/badges/png/512/role_idiot.png'),
  knight: require('../../assets/badges/png/512/role_knight.png'),
  magician: require('../../assets/badges/png/512/role_magician.png'),
  witcher: require('../../assets/badges/png/512/role_witcher.png'),
  psychic: require('../../assets/badges/png/512/role_psychic.png'),
  dreamcatcher: require('../../assets/badges/png/512/role_dreamcatcher.png'),
  graveyardKeeper: require('../../assets/badges/png/512/role_graveyardKeeper.png'),
  pureWhite: require('../../assets/badges/png/512/role_pureWhite.png'),
  dancer: require('../../assets/badges/png/512/role_dancer.png'),
  silenceElder: require('../../assets/badges/png/512/role_silenceElder.png'),
  votebanElder: require('../../assets/badges/png/512/role_votebanElder.png'),
  crow: require('../../assets/badges/png/512/role_crow.png'),
  maskedMan: require('../../assets/badges/png/512/role_maskedMan.png'),
  poisoner: require('../../assets/badges/png/512/role_poisoner.png'),

  // ── Wolf ──
  wolf: require('../../assets/badges/png/512/role_wolf.png'),
  wolfQueen: require('../../assets/badges/png/512/role_wolfQueen.png'),
  wolfKing: require('../../assets/badges/png/512/role_wolfKing.png'),
  darkWolfKing: require('../../assets/badges/png/512/role_darkWolfKing.png'),
  nightmare: require('../../assets/badges/png/512/role_nightmare.png'),
  gargoyle: require('../../assets/badges/png/512/role_gargoyle.png'),
  awakenedGargoyle: require('../../assets/badges/png/512/role_awakenedGargoyle.png'),
  bloodMoon: require('../../assets/badges/png/512/role_bloodMoon.png'),
  wolfRobot: require('../../assets/badges/png/512/role_wolfRobot.png'),
  wolfWitch: require('../../assets/badges/png/512/role_wolfWitch.png'),
  spiritKnight: require('../../assets/badges/png/512/role_spiritKnight.png'),
  masquerade: require('../../assets/badges/png/512/role_masquerade.png'),
  warden: require('../../assets/badges/png/512/role_warden.png'),

  // ── Special ──
  slacker: require('../../assets/badges/png/512/role_slacker.png'),
  wildChild: require('../../assets/badges/png/512/role_wildChild.png'),
  piper: require('../../assets/badges/png/512/role_piper.png'),
  shadow: require('../../assets/badges/png/512/role_shadow.png'),
  avenger: require('../../assets/badges/png/512/role_avenger.png'),
  thief: require('../../assets/badges/png/512/role_thief.png'),
  cupid: require('../../assets/badges/png/512/role_cupid.png'),
  treasureMaster: require('../../assets/badges/png/512/role_treasureMaster.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** 获取角色徽章 PNG 资源（512px），用于 `<Image source={...} />` */
export function getRoleBadge(roleId: RoleId): ImageSourcePropType {
  return BADGE_MAP[roleId];
}
