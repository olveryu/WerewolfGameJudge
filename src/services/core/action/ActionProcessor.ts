/**
 * ActionProcessor - Night action processing module
 *
 * Phase 5 of GameStateService refactoring: Extract action processing logic
 *
 * Responsibilities:
 * - Build action input from wire protocol
 * - Invoke resolvers and apply results
 * - Calculate deaths at end of night
 * - Wolf vote resolution
 *
 * NOT responsible for:
 * - Night flow control (handled by NightFlowController)
 * - State persistence (handled by StatePersistence)
 * - Broadcast communication (handled by BroadcastCoordinator)
 *
 * Integration Pattern:
 * - ActionProcessor is a pure computation module
 * - Takes context as input, returns results
 * - Does NOT directly modify game state
 * - Caller applies results to state
 *
 * @module ActionProcessor
 */

import { RoleId, ROLE_SPECS, isWolfRole } from '../../../models/roles';
import { type SchemaId, SCHEMAS } from '../../../models/roles/spec';
import {
  type ResolverContext,
  type ActionInput,
  type ResolverResult,
} from '../night/resolvers/types';
import { RESOLVERS } from '../night/resolvers';
import {
  wolfVoteResolver,
  type WolfVoteContext,
  type WolfVoteInput,
} from '../night/resolvers/wolfVote';
import { calculateDeaths, type NightActions, type RoleSeatMap } from '../DeathCalculator';
import { resolveWolfVotes } from '../WolfVoteResolver';
import {
  makeActionTarget,
  makeActionWitch,
  makeWitchSave,
  makeWitchPoison,
  makeActionMagicianSwap,
  type RoleAction,
} from '../../../models/actions';
import { log } from '../../../utils/logger';

// Defensive initialization for logger (some test environments may not have log initialized)
const actionProcessorLog = log?.extend?.('ActionProcessor') ?? {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: console.error.bind(console, '[ActionProcessor]'),
};

// =============================================================================
// Types
// =============================================================================

/** Game state context for action processing */
export interface ActionContext {
  /** Seat → RoleId map */
  players: ReadonlyMap<number, RoleId>;
  /** Current night results (for nightmare block, etc.) */
  currentNightResults: Record<string, unknown>;
  /** Witch context for resolver */
  witchContext?: {
    canSave: boolean;
    canPoison: boolean;
  };
  /** Actions recorded this night */
  actions: ReadonlyMap<string, RoleAction>;
  /** Wolf votes recorded this night */
  wolfVotes: ReadonlyMap<number, number>;
}

/** Result of action processing */
export interface ActionProcessResult {
  /** Whether action was valid */
  valid: boolean;
  /** Rejection reason if not valid */
  rejectReason?: string;
  /** Updates to apply to currentNightResults */
  updates?: Record<string, unknown>;
  /** Reveal result to set in state */
  reveal?: {
    type: 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';
    targetSeat: number;
    result: string;
  };
  /** RoleAction to record */
  actionToRecord?: RoleAction;
}

/** Result of wolf vote processing */
export interface WolfVoteProcessResult {
  /** Whether vote was valid */
  valid: boolean;
  /** Rejection reason if not valid */
  rejectReason?: string;
  /** Whether all wolves have voted */
  allVoted: boolean;
  /** Resolved target if all voted, null if no consensus */
  resolvedTarget: number | null;
  /** RoleAction to record (only when all voted) */
  actionToRecord?: RoleAction;
}

/** Configuration for death calculation */
export interface DeathCalculationContext {
  /** Actions recorded this night */
  actions: ReadonlyMap<string, RoleAction>;
  /** Role → Seat mapping for death calculation */
  roleSeatMap: RoleSeatMap;
}

// =============================================================================
// ActionProcessor Class
// =============================================================================

export class ActionProcessor {
  // ===========================================================================
  // Resolver Integration
  // ===========================================================================

