/**
 * Base Role Model
 * 
 * Abstract base class for all role models.
 * Each role should extend this class and implement role-specific logic.
 */

/**
 * Role faction enum
 */
export enum Faction {
  Wolf = 'wolf',
  God = 'god',
  Villager = 'villager',
  Special = 'special',
}

export interface ActionDialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
}

export interface ActionDialogConfig {
  title: string;
  message?: string;
  buttons: ActionDialogButton[];
}

export interface ActionResult {
  success: boolean;
  target?: number | null;
  actionType?: string;
  error?: string;
}

export abstract class BaseRole {
  /** Unique role identifier */
  abstract readonly id: string;
  
  /** Display name in Chinese */
  abstract readonly displayName: string;
  
  /** Display name in English (optional, derived from class name if not set) */
  readonly englishName?: string;
  
  /** Role faction */
  abstract readonly faction: Faction;
  
  /** Role description */
  abstract readonly description: string;
  
  /** Whether this role has a night action */
  abstract readonly hasNightAction: boolean;
  
  /** Priority in night action order (lower = earlier) */
  abstract readonly actionOrder: number;
  
  /** Action message shown during night phase */
  readonly actionMessage?: string;
  
  /** Confirm button text for action */
  readonly actionConfirmMessage?: string;
  
  /**
   * Whether this role can save itself (relevant for witch)
   * Default: true (most roles don't have this restriction)
   */
  readonly canSaveSelf: boolean = true;
  
  /**
   * Whether this role participates in wolf kill vote
   * Default: false (only wolves vote)
   */
  readonly participatesInWolfVote: boolean = false;
  
  /**
   * Whether this role can see other wolves' identities
   * Default: false
   */
  readonly canSeeWolves: boolean = false;
  
  /**
   * Whether this role is immune to wolf kill
   * Default: false
   */
  readonly immuneToWolfKill: boolean = false;
  
  /**
   * Whether this role is immune to witch poison
   * Default: false
   */
  readonly immuneToPoison: boolean = false;
  
  /**
   * Check if this role is a wolf
   */
  get isWolf(): boolean {
    return this.faction === 'wolf';
  }
  
  /**
   * Check if this role is a god (special power role on villager side)
   */
  get isGod(): boolean {
    return this.faction === 'god';
  }
  
  /**
   * Get the action dialog configuration for this role
   * Override in subclass for role-specific dialogs
   */
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    return null;
  }
  
  /**
   * Validate if an action is legal for this role
   * Override in subclass for role-specific validation
   */
  validateAction(_target: number | null, _context: RoleActionContext): ActionResult {
    return { success: true };
  }
}

/**
 * Context passed to role methods for decision making
 */
export interface RoleActionContext {
  /** Current player's seat number (0-based) */
  mySeatNumber: number;
  
  /** Index of the player killed by wolves this night (-1 if none) */
  killedIndex: number;
  
  /** Total number of players */
  playerCount: number;
  
  /** List of alive player indices */
  alivePlayers: number[];
  
  /** Actions taken so far this night */
  currentActions: Record<string, number>;
  
  /** Callback to proceed with action */
  proceedWithAction: (target: number | null, isPoison?: boolean) => void;
  
  /** Callback to show next dialog */
  showNextDialog?: () => void;
}
