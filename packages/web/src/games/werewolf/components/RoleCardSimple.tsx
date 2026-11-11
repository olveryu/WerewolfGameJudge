/**
 * RoleCardSimple (werewolf) — the werewolf role card dialog over the shared `RoleCardDialog`.
 *
 * Role data comes from `toRevealRoleData`; the AI pill and the variant pill bar go into the shared
 * card's footer. Every faction color follows the presented identity (after displayAs), the same
 * identity the card shows, so a disguised role never leaks its real faction.
 */
import './RoleCardSimple.css';
import './faction.css';

import { ROLE_SPECS, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { askAIAboutRole, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';
import { TESTIDS } from '@/testids';
import IconSparklesOutline from '~icons/ion/sparkles-outline';

import { toRevealRoleData } from './WerewolfRoleCardAdapter';

interface RoleCardSimpleProps {
  readonly visible: boolean;
  readonly roleId: RoleId | null;
  readonly onClose: () => void;
  /** Shows the role's real identity (skipping the displayAs disguise): the judge-view preview. */
  readonly showRealIdentity?: boolean;
  /** Dual-seer label (1 or 2): the role name reads "X号预言家". */
  readonly seerLabel?: number;
  /** Every variant roleId including the base role; the pill bar shows when there are several. */
  readonly variantIds?: readonly RoleId[];
  /** Currently selected variant roleId. */
  readonly activeVariant?: RoleId;
  /** Called when the user taps a variant pill. */
  readonly onVariantSelect?: (variantId: RoleId) => void;
  /** Overrides the mounted-chat handler; receives the card's presented identity. */
  readonly onAskAI?: (displayRoleId: RoleId) => void;
}

export function RoleCardSimple({
  visible,
  roleId,
  onClose,
  showRealIdentity,
  seerLabel,
  variantIds,
  activeVariant,
  onVariantSelect,
  onAskAI,
}: RoleCardSimpleProps) {
  const isAIChatAvailable = useAIChatAvailable();
  if (!visible || roleId === null) return null;
  const displayRoleId = activeVariant ?? roleId;
  const role = toRevealRoleData(displayRoleId, { showRealIdentity, seerLabel });
  const handleAskAI =
    onAskAI ?? (isAIChatAvailable ? (id: RoleId) => askAIAboutRole(id, onClose) : undefined);
  const showVariantBar =
    variantIds !== undefined && variantIds.length > 1 && onVariantSelect !== undefined;

  return (
    <RoleCardDialog
      role={role}
      onClose={onClose}
      confirmText="知道了"
      footer={
        <>
          {handleAskAI !== undefined && (
            <button
              type="button"
              className="role-ai-pill"
              data-alignment={role.alignment}
              data-faction={role.alignment}
              onClick={() => handleAskAI(role.displayId)}
            >
              <IconSparklesOutline aria-hidden />
              AI 攻略
            </button>
          )}
          {showVariantBar && (
            <div className="role-variant-bar" data-alignment={role.alignment}>
              {variantIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="role-variant-pill"
                  aria-pressed={id === activeVariant}
                  data-testid={TESTIDS.configVariantOption(id)}
                  onClick={() => onVariantSelect(id)}
                >
                  {ROLE_SPECS[id].displayName}
                </button>
              ))}
            </div>
          )}
        </>
      }
    />
  );
}