  /**
   * Invoke a resolver for the given schemaId.
   * Returns validation + computed result.
   *
   * @param schemaId - The current step's schema ID
   * @param actorSeat - The seat of the player performing the action
   * @param actorRoleId - The role of the player
   * @param input - The action input
   * @param context - Game state context
   * @returns ResolverResult with valid/rejectReason/updates/result
   */
  invokeResolver(
    schemaId: SchemaId,
    actorSeat: number,
    actorRoleId: RoleId,
    input: ActionInput,
    context: ActionContext,
  ): ResolverResult {
    const resolver = RESOLVERS[schemaId];

    // Some schemas don't have resolvers (e.g., hunterConfirm is just an ACK)
    if (!resolver) {
      return { valid: true };
    }

    const resolverContext: ResolverContext = {
      actorSeat,
      actorRoleId,
      players: context.players,
      currentNightResults: context.currentNightResults,
      gameState: {
        witchHasAntidote: context.witchContext?.canSave ?? true,
        witchHasPoison: context.witchContext?.canPoison ?? true,
        isNight1: true, // Night-1-only scope
      },
    };

    return resolver(resolverContext, input);
  }

  /**
   * Build ActionInput from wire protocol.
   *
   * @param schemaId - The schema ID to determine input shape
   * @param target - The target seat (or encoded value for magician)
   * @param extra - Extra payload (e.g., { poison: true } for witch)
   * @returns ActionInput for resolver
   */
  buildActionInput(schemaId: SchemaId, target: number | null, extra?: unknown): ActionInput {
    const input: ActionInput = { schemaId };
    const schema = SCHEMAS[schemaId];
    if (!schema) return input;

    switch (schema.kind) {
      case 'chooseSeat':
        return { ...input, target: target ?? undefined };

      case 'wolfVote':
        return { ...input, target: target ?? undefined };

      case 'compound':
        // Witch: { save: true, target } or { poison: true, target } or skip
        if (extra && typeof extra === 'object') {
          if ('save' in extra) {
            return { ...input, stepResults: { save: target } };
          } else if ('poison' in extra) {
            return { ...input, stepResults: { poison: target } };
          }
        }
        // Skip case: provide empty stepResults so resolver doesn't reject
        return { ...input, stepResults: {} };

      case 'swap':
        // Magician: encoded target = firstSeat + secondSeat * 100
        if (target !== null && target >= 100) {
          const firstSeat = target % 100;
          const secondSeat = Math.floor(target / 100);
          return { ...input, targets: [firstSeat, secondSeat] };
        }
        return input;

      case 'confirm':
        return { ...input, confirmed: true };

      default:
        return input;
    }
  }

  /**
   * Build witch action from wire protocol.
   * @private
   */
  private buildWitchAction(target: number, extra: unknown): RoleAction | null {
    if (typeof extra !== 'object' || extra === null) {
      actionProcessorLog.error(
        'Invalid witch extra payload (expected {poison:true} or {save:true}).',
      );
      return null;
    }

    if ('poison' in extra && extra.poison === true) {
      return makeActionWitch(makeWitchPoison(target));
    }
    if ('save' in extra && extra.save === true) {
      return makeActionWitch(makeWitchSave(target));
    }

    actionProcessorLog.error('Invalid witch extra payload (missing save/poison)');
    return null;
  }

  /**
   * Build magician swap action from encoded target.
   * @private
   */
  private buildMagicianAction(encodedTarget: number): RoleAction | null {
    if (encodedTarget < 100) {
      actionProcessorLog.error(
        'Magician protocol error: encoded target < 100.',
        'target:',
        encodedTarget,
      );
      return null;
    }
    const firstSeat = encodedTarget % 100;
    const secondSeat = Math.floor(encodedTarget / 100);
    // Validate seat range [0..11] for 12-player games
    if (secondSeat > 11 || firstSeat > 11 || firstSeat < 0) {
      actionProcessorLog.error(
        'Magician protocol error: seat out of range.',
        'firstSeat:',
        firstSeat,
        'secondSeat:',
        secondSeat,
      );
      return null;
    }
    return makeActionMagicianSwap(firstSeat, secondSeat);
  }

