/**
 * useConfigScreenState — ConfigScreen state & callbacks
 *
 * Owns the board draft (role toggles, picked variants, matched preset pill), the rules handed
 * to the Rules step, the role info card and the faction tabs. Nominate mode submits the board
 * directly; otherwise the Rules step owns create/save.
 */

import {
  Faction,
  type GameRuleOverrides,
  type GameState,
  GameStatus,
  PRESET_TEMPLATES,
  type RoleId,
  validateTemplateRoles,
  WEREWOLF_RULES_SCHEMA,
} from '@game-judge/game-engine/games/werewolf/public';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { isSuccessfulRoomCommand } from '@/features/room/link/roomCommandResult';
import { getRememberedGameConfig } from '@/features/settings/rememberedGameConfigs';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigParams, WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { getWerewolfRoomCommandFailureMessage } from '@/games/werewolf/room/werewolfRoomCommandFailureMessage';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import type { FactionTabItem } from './components/FactionTabs';
import { FACTION_GROUPS, type FactionGroup, slotSelectionKey } from './configData';
import {
  computeTotalCount,
  FACTION_COLOR_MAP,
  findRoleSlot,
  getEmptySelection,
  restoreFromTemplateRoles,
  selectionKeyToRoleId,
  selectionToRoles,
  type VariantOverrides,
} from './configHelpers';

/** The host's unsaved board: role toggles, picked variants and the matched preset pill. */
interface BoardDraft {
  readonly selection: Readonly<Record<string, boolean>>;
  readonly variantOverrides: VariantOverrides;
  readonly selectedTemplate: string;
}

const CUSTOM_TEMPLATE = '__custom__';

function toBoardDraft(templateRoles: readonly RoleId[]): BoardDraft {
  const restored = restoreFromTemplateRoles(templateRoles);
  return {
    selection: restored.selection,
    variantOverrides: restored.variantOverrides,
    selectedTemplate: restored.matchedPreset ?? CUSTOM_TEMPLATE,
  };
}

function restoreFromPreset(presetName: string): BoardDraft {
  const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
  if (preset === undefined) {
    throw new Error(`[FAIL-FAST] Unknown werewolf preset: ${presetName}`);
  }
  return toBoardDraft(preset.roles);
}

/** Edit/nominate mode reads the active room synchronously; the room screen opened this flow. */
function readRoomState(roomCode: string, session: WerewolfRoomSession): GameState {
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== roomCode) {
    throw new Error('[FAIL-FAST] werewolf config edit requires its active room session');
  }
  return snapshot.room.state;
}

function readInitialBoardDraft(params: WerewolfConfigParams, session: WerewolfRoomSession) {
  if (params.presetName !== undefined) return restoreFromPreset(params.presetName);
  const roomCode = params.existingRoomCode ?? params.nominateMode?.roomCode;
  if (roomCode === undefined) {
    return {
      selection: getEmptySelection(),
      variantOverrides: {},
      selectedTemplate: CUSTOM_TEMPLATE,
    };
  }
  return toBoardDraft(readRoomState(roomCode, session).templateRoles);
}

/** Rules handed back from the Rules step win; existing rooms edit their own; new rooms start remembered. */
function readInitialRules(
  params: WerewolfConfigParams,
  session: WerewolfRoomSession,
): GameRuleOverrides {
  if (params.updatedRules !== undefined) return params.updatedRules;
  const roomCode = params.existingRoomCode ?? params.nominateMode?.roomCode;
  if (roomCode === undefined) {
    return getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA);
  }
  return readRoomState(roomCode, session).rules ?? {};
}

/** Number of selected copies among a slot's selection keys. */
function countSelectedCopies(
  selection: Readonly<Record<string, boolean>>,
  roleId: RoleId,
  copies: number,
): number {
  let count = 0;
  for (let i = 0; i < copies; i++) {
    if (selection[slotSelectionKey(roleId, i)] === true) count++;
  }
  return count;
}

function getFactionSelectedCount(
  selection: Readonly<Record<string, boolean>>,
  group: FactionGroup,
): number {
  let count = 0;
  for (const section of group.sections) {
    for (const slot of section.roles) {
      count += countSelectedCopies(selection, slot.roleId, slot.count ?? 1);
    }
  }
  return count;
}

