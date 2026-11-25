/**
 * Role lookups for the domain layer — re-exported from the role catalog,
 * which reads every value from the role files.
 */

export {
  doesRoleParticipateInWolfVote,
  Faction,
  getAllRoleIds,
  getRoleCard,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleStructuredDescription,
  isValidRoleId,
  isWolfRole,
  type RoleCard,
  type RoleId,
  Team,
} from '../../../roles/catalog';
export { type RoleAbilityTag, type RoleDescription } from '../../../roles/role';
export { CAMP_ORDER, type CampBucket, getRoleCamp } from './camp';
