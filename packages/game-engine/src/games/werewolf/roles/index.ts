import type { RoleId } from '../domain/models';
import { avenger } from './avenger';
import { awakenedGargoyle } from './awakenedGargoyle';
import { bloodMoon } from './bloodMoon';
import { crow } from './crow';
import { cupid, cupidPresence } from './cupid';
import { cursedFox } from './cursedFox';
import { dancer } from './dancer';
import { darkWolfKing } from './darkWolfKing';
import { dreamcatcher } from './dreamcatcher';
import { drunkSeer, drunkSeerPresence } from './drunkSeer';
import { eclipseWolfQueen } from './eclipseWolfQueen';
import { gargoyle } from './gargoyle';
import { graveyardKeeper } from './graveyardKeeper';
import { guard } from './guard';
import { hiddenWolf } from './hiddenWolf';
import { hunter } from './hunter';
import { idiot } from './idiot';
import { knight } from './knight';
import { magician } from './magician';
import { maskedMan } from './maskedMan';
import { masquerade } from './masquerade';
import { mirrorSeer, mirrorSeerPresence } from './mirrorSeer';
import { nightmare } from './nightmare';
import { piper } from './piper';
import { poisonerPresence } from './poisoner';
import { poisoner } from './poisoner';
import type { PresenceDeclaration } from './presence';
import { psychic } from './psychic';
import { pureWhite } from './pureWhite';
import { seedWolf } from './seedWolf';
import { seerPresence } from './seer';
import { seer } from './seer';
import { sequencePrince } from './sequencePrince';
import { shadow } from './shadow';
import { silenceElder } from './silenceElder';
import { slacker } from './slacker';
import { spiritKnight } from './spiritKnight';
import { thief, thiefPresence } from './thief';
import { treasureMaster, treasureMasterPresence } from './treasureMaster';
import { villager } from './villager';
import { votebanElder } from './votebanElder';
import { warden } from './warden';
import { wildChild } from './wildChild';
import { witch } from './witch';
import { witcher } from './witcher';
import { wolf } from './wolf';
import { wolfGirl } from './wolfGirl';
import { wolfKillStep } from './wolfKill';
import { wolfKing } from './wolfKing';
import { wolfQueen } from './wolfQueen';
import { wolfRobot } from './wolfRobot';
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
  WerewolfCheckReaction,
  WerewolfNightFacts,
  WerewolfRoleFaction,
  WerewolfRoleIdentityChange,
  WerewolfRoleResource,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfRoleStepDefinition,
  WerewolfRoleStepResult,
  WerewolfRoleTeam,
} from './role';
export { defineRole, type WerewolfRoleDefinition } from './role';
export { getSeenRole, type SightLayer } from './sight';

/** Every role, in the order roles are listed to players. */
export const WEREWOLF_ROLE_DEFINITIONS = [
  villager,
  mirrorSeer,
  drunkSeer,
  seer,
  witch,
  poisoner,
  hunter,
  guard,
  idiot,
  knight,
  magician,
  witcher,
  psychic,
  dreamcatcher,
  graveyardKeeper,
  pureWhite,
  dancer,
  silenceElder,
  votebanElder,
  crow,
  maskedMan,
  sequencePrince,
  wolf,
  seedWolf,
  wolfQueen,
  wolfKing,
  darkWolfKing,
  nightmare,
  gargoyle,
  awakenedGargoyle,
  bloodMoon,
  wolfRobot,
  wolfWitch,
  spiritKnight,
  masquerade,
  warden,
  eclipseWolfQueen,
  hiddenWolf,
  wolfGirl,
  slacker,
  wildChild,
  piper,
  shadow,
  avenger,
  thief,
  cupid,
  treasureMaster,
  cursedFox,
] as const;

export const WEREWOLF_SHARED_STEPS = [wolfKillStep] as const;

/** Static narration keys emitted by a role or shared Werewolf step. */
export interface WerewolfStepAudioDeclaration {
  readonly roleId: RoleId;
  readonly stepId: string;
  readonly begin: string | null;
  readonly end: string | null;
}

/** Audio declarations for every role step and the shared wolf-kill step. */
export const WEREWOLF_STEP_AUDIO_DECLARATIONS = [
  ...WEREWOLF_ROLE_DEFINITIONS.flatMap((role) =>
    role.steps.map((step) => ({
      roleId: role.id,
      stepId: step.id,
      ...step.audio.keys,
    })),
  ),
  ...WEREWOLF_SHARED_STEPS.map((step) => ({
    roleId: 'wolf' as const,
    stepId: step.id,
    ...step.audio.keys,
  })),
] as const satisfies readonly WerewolfStepAudioDeclaration[];

export const WEREWOLF_PRESENCE_DECLARATIONS = [
  ...poisonerPresence,
  ...cupidPresence,
  ...thiefPresence,
  ...treasureMasterPresence,
  ...seerPresence,
  ...mirrorSeerPresence,
  ...drunkSeerPresence,
] as const satisfies readonly PresenceDeclaration<string>[];
