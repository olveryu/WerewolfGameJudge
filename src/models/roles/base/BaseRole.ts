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

/**
 * Context passed to role methods for decision making
 * Currently only used by WitchRole for multi-phase dialog
 */
export interface RoleActionContext {
  /** Current player's seat number (0-based) */
  mySeatNumber: number;
  
  /** Index of the player killed by wolves this night (-1 if none) */
  killedIndex: number;
  
  /** Callback to proceed with action */
  proceedWithAction: (target: number | null, isPoison?: boolean) => void;
  
  /** Callback to show next dialog */
  showNextDialog?: () => void;
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
  
  /**
   * Action title shown in dialog (e.g., "狼人请睁眼")
   * Default: "{displayName}请睁眼"
   */
  get actionTitle(): string {
    return `${this.displayName}请睁眼`;
  }

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
   * Check if this role is a wolf
   */
  get isWolf(): boolean {
    return this.faction === 'wolf';
  }
  
  /**
   * Get the action dialog configuration for this role
   * Default implementation returns standard dialog with actionTitle + actionMessage
   * Override in subclass for role-specific dialogs (e.g., Witch's multi-phase dialog)
   */
  getActionDialogConfig(_context: RoleActionContext): ActionDialogConfig | null {
    if (!this.hasNightAction) return null;
    return {
      title: this.actionTitle,
      message: this.actionMessage,
      buttons: [{ text: '好', onPress: () => {} }]
    };
  }
}
