/**
 * useConfigScreenState — ConfigScreen state & callbacks extraction
 *
 * Owns all useState, useEffect, useCallback, useMemo for ConfigScreen.
 * Returns a flat bag of values consumed by ConfigScreen JSX (same pattern
 * as useRoomScreenState for RoomScreen).
 *
 * Does not render JSX, does not import RN components, does not own styles.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { Faction } from '@game-judge/game-engine/games/werewolf/public';
import {
  type GameRuleOverrides,
  type GameState,
  isValidRoleId,
  PRESET_TEMPLATES,
  type RoleId,
  validateTemplateRoles,
  WEREWOLF_RULES_SCHEMA,
} from '@game-judge/game-engine/games/werewolf/public';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner-native';

import { useAuthContext } from '@/contexts/AuthContext';
import { hasPreviousRouteInCurrentNavigator } from '@/features/navigation/model/navigationState';
import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { SettingsService } from '@/features/settings/services/SettingsService';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigStackParamList } from '@/games/werewolf/navigation/types';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { translateReasonCode } from '@/utils/errorUtils';
import { configLog } from '@/utils/logger';

import type { FactionTabItem } from './components';
import { FACTION_GROUPS } from './configData';
import {
  computeTotalCount,
  getEmptySelection,
  restoreFromTemplateRoles,
  selectionToRoles,
  type VariantOverrides,
} from './configHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ConfigNavigationProp = NativeStackNavigationProp<WerewolfConfigStackParamList, 'Config'>;

/** The host's unsaved board: role toggles, picked variants and the matched preset pill. */
interface BoardDraft {
  readonly selection: Record<string, boolean>;
  readonly variantOverrides: VariantOverrides;
  readonly selectedTemplate: string;
}

const CUSTOM_TEMPLATE = '__custom__';

function restoreFromPreset(presetName: string): BoardDraft {
  const preset = PRESET_TEMPLATES.find((p) => p.name === presetName);
  if (preset === undefined) {
    throw new Error(`[FAIL-FAST] Unknown werewolf preset: ${presetName}`);
  }
  const restored = restoreFromTemplateRoles(preset.roles);
  return {
    selection: restored.selection,
    variantOverrides: restored.variantOverrides,
    selectedTemplate: restored.matchedPreset ?? CUSTOM_TEMPLATE,
  };
}

/** Edit/nominate mode reads the active room synchronously; the room screen opened this flow. */
function readRoomState(roomCode: string, session: WerewolfRoomSession): GameState {
  const snapshot = session.getSnapshot();
  if (snapshot.phase !== 'ready' || snapshot.identity.room.roomCode !== roomCode) {
    throw new Error('[FAIL-FAST] werewolf config edit requires its active room session');
  }
  return snapshot.room.state;
}

function readInitialBoardDraft({
  presetName,
  existingRoomCode,
  nominateMode,
  session,
}: Pick<
  UseConfigScreenStateParams,
  'presetName' | 'existingRoomCode' | 'nominateMode' | 'session'
>): BoardDraft {
  if (presetName !== undefined) return restoreFromPreset(presetName);
  const roomCode = existingRoomCode ?? nominateMode?.roomCode;
  if (roomCode === undefined) {
    return {
      selection: getEmptySelection(),
      variantOverrides: {},
      selectedTemplate: CUSTOM_TEMPLATE,
    };
  }
  const restored = restoreFromTemplateRoles(readRoomState(roomCode, session).templateRoles);
  return {
    selection: restored.selection,
    variantOverrides: restored.variantOverrides,
    selectedTemplate: restored.matchedPreset ?? CUSTOM_TEMPLATE,
  };
}