interface UseConfigScreenStateParams {
  readonly params: WerewolfConfigParams;
  readonly session: WerewolfRoomSession;
  readonly onPickBoard: () => void;
  readonly onContinue: (rulesParams: WerewolfRulesParams) => void;
  readonly onReturnToRoom: (roomCode: string) => void;
}

export function useConfigScreenState({
  params,
  session,
  onPickBoard,
  onContinue,
  onReturnToRoom,
}: UseConfigScreenStateParams) {
  const { user } = useAuthContext();
  const room = useRoomLinkSnapshot(session);
  const gameState = room.phase === 'ready' ? room.room.state : null;
  const { presetName, updatedRules, nominateMode, existingRoomCode } = params;

  // The draft is seeded once on mount; later room snapshots never overwrite it. Params that
  // change while this screen stays mounted (a board picked, rules edited on the Rules step) are
  // applied during render by comparing against the last applied value.
  const [draft, setDraft] = useState(() => readInitialBoardDraft(params, session));
  const { selection, variantOverrides, selectedTemplate } = draft;
  const [isWorkflowSubmitting, setIsWorkflowSubmitting] = useState(false);
  const [rules, setRules] = useState<GameRuleOverrides>(() => readInitialRules(params, session));

  const [appliedPresetName, setAppliedPresetName] = useState(presetName);
  if (presetName !== appliedPresetName) {
    setAppliedPresetName(presetName);
    if (presetName !== undefined) setDraft(restoreFromPreset(presetName));
  }

  const [appliedUpdatedRules, setAppliedUpdatedRules] = useState(updatedRules);
  if (updatedRules !== appliedUpdatedRules) {
    setAppliedUpdatedRules(updatedRules);
    if (updatedRules !== undefined) setRules(updatedRules);
  }

  const totalCount = computeTotalCount(selection, variantOverrides);

  // ── Return to the room when the game progresses past the nomination phase ──
  useEffect(() => {
    if (nominateMode === undefined || gameState === null) return;
    const canNominate =
      gameState.status === GameStatus.Unseated || gameState.status === GameStatus.Seated;
    if (!canNominate) onReturnToRoom(nominateMode.roomCode);
  }, [gameState, nominateMode, onReturnToRoom]);

  const toggleRole = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      selection: { ...prev.selection, [key]: prev.selection[key] !== true },
      selectedTemplate: CUSTOM_TEMPLATE,
    }));
  };

  const handleClearSelection = () => {
    setDraft((prev) => ({
      ...prev,
      selection: Object.fromEntries(Object.keys(prev.selection).map((key) => [key, false])),
      selectedTemplate: CUSTOM_TEMPLATE,
    }));
  };

  const submitNomination = async (roomCode: string, roles: readonly RoleId[]) => {
    if (user === null) {
      throw new Error('[FAIL-FAST] Werewolf board nomination requires an authenticated user');
    }
    setIsWorkflowSubmitting(true);
    try {
      const result = await session.dispatch(
        {
          type: 'werewolf.board.nominate',
          displayName: user.displayName ?? '匿名玩家',
          roles: [...roles],
        },
        { controlledSeat: null, label: '提交板子建议', durable: false },
      );
      if (!isSuccessfulRoomCommand(result)) {
        showErrorAlert('提交失败', getWerewolfRoomCommandFailureMessage(result));
        return;
      }
      if (result.outcome.reason === 'DEDUPLICATED') {
        toast.info('已有相同板子建议，已自动为你投票');
      }
      onReturnToRoom(roomCode);
    } catch (error) {
      handleError(error, {
        label: '提交板子建议',
        logger: configLog,
        alertMessage: '提交板子建议失败，请重试',
      });
    } finally {
      setIsWorkflowSubmitting(false);
    }
  };

  /** Nominate mode submits the board directly; otherwise the Rules step owns create/save. */
  const handleContinue = () => {
    const roles = selectionToRoles(selection, variantOverrides);
    if (roles.length === 0) {
      showErrorAlert('配置有误', '请至少选择一个角色');
      return;
    }
    const validationError = validateTemplateRoles(roles);
    if (validationError) {
      showErrorAlert('配置有误', validationError);
      return;
    }
    if (nominateMode === undefined) {
      onContinue({ roles, rules, ...(existingRoomCode === undefined ? {} : { existingRoomCode }) });
      return;
    }
    void submitNomination(nominateMode.roomCode, roles);
  };

  // ── Role info card (long-press any chip → RoleCardSimple with variant bar) ──
  const [roleInfoBaseId, setRoleInfoBaseId] = useState<RoleId | null>(null);
  const roleInfoVariants =
    roleInfoBaseId === null ? undefined : findRoleSlot(roleInfoBaseId).variants;
  const roleInfoActiveVariant =
    roleInfoBaseId === null ? undefined : (variantOverrides[roleInfoBaseId] ?? roleInfoBaseId);

  /** Switch variant from within the RoleCardSimple pill bar. */
  const handleRoleInfoVariantSelect = (variantId: RoleId) => {
    if (roleInfoBaseId === null) {
      throw new Error('[FAIL-FAST] Variant selected without an open role info card');
    }
    setDraft((prev) => {
      const nextOverrides = { ...prev.variantOverrides };
      if (variantId === roleInfoBaseId) delete nextOverrides[roleInfoBaseId];
      else nextOverrides[roleInfoBaseId] = variantId;
      return {
        selection:
          prev.selection[roleInfoBaseId] === true
            ? prev.selection
            : { ...prev.selection, [roleInfoBaseId]: true },
        variantOverrides: nextOverrides,
        selectedTemplate: CUSTOM_TEMPLATE,
      };
    });
  };

  // ── Faction tabs ──
  const [activeTab, setActiveTab] = useState<Faction>(Faction.Villager);
  const activeGroup = FACTION_GROUPS.find((group) => group.faction === activeTab);
  if (activeGroup === undefined) {
    throw new Error(`[FAIL-FAST] No config group for faction ${activeTab}`);
  }
  const tabItems: FactionTabItem[] = FACTION_GROUPS.map((group) => ({
    key: group.faction,
    title: group.title,
    count: getFactionSelectedCount(selection, group),
    faction: FACTION_COLOR_MAP[group.faction],
  }));

  const selectedTemplateLabel = selectedTemplate === CUSTOM_TEMPLATE ? '自定义' : selectedTemplate;

  return {
    isNominateMode: nominateMode !== undefined,
    isSubmitting: isWorkflowSubmitting,
    selection,
    totalCount,
    variantOverrides,
    handleTemplatePillPress: onPickBoard,
    handleContinue,
    toggleRole,
    handleClearSelection,
    selectedTemplateLabel,
    // Role info (with variant switching)
    roleInfoId: roleInfoActiveVariant ?? null,
    roleInfoVariantIds:
      roleInfoBaseId !== null && roleInfoVariants !== undefined && roleInfoVariants.length > 0
        ? [roleInfoBaseId, ...roleInfoVariants]
        : [],
    roleInfoActiveVariant,
    handleChipInfoPress: (key: string) => setRoleInfoBaseId(selectionKeyToRoleId(key)),
    handleCloseRoleInfo: () => setRoleInfoBaseId(null),
    handleRoleInfoVariantSelect,
    // Faction tabs
    tabItems,
    activeTab,
    activeGroup,
    handleTabPress: setActiveTab,
    // Bulk stepper
    getBulkCount: (roleId: RoleId, maxCount: number) =>
      countSelectedCopies(selection, roleId, maxCount),
    handleBulkCountChange: (roleId: RoleId, newCount: number) => {
      const maxCount = findRoleSlot(roleId).count ?? 1;
      setDraft((prev) => {
        const nextSelection = { ...prev.selection };
        for (let i = 0; i < maxCount; i++) {
          nextSelection[slotSelectionKey(roleId, i)] = i < newCount;
        }
        return { ...prev, selection: nextSelection, selectedTemplate: CUSTOM_TEMPLATE };
      });
    },
  };
}
