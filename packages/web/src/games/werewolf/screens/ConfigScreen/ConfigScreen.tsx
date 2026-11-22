/**
 * ConfigScreen — werewolf role configuration (render-only); the Rules step that follows owns
 * create/save, except nominate mode, which submits the board here.
 *
 * The role list is a row editor driven from FACTION_GROUPS + ROLE_SPECS: a sticky board tray,
 * a search box, and one full-width toggle row per role. All state and callbacks come from
 * useConfigScreenState.
 */
import '@/components/GameSettings.css';
import '@/features/room/config/GameConfigPage.css';
import '@/games/werewolf/components/faction.css';
import './ConfigScreen.css';

import { ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { type ReactNode, useState } from 'react';

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
import IconChevronUp from '~icons/ion/chevron-up';
import IconTrashOutline from '~icons/ion/trash-outline';

import { BoardTray } from './components/BoardTray';
import { RoleRow } from './components/RoleRow';
import { RoleStepper } from './components/RoleStepper';
import { filterConfigListGroups, getRoleOneLiner } from './configHelpers';
import { useConfigScreenState } from './useConfigScreenState';

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
  const isAIChatAvailable = useAIChatAvailable();
  const listGroups = filterConfigListGroups(
    state.selection,
    state.variantOverrides,
    state.searchQuery,
    state.showUnpickedOnly,
  );

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
      <div className="config-list-root">
        <div className="config-list-tools">
          <BoardTray
            selection={state.selection}
            variantOverrides={state.variantOverrides}
            totalCount={state.totalCount}
            targetPlayerCount={state.targetPlayerCount}
            onRemoveToken={state.toggleRole}
          />
          <div className="config-search-row">
            <input
              type="search"
              className="config-search"
              data-testid={TESTIDS.configSearchInput}
              aria-label="搜索角色"
              placeholder="搜索角色"
              value={state.searchQuery}
              onChange={(event) => state.setSearchQuery(event.target.value)}
            />
            <button
              type="button"
              className="config-unpicked-toggle"
              data-testid={TESTIDS.configUnpickedOnlyToggle}
              aria-pressed={state.showUnpickedOnly}
              onClick={state.handleToggleUnpickedOnly}
            >
              只看未选
            </button>
          </div>
        </div>
        <div className="config-scroll">
          <div className="config-card-roles">
            {listGroups.length === 0 ? (
              <div className="config-list-empty">
                <p>没有匹配的角色</p>
                <Button variant="ghost" size="sm" onClick={state.handleClearListFilter}>
                  清除搜索
                </Button>
              </div>
            ) : (
              listGroups.map((group) => {
                const summary = state.groupSummaries.find((item) => item.faction === group.faction);
                const isExpanded = state.expandedGroups.has(group.faction);
                return (
                  <section key={group.title} className="config-group">
                    <button
                      type="button"
                      className="config-group-header"
                      data-testid={TESTIDS.configGroupHeader(group.faction)}
                      aria-expanded={isExpanded}
                      onClick={() => state.handleToggleGroup(group.faction)}
                    >
                      <span className="config-group-title">{group.title}</span>
                      <span className="config-group-count">
                        已选 {summary?.selected ?? 0} / 共 {summary?.total ?? 0}
                      </span>
                      {isExpanded ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
                    </button>
                    {isExpanded &&
                      group.sections.map((section) => (
                        <div key={section.title} className="config-list-section">
                          <h3 className="config-section-title">{section.title}</h3>
                          {section.bulkRoleId !== undefined ? (
                            <RoleStepper
                              roleId={section.bulkRoleId}
                              label={ROLE_SPECS[section.bulkRoleId].displayName}
                              oneLiner={getRoleOneLiner(section.bulkRoleId)}
                              count={state.getBulkCount(section.bulkRoleId, section.bulkCount ?? 1)}
                              maxCount={section.bulkCount ?? 1}
                              onCountChange={state.handleBulkCountChange}
                              faction={section.faction}
                            />
                          ) : (
                            section.rows.map((row) => (
                              <RoleRow
                                key={row.key}
                                id={row.key}
                                label={row.label}
                                oneLiner={row.oneLiner}
                                selected={row.selected}
                                onToggle={state.toggleRole}
                                faction={section.faction}
                                onInfoPress={state.handleChipInfoPress}
                              />
                            ))
                          )}
                        </div>
                      ))}
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>

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
      <p className="game-settings-summary" data-testid={TESTIDS.configSelectedCount}>
        已选 {state.totalCount} 人
      </p>
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
