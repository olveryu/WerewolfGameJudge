import { crow } from './crow';
import { cupidPresence } from './cupid';
import { dreamcatcher } from './dreamcatcher';
import { drunkSeer, drunkSeerPresence } from './drunkSeer';
import { eclipseWolfQueen } from './eclipseWolfQueen';
import { gargoyle } from './gargoyle';
import { guard } from './guard';
import { mirrorSeer, mirrorSeerPresence } from './mirrorSeer';
import { nightmare } from './nightmare';
import {
  bloodMoon,
  cursedFox,
  dancer,
  graveyardKeeper,
  idiot,
  knight,
  maskedMan,
  masquerade,
  sequencePrince,
  spiritKnight,
  villager,
  warden,
  witcher,
  wolfKing,
} from './passiveRoles';
import { poisonerPresence } from './poisoner';
import { poisoner } from './poisoner';
import type { PresenceDeclaration } from './presence';
import { psychic } from './psychic';
import { pureWhite } from './pureWhite';
import { seerPresence } from './seer';
import { seer } from './seer';
import { shadow } from './shadow';
import { silenceElder } from './silenceElder';
import { slacker } from './slacker';
import { thief, thiefPresence } from './thief';
import { treasureMaster, treasureMasterPresence } from './treasureMaster';
import { avenger, darkWolfKing, hiddenWolf, hunter } from './viewRoles';
import { votebanElder } from './votebanElder';
import { wildChild } from './wildChild';
import { wolfQueen } from './wolfQueen';
import { wolfWitch } from './wolfWitch';

export { createWerewolfRoleContext, type WerewolfRoleContext } from './context';
export {
  type AttackCause,
  type DeathCause,
  type DeathEffect,
  type DeathResolution,
  type DeathTraceEntry,
  resolveDeathEffects,
} from './deathEffects';
export {
  getActiveRoleIds,
  getSeatIdentity,
  grantBorrowedAbility,
  type IdentityLayer,
  replaceCurrentRole,
  type SeatIdentity,
} from './identity';
export {
  type LocationLayer,
  resolveSelectedSeat,
  resolveSelectedSeats,
  resolveTargetSelection,
  type SeatSwap,
  type TargetSelection,
} from './location';
export {
  type NightPresenceFacts,
  type PresenceDeclaration,
  type PresenceEffect,
  resolveNightPresenceFacts,
} from './presence';
export type {
  RoleSelection,
  WerewolfBottomCard,
  WerewolfNightFacts,
  WerewolfRoleFaction,
  WerewolfRoleIdentityChange,
  WerewolfRoleResource,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfRoleStepResult,
  WerewolfRoleTeam,
} from './role';
export { defineRole, type WerewolfRoleDefinition } from './role';
export { getSeenRole, type SightLayer } from './sight';

export const WEREWOLF_ROLE_DEFINITIONS = [
  seer,
  mirrorSeer,
  drunkSeer,
  psychic,
  gargoyle,
  pureWhite,
  wolfWitch,
  guard,
  dreamcatcher,
  silenceElder,
  votebanElder,
  crow,
  wolfQueen,
  nightmare,
  eclipseWolfQueen,
  poisoner,
  slacker,
  wildChild,
  shadow,
  hunter,
  darkWolfKing,
  hiddenWolf,
  avenger,
  thief,
  treasureMaster,
  villager,
  idiot,
  knight,
  witcher,
  graveyardKeeper,
  dancer,
  sequencePrince,
  wolfKing,
  bloodMoon,
  spiritKnight,
  masquerade,
  warden,
  cursedFox,
  maskedMan,
] as const;

export const WEREWOLF_PRESENCE_DECLARATIONS = [
  ...poisonerPresence,
  ...cupidPresence,
  ...thiefPresence,
  ...treasureMasterPresence,
  ...seerPresence,
  ...mirrorSeerPresence,
  ...drunkSeerPresence,
] as const satisfies readonly PresenceDeclaration<string>[];