  /**
   * Build RoleAction from wire protocol.
   * Returns null if action cannot be built.
   *
   * @param role - The role performing the action
   * @param target - The target seat (or encoded value for magician)
   * @param extra - Extra payload (e.g., { poison: true } for witch)
   * @returns RoleAction or null if cannot be built
   */
  buildRoleAction(role: RoleId, target: number | null, extra?: unknown): RoleAction | null {
    if (target === null) return null;

    if (role === 'witch') {
      return this.buildWitchAction(target, extra);
    }
    if (role === 'magician') {
      return this.buildMagicianAction(target);
    }
    return makeActionTarget(target);
  }

  /**
   * Build reveal result from resolver result.
   * Returns null if no reveal.
   *
   * @param role - The role performing the action
   * @param target - The target seat
   * @param resolverResult - Result from resolver
   * @returns Reveal info or null
   */
  buildRevealFromResult(
    role: RoleId,
    target: number,
    resolverResult: NonNullable<ResolverResult['result']>,
  ): ActionProcessResult['reveal'] | null {
    // Seer: faction check result
    if (resolverResult.checkResult) {
      return {
        type: 'seer',
        targetSeat: target,
        result: resolverResult.checkResult,
      };
    }

    // Psychic/Gargoyle/WolfRobot: identity result
    if (resolverResult.identityResult) {
      const displayName = ROLE_SPECS[resolverResult.identityResult].displayName;

      if (role === 'psychic') {
        return { type: 'psychic', targetSeat: target, result: displayName };
      } else if (role === 'gargoyle') {
        return { type: 'gargoyle', targetSeat: target, result: displayName };
      } else if (role === 'wolfRobot') {
        return { type: 'wolfRobot', targetSeat: target, result: displayName };
      }
    }

    return null;
  }

  // ===========================================================================
  // Action Processing
  // ===========================================================================

  /**
   * Process a player action.
   * Validates via resolver and builds result.
   * Does NOT modify state - returns result for caller to apply.
   *
   * @param schemaId - The current step's schema ID
   * @param actorSeat - The seat of the player performing the action
   * @param actorRoleId - The role of the player
   * @param target - The target seat (or encoded value for magician)
   * @param extra - Extra payload
   * @param context - Game state context
   * @returns ActionProcessResult
   */
  processAction(
    schemaId: SchemaId,
    actorSeat: number,
    actorRoleId: RoleId,
    target: number | null,
    extra: unknown,
    context: ActionContext,
  ): ActionProcessResult {
    // Build input
    const input = this.buildActionInput(schemaId, target, extra);

    // Invoke resolver
    const resolverResult = this.invokeResolver(schemaId, actorSeat, actorRoleId, input, context);

    if (!resolverResult.valid) {
      return {
        valid: false,
        rejectReason: resolverResult.rejectReason ?? '行动无效',
      };
    }

    // Build role action
    const actionToRecord = this.buildRoleAction(actorRoleId, target, extra);

    // Build reveal if any
    let reveal: ActionProcessResult['reveal'] | undefined;
    if (resolverResult.result && target !== null) {
      const revealResult = this.buildRevealFromResult(actorRoleId, target, resolverResult.result);
      if (revealResult) {
        reveal = revealResult;
      }
    }

    return {
      valid: true,
      updates: resolverResult.updates,
      reveal,
      actionToRecord: actionToRecord ?? undefined,
    };
  }

  // ===========================================================================
  // Wolf Vote Processing
  // ===========================================================================

  /**
   * Validate a wolf vote using wolfVoteResolver.
   *
   * @param targetSeat - The target seat for the kill
   * @param context - Game state context (for player roles)
   * @returns Validation result
   */
  validateWolfVote(
    targetSeat: number,
    context: ActionContext,
  ): { valid: boolean; rejectReason?: string } {
    const resolverContext: WolfVoteContext = {
      players: context.players,
    };
    const resolverInput: WolfVoteInput = { targetSeat };
    const result = wolfVoteResolver(resolverContext, resolverInput);

    if (!result.valid) {
      return { valid: false, rejectReason: result.rejectReason ?? '无效目标' };
    }
    return { valid: true };
  }

