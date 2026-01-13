/**
 * God Base Role
 * 
 * Abstract base class for all god (神职) roles.
 * Gods are special villager-aligned roles with unique powers.
 */

import { BaseRole, Faction } from './BaseRole';

export abstract class GodBaseRole extends BaseRole {
  readonly faction = Faction.God;
}
