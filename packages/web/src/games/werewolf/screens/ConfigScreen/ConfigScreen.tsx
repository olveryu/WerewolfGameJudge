/**
 * ConfigScreen — werewolf role configuration (render-only); the Rules step that follows owns
 * create/save, except nominate mode, which submits the board here.
 *
 * The role list is data-driven from FACTION_GROUPS + ROLE_SPECS; all state and callbacks come
 * from useConfigScreenState.
 */
import '@/components/CardFrame.css';
import '@/components/GameSettings.css';
import '@/features/room/config/GameConfigPage.css';
import '@/games/werewolf/components/faction.css';
import './ConfigScreen.css';

import { Tabs } from '@ark-ui/react/tabs';
import { type Faction, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Fragment, type ReactNode, useState } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigParams, WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';
import { askAIAboutRole, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';
import IconChevronDown from '~icons/ion/chevron-down';
import IconTrashOutline from '~icons/ion/trash-outline';

import { FactionTabs } from './components/FactionTabs';
import { RoleChip } from './components/RoleChip';
import { RoleStepper } from './components/RoleStepper';
import { Section } from './components/Section';
import { FACTION_GROUPS } from './configData';
import { expandSlotToChipEntries, FACTION_COLOR_MAP } from './configHelpers';
import { useConfigScreenState } from './useConfigScreenState';

const FACTION_TABS: ReadonlyMap<string, Faction> = new Map(
  FACTION_GROUPS.map((group) => [group.faction, group.faction]),
);

function parseFactionTab(value: string): Faction {
  const faction = FACTION_TABS.get(value);
  if (faction === undefined) throw new Error(`[FAIL-FAST] Unknown faction tab: ${value}`);
  return faction;
}

interface ConfigScreenProps {
  readonly session: WerewolfRoomSession;
  readonly params: WerewolfConfigParams;
  /** Where Back goes when this is the first page of a directly opened flow. */
  readonly exitPath: string;
  readonly onPickBoard: () => void;
  readonly onContinue: (rulesParams: WerewolfRulesParams) => void;
  readonly onReturnToRoom: (roomCode: string) => void;
  readonly nominationDialog?: { readonly title: string; readonly onClose: () => void };
  readonly settingsDialog?: {
    readonly onClose: () => void;
    readonly rulesDirty: boolean;
    readonly children: ReactNode;
  };
}

/** Role configuration screen; the Rules step that follows owns create/save. */
export function ConfigScreen({
  session,
  params,
  exitPath,
  onPickBoard,
  onContinue,
  onReturnToRoom,
  nominationDialog,
  settingsDialog,
}: ConfigScreenProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const state = useConfigScreenState({
    params,
    session,
    onPickBoard:
      nominationDialog === undefined && settingsDialog === undefined
        ? onPickBoard
        : () => setIsPickerOpen(true),
    onContinue,
    onReturnToRoom,
    keepNominationOpen: nominationDialog !== undefined,
  });
  const { activeGroup } = state;
  const isAIChatAvailable = useAIChatAvailable();

  const templateControl = (
    <span className="config-header-center">
      <button
        type="button"
        className="config-template-pill"
        onClick={state.handleTemplatePillPress}
        data-testid={TESTIDS.configTemplatePill}
        aria-label={`选择板子：${state.selectedTemplateLabel}`}
      >
        {state.selectedTemplateLabel}
        <IconChevronDown aria-hidden />
      </button>
      <span className="config-player-count">{state.totalCount}人</span>
    </span>
  );
  const reset = (
    <IconButton
      label="重置配置"
      icon={<IconTrashOutline aria-hidden />}
      onClick={state.handleClearSelection}
      data-testid={TESTIDS.configOverflowReset}
    />
  );

  const fields = (
    <>
      <Tabs.Root
        className="config-tabs-root"
        value={state.activeTab}
        onValueChange={(details) => state.handleTabPress(parseFactionTab(details.value))}
      >
        <div className="config-card-tabs card-frame">
          <FactionTabs tabs={state.tabItems} />
        </div>
        <p className="config-hint">
          <span className="config-hint-icon" aria-hidden="true">
            i
          </span>
          点按选角色 · 长按看介绍 · 变体在卡里换
        </p>
        <Tabs.Content value={state.activeTab} className="config-scroll">
          <div className="config-card-roles card-frame">
            {activeGroup.sections.map((section, index) => {
              const faction = FACTION_COLOR_MAP[section.faction ?? activeGroup.faction];
              const bulkSlot = section.roles.find((slot) => slot.isBulk === true);
              return (
                <Fragment key={section.title}>
                  {index > 0 && <hr className="config-card-divider" />}
                  {bulkSlot !== undefined ? (
                    <RoleStepper
                      roleId={bulkSlot.roleId}
                      label={ROLE_SPECS[bulkSlot.roleId].displayName}
                      count={state.getBulkCount(bulkSlot.roleId, bulkSlot.count ?? 1)}
                      maxCount={bulkSlot.count ?? 1}
                      onCountChange={state.handleBulkCountChange}
                      faction={faction}
                    />
                  ) : (
                    <Section title={section.title}>
                      {section.roles
                        .flatMap((slot) => expandSlotToChipEntries(slot, state.variantOverrides))
                        .map((entry) => (
                          <RoleChip
                            key={entry.key}
                            id={entry.key}
                            label={entry.label}
                            selected={state.selection[entry.key] === true}
                            onToggle={state.toggleRole}
                            faction={faction}
                            hasVariants={entry.hasVariants}
                            onInfoPress={state.handleChipInfoPress}
                          />
                        ))}
                    </Section>
                  )}
                </Fragment>
              );
            })}
          </div>
        </Tabs.Content>
      </Tabs.Root>

      <RoleCardSimple
        visible={state.roleInfoId !== null}
        roleId={state.roleInfoId}
        onClose={state.handleCloseRoleInfo}
        showRealIdentity
        variantIds={state.roleInfoVariantIds}
        activeVariant={state.roleInfoActiveVariant}
        onVariantSelect={state.handleRoleInfoVariantSelect}
        isBoardSelected={state.roleInfoSelected}
        onBoardAction={state.handleRoleInfoToggle}
        onAskAI={
          isAIChatAvailable
            ? (roleId) => askAIAboutRole(roleId, state.handleCloseRoleInfo)
            : undefined
        }
      />
    </>
  );
  const submit = (
    <>
      {nominationDialog !== undefined && !state.canNominate && (
        <p role="status">本局建议已结束，不能提交。</p>
      )}
      {settingsDialog !== undefined && !state.canEdit && (
        <p role="status">房间状态或权限已变化，不能保存设置。</p>
      )}
      <p className="game-settings-summary">已选 {state.totalCount} 人</p>
      <Button
        size="lg"
        className="game-config-submit"
        onClick={state.handleContinue}
        loading={state.isSubmitting}
        disabled={
          (state.isNominateMode && !state.canNominate) ||
          (settingsDialog !== undefined && !state.canEdit)
        }
        data-testid={TESTIDS.configNextButton}
      >
        {state.isNominateMode ? '提交建议' : '下一步：规则'}
      </Button>
    </>
  );
  const dialog = nominationDialog ?? settingsDialog;
  if (dialog !== undefined) {
    const requestClose = () => {
      if (state.isSubmitting) return;
      if (state.isDirty || settingsDialog?.rulesDirty === true) {
        showConfirmAlert('放弃修改？', '还没有保存此次修改。', dialog.onClose);
      } else {
        dialog.onClose();
      }
    };
    return (
      <RoomDialog
        title={nominationDialog?.title ?? '房间设置'}
        onClose={requestClose}
        dismissOnEscape
        footer={submit}
      >
        <div className="config-dialog-tools">
          {templateControl}
          {reset}
        </div>
        {fields}
        {isPickerOpen && (
          <RoomDialog
            title="选择板子"
            onClose={() => setIsPickerOpen(false)}
            dismissOnEscape
            footer={null}
          >
            <BoardPickerScreen
              exitPath={null}
              onCustom={null}
              onSelect={(name) => {
                state.selectPreset(name);
                setIsPickerOpen(false);
              }}
            />
          </RoomDialog>
        )}
        {settingsDialog?.children}
      </RoomDialog>
    );
  }
  return (
    <div className="game-config-page" data-testid={TESTIDS.configScreenRoot}>
      <ScreenHeader
        parentPath={exitPath}
        backTestId={TESTIDS.configBackButton}
        title={templateControl}
      >
        {reset}
      </ScreenHeader>
      {fields}
      <footer className="game-config-footer">{submit}</footer>
    </div>
  );
}