  /**
   * Resolve final wolf kill target from votes.
   *
   * @param wolfVotes - Map of wolf seat → target seat
   * @returns Resolved target seat, or null if no consensus
   */
  resolveWolfVotes(wolfVotes: ReadonlyMap<number, number>): number | null {
    // Convert to mutable Map for resolveWolfVotes function
    const mutableVotes = new Map(wolfVotes);
    return resolveWolfVotes(mutableVotes);
  }

  // ===========================================================================
  // Death Calculation
  // ===========================================================================

  /**
   * Build NightActions from recorded actions.
   *
   * @param actions - Map of role → RoleAction
   * @param players - Optional players map (needed for nightmareBlockedWolf check)
   * @returns NightActions for death calculator
   */
  buildNightActions(
    actions: ReadonlyMap<string, RoleAction>,
    players?: ReadonlyMap<number, { role?: RoleId | null } | null>,
  ): NightActions {
    const nightActions: NightActions = {};

    // Wolf kill
    const wolfAction = actions.get('wolf');
    if (wolfAction?.kind === 'target') {
      nightActions.wolfKill = wolfAction.targetSeat;
    }

    // Guard protect
    const guardAction = actions.get('guard');
    if (guardAction?.kind === 'target') {
      nightActions.guardProtect = guardAction.targetSeat;
    }

    // Witch actions
    const witchAction = actions.get('witch');
    if (witchAction?.kind === 'witch') {
      nightActions.witchAction = witchAction.witchAction;
    }

    // Wolf queen charm
    const wolfQueenAction = actions.get('wolfQueen');
    if (wolfQueenAction?.kind === 'target') {
      nightActions.wolfQueenCharm = wolfQueenAction.targetSeat;
    }

    // Dreamcatcher dream
    const dreamcatcherAction = actions.get('dreamcatcher');
    if (dreamcatcherAction?.kind === 'target') {
      nightActions.dreamcatcherDream = dreamcatcherAction.targetSeat;
    }

    // Magician swap
    const magicianAction = actions.get('magician');
    if (magicianAction?.kind === 'magicianSwap') {
      nightActions.magicianSwap = {
        first: magicianAction.firstSeat,
        second: magicianAction.secondSeat,
      };
    }

    // Seer check (for death calc context)
    const seerAction = actions.get('seer');
    if (seerAction?.kind === 'target') {
      nightActions.seerCheck = seerAction.targetSeat;
    }

    // Nightmare block
    const nightmareAction = actions.get('nightmare');
    if (nightmareAction?.kind === 'target') {
      nightActions.nightmareBlock = nightmareAction.targetSeat;

      // Check if nightmare blocked a wolf player on night 1
      // If so, wolves cannot kill this night
      if (players) {
        const blockedSeat = nightmareAction.targetSeat;
        const blockedPlayer = players.get(blockedSeat);
        if (blockedPlayer?.role && isWolfRole(blockedPlayer.role)) {
          nightActions.nightmareBlockedWolf = true;
        }
      }
    }

    return nightActions;
  }

  /**
   * Calculate deaths for the night.
   *
   * @param context - Death calculation context
   * @returns Array of seat numbers that died
   */
  calculateDeaths(context: DeathCalculationContext): number[] {
    const nightActions = this.buildNightActions(context.actions);
    return calculateDeaths(nightActions, context.roleSeatMap);
  }

  // ===========================================================================
  // Reveal Role Check
  // ===========================================================================

  /**
   * Check if a role requires reveal acknowledgment before advancing.
   * Roles that show private information to the player need explicit ACK.
   *
   * @param role - The role to check
   * @returns true if role requires reveal ACK
   */
  isRevealRole(role: RoleId): boolean {
    return role === 'seer' || role === 'psychic' || role === 'gargoyle' || role === 'wolfRobot';
  }
}
