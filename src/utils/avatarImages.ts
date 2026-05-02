/**
 * avatarImages — Platform-specific avatar image registries (native: PNG)
 *
 * Native platforms use full-size 2048px raw PNGs and 512px badge PNGs.
 * See avatarImages.web.ts for the web variant (512px + 128px WebP).
 */
import type { HandDrawnAvatarId } from '@werewolf/game-engine/growth/rewardCatalog';

// --- Raw avatar imports ---
import avenger from '../../assets/avatars/raw/avenger.png';
import awakenedGargoyle from '../../assets/avatars/raw/awakenedGargoyle.png';
import bloodMoon from '../../assets/avatars/raw/bloodMoon.png';
import crow from '../../assets/avatars/raw/crow.png';
import cupid from '../../assets/avatars/raw/cupid.png';
import cursedFox from '../../assets/avatars/raw/cursedFox.png';
import dancer from '../../assets/avatars/raw/dancer.png';
import darkWolfKing from '../../assets/avatars/raw/darkWolfKing.png';
import dreamcatcher from '../../assets/avatars/raw/dreamcatcher.png';
import drunkSeer from '../../assets/avatars/raw/drunkSeer.png';
import eclipseWolfQueen from '../../assets/avatars/raw/eclipseWolfQueen.png';
import gargoyle from '../../assets/avatars/raw/gargoyle.png';
import graveyardKeeper from '../../assets/avatars/raw/graveyardKeeper.png';
import guard from '../../assets/avatars/raw/guard.png';
import hunter from '../../assets/avatars/raw/hunter.png';
import idiot from '../../assets/avatars/raw/idiot.png';
import knight from '../../assets/avatars/raw/knight.png';
import magician from '../../assets/avatars/raw/magician.png';
import maskedMan from '../../assets/avatars/raw/maskedMan.png';
import masquerade from '../../assets/avatars/raw/masquerade.png';
import mirrorSeer from '../../assets/avatars/raw/mirrorSeer.png';
import nightmare from '../../assets/avatars/raw/nightmare.png';
import piper from '../../assets/avatars/raw/piper.png';
import poisoner from '../../assets/avatars/raw/poisoner.png';
import psychic from '../../assets/avatars/raw/psychic.png';
import pureWhite from '../../assets/avatars/raw/pureWhite.png';
import seer from '../../assets/avatars/raw/seer.png';
import sequencePrince from '../../assets/avatars/raw/sequencePrince.png';
import shadow from '../../assets/avatars/raw/shadow.png';
import silenceElder from '../../assets/avatars/raw/silenceElder.png';
import slacker from '../../assets/avatars/raw/slacker.png';
import spiritKnight from '../../assets/avatars/raw/spiritKnight.png';
import thief from '../../assets/avatars/raw/thief.png';
import treasureMaster from '../../assets/avatars/raw/treasureMaster.png';
import villager from '../../assets/avatars/raw/villager.png';
import votebanElder from '../../assets/avatars/raw/votebanElder.png';
import warden from '../../assets/avatars/raw/warden.png';
import wildChild from '../../assets/avatars/raw/wildChild.png';
import witch from '../../assets/avatars/raw/witch.png';
import witcher from '../../assets/avatars/raw/witcher.png';
import wolf from '../../assets/avatars/raw/wolf.png';
import wolfKing from '../../assets/avatars/raw/wolfKing.png';
import wolfQueen from '../../assets/avatars/raw/wolfQueen.png';
import wolfRobot from '../../assets/avatars/raw/wolfRobot.png';
import wolfWitch from '../../assets/avatars/raw/wolfWitch.png';
// --- Thumbnail imports ---
import thumb_avenger from '../../assets/badges/png/512/role_avenger.png';
import thumb_awakenedGargoyle from '../../assets/badges/png/512/role_awakenedGargoyle.png';
import thumb_bloodMoon from '../../assets/badges/png/512/role_bloodMoon.png';
import thumb_crow from '../../assets/badges/png/512/role_crow.png';
import thumb_cupid from '../../assets/badges/png/512/role_cupid.png';
import thumb_cursedFox from '../../assets/badges/png/512/role_cursedFox.png';
import thumb_dancer from '../../assets/badges/png/512/role_dancer.png';
import thumb_darkWolfKing from '../../assets/badges/png/512/role_darkWolfKing.png';
import thumb_dreamcatcher from '../../assets/badges/png/512/role_dreamcatcher.png';
import thumb_drunkSeer from '../../assets/badges/png/512/role_drunkSeer.png';
import thumb_eclipseWolfQueen from '../../assets/badges/png/512/role_eclipseWolfQueen.png';
import thumb_gargoyle from '../../assets/badges/png/512/role_gargoyle.png';
import thumb_graveyardKeeper from '../../assets/badges/png/512/role_graveyardKeeper.png';
import thumb_guard from '../../assets/badges/png/512/role_guard.png';
import thumb_hunter from '../../assets/badges/png/512/role_hunter.png';
import thumb_idiot from '../../assets/badges/png/512/role_idiot.png';
import thumb_knight from '../../assets/badges/png/512/role_knight.png';
import thumb_magician from '../../assets/badges/png/512/role_magician.png';
import thumb_maskedMan from '../../assets/badges/png/512/role_maskedMan.png';
import thumb_masquerade from '../../assets/badges/png/512/role_masquerade.png';
import thumb_mirrorSeer from '../../assets/badges/png/512/role_mirrorSeer.png';
import thumb_nightmare from '../../assets/badges/png/512/role_nightmare.png';
import thumb_piper from '../../assets/badges/png/512/role_piper.png';
import thumb_poisoner from '../../assets/badges/png/512/role_poisoner.png';
import thumb_psychic from '../../assets/badges/png/512/role_psychic.png';
import thumb_pureWhite from '../../assets/badges/png/512/role_pureWhite.png';
import thumb_seer from '../../assets/badges/png/512/role_seer.png';
import thumb_sequencePrince from '../../assets/badges/png/512/role_sequencePrince.png';
import thumb_shadow from '../../assets/badges/png/512/role_shadow.png';
import thumb_silenceElder from '../../assets/badges/png/512/role_silenceElder.png';
import thumb_slacker from '../../assets/badges/png/512/role_slacker.png';
import thumb_spiritKnight from '../../assets/badges/png/512/role_spiritKnight.png';
import thumb_thief from '../../assets/badges/png/512/role_thief.png';
import thumb_treasureMaster from '../../assets/badges/png/512/role_treasureMaster.png';
import thumb_villager from '../../assets/badges/png/512/role_villager.png';
import thumb_votebanElder from '../../assets/badges/png/512/role_votebanElder.png';
import thumb_warden from '../../assets/badges/png/512/role_warden.png';
import thumb_wildChild from '../../assets/badges/png/512/role_wildChild.png';
import thumb_witch from '../../assets/badges/png/512/role_witch.png';
import thumb_witcher from '../../assets/badges/png/512/role_witcher.png';
import thumb_wolf from '../../assets/badges/png/512/role_wolf.png';
import thumb_wolfKing from '../../assets/badges/png/512/role_wolfKing.png';
import thumb_wolfQueen from '../../assets/badges/png/512/role_wolfQueen.png';
import thumb_wolfRobot from '../../assets/badges/png/512/role_wolfRobot.png';
import thumb_wolfWitch from '../../assets/badges/png/512/role_wolfWitch.png';