/** Rules handed back from the Rules step win; existing rooms edit their own; new rooms start remembered. */
function readInitialRules({
  updatedRules,
  existingRoomCode,
  nominateMode,
  session,
  settingsService,
}: Pick<
  UseConfigScreenStateParams,
  'updatedRules' | 'existingRoomCode' | 'nominateMode' | 'session' | 'settingsService'
>): GameRuleOverrides {
  if (updatedRules !== undefined) return updatedRules;
  const roomCode = existingRoomCode ?? nominateMode?.roomCode;
  if (roomCode === undefined) {
    return settingsService.getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA);
  }
  return readRoomState(roomCode, session).rules ?? {};
}

interface UseConfigScreenStateParams {
  existingRoomCode: string | undefined;
  presetName: string | undefined;
  nominateMode: { roomCode: string } | undefined;
  updatedRules: GameRuleOverrides | undefined;
  navigation: ConfigNavigationProp;
  session: WerewolfRoomSession;
  settingsService: SettingsService;
  onExitFlow: () => void;
  onReturnToRoom: (roomCode: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useConfigScreenState({
  existingRoomCode,
  presetName,
  nominateMode,
  updatedRules,
  navigation,
  session,
  settingsService,
  onExitFlow,
  onReturnToRoom,
}: UseConfigScreenStateParams) {
  const { user } = useAuthContext();
  const room = useRoomLinkSnapshot(session);
  const gameState = room.phase === 'ready' ? room.room.state : null;
  const isNominateMode = !!nominateMode;

  // ── Core state ────────────────────────────────────────────────────────────
  //
  // The draft is seeded once on mount; later room snapshots never overwrite
  // it. Route params that change while this screen stays mounted (BoardPicker
  // popTo with presetName, Rules goBack with updatedRules) are applied during
  // render by comparing against the last applied value.

  const [draft, setDraft] = useState(() =>
    readInitialBoardDraft({ presetName, existingRoomCode, nominateMode, session }),
  );
  const { selection, variantOverrides, selectedTemplate } = draft;
  const [isWorkflowSubmitting, setIsWorkflowSubmitting] = useState(false);
  const [rules, setRules] = useState<GameRuleOverrides>(() =>
    readInitialRules({ updatedRules, existingRoomCode, nominateMode, session, settingsService }),
  );

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

  const totalCount = useMemo(
    () => computeTotalCount(selection, variantOverrides),
    [selection, variantOverrides],
  );

  // ── Auto-navigate back when game progresses past nomination phase ───────

  useEffect(() => {
    if (!nominateMode) return;
    if (!gameState) return;
    const canNominate =
      gameState.status === GameStatus.Unseated || gameState.status === GameStatus.Seated;
    if (!canNominate) {
      onReturnToRoom(nominateMode.roomCode);
    }
  }, [gameState, nominateMode, onReturnToRoom]);

  // ── Callback handlers ────────────────────────────────────────────────────

  const handleGoBack = useCallback(() => {
    if (hasPreviousRouteInCurrentNavigator(navigation)) {
      navigation.goBack();
      return;
    }
    onExitFlow();
  }, [navigation, onExitFlow]);

  const handleTemplatePillPress = useCallback(() => {
    navigation.navigate('BoardPicker', {
      ...(existingRoomCode ? { existingRoomCode } : {}),
      ...(nominateMode ? { nominateMode } : {}),
    });
  }, [navigation, existingRoomCode, nominateMode]);

  const toggleRole = useCallback((key: string) => {
    setDraft((prev) => ({
      ...prev,
      selection: { ...prev.selection, [key]: !prev.selection[key] },
      selectedTemplate: CUSTOM_TEMPLATE,
    }));
  }, []);

  const handleClearSelection = useCallback(() => {
    setDraft((prev) => {
      const cleared: Record<string, boolean> = {};
      Object.keys(prev.selection).forEach((k) => (cleared[k] = false));
      return { ...prev, selection: cleared, selectedTemplate: CUSTOM_TEMPLATE };
    });
  }, []);

  /** Nominate mode submits the board directly; otherwise the Rules step owns create/save. */
  const handleContinue = useCallback(async () => {
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

    if (!nominateMode) {
      navigation.navigate('Rules', {
        roles,
        rules,
        ...(existingRoomCode ? { existingRoomCode } : {}),
      });
      return;
    }

    setIsWorkflowSubmitting(true);
    try {
      const displayName = user?.displayName ?? '匿名玩家';
      const result = await session.dispatch(
        { type: 'werewolf.board.nominate', displayName, roles: [...roles] },
        { controlledSeat: null, label: '提交板子建议', durable: false },
      );
      if (!isSuccessfulRoomCommand(result)) {
        const reason = getRoomCommandFailureReason(result);
        showErrorAlert('提交失败', translateReasonCode(reason));
        return;
      }
      if (result.outcome.reason === 'DEDUPLICATED') {
        toast.info('已有相同板子建议，已自动为你投票');
      }
      onReturnToRoom(nominateMode.roomCode);
    } catch (e) {
      handleError(e, {
        label: '提交板子建议',
        logger: configLog,
        alertMessage: '提交板子建议失败，请重试',
      });
    } finally {
      setIsWorkflowSubmitting(false);
    }
  }, [
    selection,
    nominateMode,
    existingRoomCode,
    session,
    navigation,
    variantOverrides,
    rules,
    user,
    onReturnToRoom,
  ]);

  // ── Role info card (long-press any chip → RoleCardSimple with variant bar) ──

  const [roleInfoBaseId, setRoleInfoBaseId] = useState<RoleId | null>(null);

  const findSlotForKey = useCallback((baseRoleId: RoleId) => {
    for (const group of FACTION_GROUPS) {
      for (const section of group.sections) {
        for (const slot of section.roles) {
          if (slot.roleId === baseRoleId && slot.variants && slot.variants.length > 0) {
            return slot;
          }
        }
      }
    }
    return null;
  }, []);

  // The displayed roleId resolves the active variant override
  const roleInfoId = roleInfoBaseId ? (variantOverrides[roleInfoBaseId] ?? roleInfoBaseId) : null;

  // Variant pill bar data (only for slots that have variants)
  const roleInfoSlot = roleInfoBaseId ? findSlotForKey(roleInfoBaseId) : null;
  const roleInfoVariantIds = roleInfoSlot?.variants
    ? [roleInfoSlot.roleId, ...roleInfoSlot.variants]
    : [];
  const roleInfoActiveVariant = roleInfoBaseId
    ? (variantOverrides[roleInfoBaseId] ?? roleInfoBaseId)
    : undefined;

  const handleChipInfoPress = useCallback((key: string) => {
    const baseRoleId = key.replace(/\d+$/, '');
    if (!isValidRoleId(baseRoleId)) {
      throw new Error(`[useConfigScreenState] Invalid role selection key: ${key}`);
    }
    setRoleInfoBaseId(baseRoleId);
  }, []);

  const handleCloseRoleInfo = useCallback(() => {
    setRoleInfoBaseId(null);
  }, []);

  /** Switch variant from within the RoleCardSimple pill bar. */
  const handleRoleInfoVariantSelect = useCallback(
    (variantId: RoleId) => {
      if (!roleInfoBaseId) return;
      setDraft((prev) => {
        const variantOverrides = { ...prev.variantOverrides };
        if (variantId === roleInfoBaseId) {
          delete variantOverrides[roleInfoBaseId];
        } else {
          variantOverrides[roleInfoBaseId] = variantId;
        }
        return {
          selection: prev.selection[roleInfoBaseId]
            ? prev.selection
            : { ...prev.selection, [roleInfoBaseId]: true },
          variantOverrides,
          selectedTemplate: CUSTOM_TEMPLATE,
        };
      });
    },
    [roleInfoBaseId],
  );

  // ── Active faction tab ───────────────────────────────────────────────────

  const [activeTab, setActiveTab] = useState<Faction>(
    FACTION_GROUPS[0]?.faction ?? Faction.Villager,
  );

  const handleTabPress = useCallback((key: Faction) => {
    setActiveTab(key);
  }, []);

  // ── Template label ───────────────────────────────────────────────────────

  const selectedTemplateLabel = useMemo(() => {
    if (selectedTemplate === CUSTOM_TEMPLATE) return '自定义';
    const preset = PRESET_TEMPLATES.find((p) => p.name === selectedTemplate);
    return preset ? preset.name : selectedTemplate;
  }, [selectedTemplate]);

  // ── Bulk role stepper ────────────────────────────────────────────────────

  const getBulkCount = useCallback(
    (roleId: string, maxCount: number): number => {
      let count = 0;
      for (let i = 0; i < maxCount; i++) {
        const key = i === 0 ? roleId : `${roleId}${i}`;
        if (selection[key]) count++;
      }
      return count;
    },
    [selection],
  );

  const handleBulkCountChange = useCallback((roleId: string, newCount: number) => {
    setDraft((prev) => {
      const selection = { ...prev.selection };
      let maxCount = 1;
      for (const group of FACTION_GROUPS) {
        for (const section of group.sections) {
          for (const slot of section.roles) {
            if (slot.roleId === roleId) maxCount = slot.count ?? 1;
          }
        }
      }
      for (let i = 0; i < maxCount; i++) {
        const key = i === 0 ? roleId : `${roleId}${i}`;
        selection[key] = i < newCount;
      }
      return { ...prev, selection, selectedTemplate: CUSTOM_TEMPLATE };
    });
  }, []);

  const getFactionAccentColor = useCallback((faction: Faction): string => {
    switch (faction) {
      case Faction.Wolf:
        return colors.wolf;
      case Faction.God:
        return colors.god;
      case Faction.Villager:
        return colors.villager;
      case Faction.Special:
        return colors.third;
      default:
        return colors.primary;
    }
  }, []);

  const getFactionSelectedCount = useCallback(
    (group: (typeof FACTION_GROUPS)[number]): number => {
      let count = 0;
      for (const section of group.sections) {
        for (const slot of section.roles) {
          const slotCount = slot.count ?? 1;
          for (let i = 0; i < slotCount; i++) {
            const key = i === 0 ? slot.roleId : `${slot.roleId}${i}`;
            if (selection[key]) count++;
          }
        }
      }
      return count;
    },
    [selection],
  );

  const tabItems: FactionTabItem[] = useMemo(
    () =>
      FACTION_GROUPS.map((group) => {
        const accentColor = getFactionAccentColor(group.faction);
        return {
          key: group.faction,
          title: group.title,
          count: getFactionSelectedCount(group),
          accentColor,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- FACTION_GROUPS is module-level constant
    [selection, getFactionAccentColor, getFactionSelectedCount],
  );

  const activeGroup = useMemo(
    () => FACTION_GROUPS.find((g) => g.faction === activeTab) ?? FACTION_GROUPS[0],
    [activeTab],
  );

  const isSubmitting = isWorkflowSubmitting;

  // ── Return bag ───────────────────────────────────────────────────────────

  return {
    // Mode
    isNominateMode,
    isDisabled: isSubmitting,
    isSubmitting,

    // Core state
    selection,
    totalCount,
    variantOverrides,

    // Navigation
    handleGoBack,
    handleTemplatePillPress,
    handleContinue,

    // Role toggling
    toggleRole,
    handleClearSelection,

    // Template
    selectedTemplateLabel,

    // Role info (with variant switching)
    roleInfoId,
    roleInfoVariantIds,
    roleInfoActiveVariant,
    handleChipInfoPress,
    handleCloseRoleInfo,
    handleRoleInfoVariantSelect,

    // Faction tabs
    tabItems,
    activeTab,
    activeGroup,
    handleTabPress,

    // Bulk stepper
    getBulkCount,
    handleBulkCountChange,
    getFactionAccentColor,
  };
}
