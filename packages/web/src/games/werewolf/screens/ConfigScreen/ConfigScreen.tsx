/**
 * ConfigScreen — werewolf role configuration (render-only); the Rules step that follows owns
 * create/save, except nominate mode, which submits the board here.
 *
 * The role list is data-driven from FACTION_GROUPS + ROLE_SPECS; all state and callbacks come
 * from useConfigScreenState.
 */
import '@/components/GameSettings.css';
import '@/features/room/config/GameConfigPage.css';
import '@/games/werewolf/components/faction.css';
import './ConfigScreen.css';

import { Tabs } from '@ark-ui/react/tabs';
import { type Faction, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';
import { Fragment } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { WerewolfConfigParams, WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { askAIAboutRole, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';
import { TESTIDS } from '@/testids';
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
}

/** Role configuration screen; the Rules step that follows owns create/save. */
export function ConfigScreen({
  session,
  params,
  exitPath,
  onPickBoard,
  onContinue,
  onReturnToRoom,
}: ConfigScreenProps) {
  const state = useConfigScreenState({ params, session, onPickBoard, onContinue, onReturnToRoom });
  const { activeGroup } = state;
  const isAIChatAvailable = useAIChatAvailable();

  return (
    <div className="game-config-page" data-testid={TESTIDS.configScreenRoot}>
      <ScreenHeader
        parentPath={exitPath}
        backTestId={TESTIDS.configBackButton}
        title={
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
        }
      >
        <IconButton
          label="重置配置"
          icon={<IconTrashOutline aria-hidden />}
          onClick={state.handleClearSelection}
          data-testid={TESTIDS.configOverflowReset}
        />
      </ScreenHeader>

      <Tabs.Root
        className="config-tabs-root"
        value={state.activeTab}
        onValueChange={(details) => state.handleTabPress(parseFactionTab(details.value))}
      >
        <div className="config-card-tabs">
          <FactionTabs tabs={state.tabItems} />
        </div>
        <Tabs.Content value={state.activeTab} className="config-scroll">
          <div className="config-card-roles">
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

      <footer className="game-config-footer">
        <p className="game-settings-summary">已选 {state.totalCount} 人</p>
        <Button
          size="lg"
          className="game-config-submit"
          onClick={state.handleContinue}
          loading={state.isSubmitting}
          data-testid={TESTIDS.configNextButton}
        >
          {state.isNominateMode ? '提交建议' : '下一步：规则'}
        </Button>
      </footer>

      <RoleCardSimple
        visible={state.roleInfoId !== null}
        roleId={state.roleInfoId}
        onClose={state.handleCloseRoleInfo}
        showRealIdentity
        variantIds={state.roleInfoVariantIds}
        activeVariant={state.roleInfoActiveVariant}
        onVariantSelect={state.handleRoleInfoVariantSelect}
        onAskAI={
          isAIChatAvailable
            ? (roleId) => askAIAboutRole(roleId, state.handleCloseRoleInfo)
            : undefined
        }
      />
    </div>
  );
}