// prettier-ignore
export const AVATAR_IMAGE_MAP: Record<HandDrawnAvatarId, number> = {
  avenger,
  awakenedGargoyle,
  bloodMoon,
  crow,
  cursedFox,
  cupid,
  dancer,
  darkWolfKing,
  dreamcatcher,
  drunkSeer,
  eclipseWolfQueen,
  gargoyle,
  graveyardKeeper,
  guard,
  hunter,
  idiot,
  knight,
  magician,
  maskedMan,
  masquerade,
  mirrorSeer,
  nightmare,
  piper,
  poisoner,
  psychic,
  pureWhite,
  seer,
  sequencePrince,
  shadow,
  silenceElder,
  slacker,
  spiritKnight,
  thief,
  treasureMaster,
  villager,
  votebanElder,
  warden,
  wildChild,
  witch,
  witcher,
  wolf,
  wolfKing,
  wolfQueen,
  wolfRobot,
  wolfWitch,
};

// prettier-ignore
export const AVATAR_THUMB_MAP: Record<HandDrawnAvatarId, number> = {
  avenger: thumb_avenger,
  awakenedGargoyle: thumb_awakenedGargoyle,
  bloodMoon: thumb_bloodMoon,
  crow: thumb_crow,
  cursedFox: thumb_cursedFox,
  cupid: thumb_cupid,
  dancer: thumb_dancer,
  darkWolfKing: thumb_darkWolfKing,
  dreamcatcher: thumb_dreamcatcher,
  drunkSeer: thumb_drunkSeer,
  eclipseWolfQueen: thumb_eclipseWolfQueen,
  gargoyle: thumb_gargoyle,
  graveyardKeeper: thumb_graveyardKeeper,
  guard: thumb_guard,
  hunter: thumb_hunter,
  idiot: thumb_idiot,
  knight: thumb_knight,
  magician: thumb_magician,
  maskedMan: thumb_maskedMan,
  masquerade: thumb_masquerade,
  mirrorSeer: thumb_mirrorSeer,
  nightmare: thumb_nightmare,
  piper: thumb_piper,
  poisoner: thumb_poisoner,
  psychic: thumb_psychic,
  pureWhite: thumb_pureWhite,
  seer: thumb_seer,
  sequencePrince: thumb_sequencePrince,
  shadow: thumb_shadow,
  silenceElder: thumb_silenceElder,
  slacker: thumb_slacker,
  spiritKnight: thumb_spiritKnight,
  thief: thumb_thief,
  treasureMaster: thumb_treasureMaster,
  villager: thumb_villager,
  votebanElder: thumb_votebanElder,
  warden: thumb_warden,
  wildChild: thumb_wildChild,
  witch: thumb_witch,
  witcher: thumb_witcher,
  wolf: thumb_wolf,
  wolfKing: thumb_wolfKing,
  wolfQueen: thumb_wolfQueen,
  wolfRobot: thumb_wolfRobot,
  wolfWitch: thumb_wolfWitch,
};
