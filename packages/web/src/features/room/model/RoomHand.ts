import type { IoniconName } from '@/components/icons/IonIcon';
import { TESTIDS } from '@/testids';

import { resolveHostTaskView } from './resolveHostTaskView';
import {
  resolveCommandActionState,
  type RoomAction,
  type RoomActionCategory,
  type RoomActionState,
  type RoomPlayerAction,
  type RoomPlayerActionGroup,
} from './RoomAction';
import type { RoomCapability } from './RoomCapabilities';
import { HOST_MANAGEMENT_LABEL, type RoomHostManagementModel } from './RoomHostManagement';
import type { RoomPlayerActionModel } from './RoomPlayerActions';

/**
 * Seat selection projected over the main hand. A player selection names the
 * player action that leaves it; a host task's escape comes from its body.
 */
export type RoomSelectionMode =
  { readonly kind: 'player'; readonly escapeActionKey: string } | { readonly kind: 'host-task' };

export type RoomHandFace =
  | { readonly kind: 'main' }
  | { readonly kind: 'manual' }
  | { readonly kind: 'host' }
  | { readonly kind: 'group'; readonly key: string }
  | { readonly kind: 'menu' }
  | { readonly kind: 'menu-manual' };

export interface RoomHandCard {
  readonly id: string;
  readonly label: string;
  readonly accessibleLabel: string | null;
  readonly icon: IoniconName;
  readonly category: 'back' | RoomActionCategory;
  readonly actionKey: string | null;
  readonly state: RoomActionState;
  readonly isPending: boolean;
  readonly opensDialog: boolean;
  readonly testID: string | undefined;
  readonly containedActionTestIDs: readonly string[];
}

export interface RoomHand {
  readonly face: RoomHandFace;
  readonly label: string;
  readonly cards: readonly RoomHandCard[];
}

export interface RoomHandDirectory {
  readonly main: readonly RoomAction[];
  readonly manual: readonly RoomAction[];
  readonly openConfiguration: (() => void) | null;
}

interface RoomHandNavigation {
  readonly openManual: () => void;
  readonly openHost: () => void;
  readonly openGroup: (key: string) => void;
  readonly back: () => void;
  readonly returnToMain: () => void;
  readonly launchFrom: (cardId: string) => void;
}

export interface RoomHandInput {
  readonly phase: string;
  readonly isSubmitting: boolean;
  readonly pendingActionKey: string | null;
  readonly face: RoomHandFace;
  readonly playerActions: RoomPlayerActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly directory: RoomHandDirectory;
  readonly share: RoomCapability;
  readonly selectionMode: RoomSelectionMode | undefined;
  readonly navigation: RoomHandNavigation;
}

const CATEGORY_ORDER: Readonly<Record<RoomHandCard['category'], number>> = {
  back: 0,
  player: 1,
  resource: 2,
  host: 3,
  danger: 4,
};

function actionCard(
  id: string,
  action: RoomAction,
  options: {
    readonly isPending?: boolean;
    readonly accessibleLabel?: string;
    readonly testID?: string;
    readonly containedActionTestIDs?: readonly string[];
    readonly fallbackIcon?: IoniconName;
  } = {},
): RoomHandCard {
  return {
    id,
    label: action.label,
    accessibleLabel: options.accessibleLabel ?? null,
    icon: action.icon ?? options.fallbackIcon ?? 'hand-left-outline',
    category: action.category,
    actionKey: action.opensDialog === true ? null : action.key,
    state: action.state,
    isPending: options.isPending ?? false,
    opensDialog: action.opensDialog ?? false,
    testID: options.testID ?? action.testID,
    containedActionTestIDs: options.containedActionTestIDs ?? [],
  };
}

function navigationCard(
  id: string,
  label: string,
  category: RoomHandCard['category'],
  icon: IoniconName,
  onPress: () => void,
  testID?: string,
): RoomHandCard {
  return {
    id,
    label,
    accessibleLabel: null,
    icon,
    category,
    actionKey: null,
    state: { kind: 'ready', onPress },
    isPending: false,
    opensDialog: false,
    testID,
    containedActionTestIDs: [],
  };
}

/**
 * True while an action reached through an entry owns the in-flight submission.
 * Sub-hand actions return to the main hand before submitting, so the entry that
 * opened them is the one visible place to show that submission as busy.
 */
export function isSubmissionOwnedBy(
  submission: { readonly isSubmitting: boolean; readonly pendingActionKey: string | null },
  actions: readonly RoomAction[],
): boolean {
  return (
    submission.isSubmitting && actions.some((action) => action.key === submission.pendingActionKey)
  );
}

/** Every sub-hand action returns to the main hand. */
function returningToMain(card: RoomHandCard, navigation: RoomHandNavigation): RoomHandCard {
  if (card.state.kind !== 'ready') return card;
  const { onPress } = card.state;
  return {
    ...card,
    state: {
      kind: 'ready',
      onPress: () => {
        navigation.returnToMain();
        onPress();
      },
    },
  };
}

/** A main-hand press records its card as the entry that seat selection returns focus to. */
function launchingFrom(card: RoomHandCard, navigation: RoomHandNavigation): RoomHandCard {
  if (card.state.kind !== 'ready') return card;
  const { onPress } = card.state;
  return {
    ...card,
    state: {
      kind: 'ready',
      onPress: () => {
        navigation.launchFrom(card.id);
        onPress();
      },
    },
  };
}

function playerCardId(actionKey: string): string {
  return `action:${actionKey}`;
}

function hostTaskEscapeCardId(actionKey: string): string {
  return `selection:${actionKey}`;
}

/** The card that leaves seat selection, which takes focus when selection starts. */
export function selectionEscapeCardId(
  selectionMode: RoomSelectionMode,
  hostManagement: RoomHostManagementModel | null,
): string | null {
  if (selectionMode.kind === 'player') return playerCardId(selectionMode.escapeActionKey);
  const hostTask = hostManagement === null ? null : resolveHostTaskView(hostManagement);
  return hostTask?.body.kind === 'message' && hostTask.body.escape !== null
    ? hostTaskEscapeCardId(hostTask.body.escape.key)
    : null;
}

function playerCard(action: RoomPlayerAction): RoomHandCard {
  return actionCard(playerCardId(action.key), action, { isPending: action.isPending });
}

function groupCard(group: RoomPlayerActionGroup, input: RoomHandInput): RoomHandCard {
  const action: RoomAction = {
    key: group.key,
    label: group.label,
    category: 'player',
    icon: group.icon ?? 'sparkles-outline',
    testID: group.testID,
    state: isSubmissionOwnedBy(input, group.actions)
      ? { kind: 'busy' }
      : { kind: 'ready', onPress: () => input.navigation.openGroup(group.key) },
  };
  const card = actionCard(`group:${group.key}`, action, {
    isPending: group.isPending,
    containedActionTestIDs: group.actions.flatMap((entry) =>
      entry.testID === undefined ? [] : [entry.testID],
    ),
  });
  // The group entry navigates; only the actions inside it are commands.
  return { ...card, actionKey: null };
}

function configurationCard(open: () => void): RoomHandCard {
  return {
    ...navigationCard(
      'room-entry:configuration',
      '本局配置',
      'resource',
      'options-outline',
      open,
      TESTIDS.roomConfigurationButton,
    ),
    opensDialog: true,
  };
}

function buildMainCards(input: RoomHandInput): RoomHandCard[] {
  const cards = input.playerActions.actions.map(playerCard);
  if (input.playerActions.group !== null) {
    cards.push(groupCard(input.playerActions.group, input));
  }
  const hostTask = input.hostManagement === null ? null : resolveHostTaskView(input.hostManagement);
  if (input.selectionMode?.kind === 'host-task' && hostTask?.body.kind === 'message') {
    if (hostTask.body.escape !== null) {
      cards.push(actionCard(hostTaskEscapeCardId(hostTask.body.escape.key), hostTask.body.escape));
    }
  }
  if (input.selectionMode !== undefined) return cards;
  if (input.directory.openConfiguration !== null) {
    cards.push(configurationCard(input.directory.openConfiguration));
  }
  if (input.directory.manual.length > 0) {
    cards.push(
      navigationCard(
        'room-entry:manual',
        '手册',
        'resource',
        'book-outline',
        input.navigation.openManual,
        TESTIDS.roomManualButton,
      ),
    );
  }
  cards.push(
    ...input.directory.main.map((action) =>
      actionCard(`main-entry:${action.key}`, action, { fallbackIcon: 'create-outline' }),
    ),
  );
  if (input.share.isAllowed) {
    cards.push({
      ...navigationCard(
        'room-entry:share',
        '分享房间',
        'resource',
        'share-outline',
        input.share.execute,
        TESTIDS.roomShareButton,
      ),
      opensDialog: true,
    });
  }
  if (input.hostManagement !== null) {
    const hasPending =
      (input.hostManagement.pendingActionKeys?.length ?? 0) > 0 ||
      input.hostManagement.hasPendingDecision === true;
    const hostEntry = navigationCard(
      'room-entry:host',
      HOST_MANAGEMENT_LABEL,
      'host',
      'construct-outline',
      input.navigation.openHost,
      TESTIDS.roomMoreActionsButton,
    );
    cards.push({
      ...hostEntry,
      state: isSubmissionOwnedBy(input, input.hostManagement.actions)
        ? { kind: 'busy' }
        : hostEntry.state,
      isPending: hasPending,
      accessibleLabel: hasPending ? `${HOST_MANAGEMENT_LABEL}，有待处理操作` : null,
    });
  }
  return cards;
}

function buildGroupCards(input: RoomHandInput, group: RoomPlayerActionGroup): RoomHandCard[] {
  return [
    navigationCard(
      `group:${group.key}:back`,
      '返回',
      'back',
      'arrow-back',
      input.navigation.back,
      group.backTestID,
    ),
    ...group.actions.map((action) => returningToMain(playerCard(action), input.navigation)),
  ];
}

function buildHostCards(input: RoomHandInput): RoomHandCard[] {
  const model = input.hostManagement;
  if (model === null) throw new Error(`Room phase "${input.phase}" has no host management`);
  const task = resolveHostTaskView(model);
  const taskActions =
    task?.body.kind === 'action'
      ? [task.body.action]
      : task?.body.kind === 'choice'
        ? task.body.actions
        : task?.body.kind === 'message' && task.body.escape !== null
          ? [task.body.escape]
          : [];
  const taskKeys = new Set(taskActions.map((action) => action.key));
  const pendingKeys = model.pendingActionKeys ?? [];
  const orderedActions = [
    ...pendingKeys.flatMap((key) => model.actions.filter((action) => action.key === key)),
    ...taskActions.filter((action) => !pendingKeys.includes(action.key)),
    ...model.actions.filter(
      (action) => !pendingKeys.includes(action.key) && !taskKeys.has(action.key),
    ),
  ];
  return [
    navigationCard(
      'host-management:back',
      '返回',
      'back',
      'arrow-back',
      input.navigation.back,
      TESTIDS.roomHostManagementCloseButton,
    ),
    ...orderedActions.map((action) => {
      const isEscape = task?.body.kind === 'message' && task.body.escape?.key === action.key;
      const isReadyTask =
        task?.body.kind === 'action' &&
        task.body.action.key === action.key &&
        action.state.kind === 'ready';
      const isChoice = task?.body.kind === 'choice' && taskKeys.has(action.key);
      const card = actionCard(`host-management:${action.key}`, action, {
        isPending: pendingKeys.includes(action.key),
        testID: isEscape
          ? TESTIDS.roomHostTaskEscapeButton
          : (action.testID ??
            (isReadyTask
              ? TESTIDS.roomNextStepButton
              : isChoice
                ? `${TESTIDS.roomHostTaskCard}-${action.key}`
                : undefined)),
      });
      return returningToMain(card, input.navigation);
    }),
  ];
}

function buildManualCards(input: RoomHandInput, menu: boolean): RoomHandCard[] {
  return [
    navigationCard(
      menu ? 'stage-menu:back' : 'manual:back',
      '返回',
      'back',
      'arrow-back',
      input.navigation.back,
      menu ? TESTIDS.roomStageMenuBackButton : TESTIDS.roomManualBackButton,
    ),
    ...input.directory.manual.map((action) =>
      returningToMain(
        actionCard(`manual:${action.key}`, action, { fallbackIcon: 'book-outline' }),
        input.navigation,
      ),
    ),
  ];
}

function buildMenuCards(input: RoomHandInput): RoomHandCard[] {
  const cards = [
    navigationCard(
      'stage-menu:back',
      '返回',
      'back',
      'arrow-back',
      input.navigation.back,
      TESTIDS.roomStageMenuBackButton,
    ),
  ];
  if (input.directory.manual.length > 0) {
    cards.push(
      navigationCard(
        'stage-menu:manual',
        '手册',
        'resource',
        'book-outline',
        input.navigation.openManual,
        TESTIDS.roomManualButton,
      ),
    );
  }
  if (input.directory.openConfiguration !== null) {
    cards.push(
      returningToMain(configurationCard(input.directory.openConfiguration), input.navigation),
    );
  }
  for (const action of input.hostManagement?.actions ?? []) {
    if (action.stageMenuRole !== undefined)
      cards.push(returningToMain(actionCard(`stage-menu:${action.key}`, action), input.navigation));
  }
  return cards;
}

/** Projects the current room state into an ordered hand without depending on React. */
export function buildRoomHand(input: RoomHandInput): RoomHand {
  const group = input.playerActions.group;
  const actionCards = [
    ...input.playerActions.actions.map((action) => ({ id: playerCardId(action.key), action })),
    ...(group?.actions.map((action) => ({ id: playerCardId(action.key), action })) ?? []),
    ...(input.hostManagement?.actions.map((action) => ({
      id: `host-management:${action.key}`,
      action,
    })) ?? []),
    ...input.directory.main.map((action) => ({ id: `main-entry:${action.key}`, action })),
    ...input.directory.manual.map((action) => ({ id: `manual:${action.key}`, action })),
  ];
  for (const { id, action } of actionCards) {
    if (
      action.state.kind === 'blocked' &&
      action.state.reason !== null &&
      action.state.reason.trim() === ''
    ) {
      throw new Error(`Room phase "${input.phase}" has an empty blocked reason for card "${id}"`);
    }
  }
  if (group !== null) {
    if (group.key.trim() === '')
      throw new Error(`Room phase "${input.phase}" has a player group with an empty key`);
    if (group.actions.length < 2)
      throw new Error(
        `Room phase "${input.phase}" has a player group "${group.key}" with fewer than two actions`,
      );
    if (input.playerActions.actions.some((action) => action.key === group.key)) {
      throw new Error(
        `Room phase "${input.phase}" uses player action key "${group.key}" for its group`,
      );
    }
  }
  const face = input.selectionMode === undefined ? input.face : ({ kind: 'main' } as const);
  const faceCards =
    face.kind === 'main'
      ? buildMainCards(input)
      : face.kind === 'host'
        ? buildHostCards(input)
        : face.kind === 'menu'
          ? buildMenuCards(input)
          : face.kind === 'group'
            ? group !== null && group.key === face.key
              ? buildGroupCards(input, group)
              : buildMainCards(input)
            : buildManualCards(input, face.kind === 'menu-manual');
  const cards =
    face.kind === 'main' && input.selectionMode === undefined
      ? faceCards.map((card) => launchingFrom(card, input.navigation))
      : faceCards;
  const resolvedCards = cards.map((card) =>
    card.actionKey === null
      ? card
      : {
          ...card,
          state: resolveCommandActionState({
            key: card.actionKey,
            isSubmitting: input.isSubmitting,
            pendingActionKey: input.pendingActionKey,
            whenIdle: card.state,
          }),
        },
  );
  const ids = new Set<string>();
  for (const card of resolvedCards) {
    if (ids.has(card.id))
      throw new Error(`Room phase "${input.phase}" declares card "${card.id}" twice`);
    if (
      card.state.kind === 'blocked' &&
      card.state.reason !== null &&
      card.state.reason.trim() === ''
    ) {
      throw new Error(
        `Room phase "${input.phase}" has an empty blocked reason for card "${card.id}"`,
      );
    }
    ids.add(card.id);
  }
  if (input.selectionMode?.kind === 'player') {
    const escapeCardId = playerCardId(input.selectionMode.escapeActionKey);
    if (!ids.has(escapeCardId)) {
      throw new Error(
        `Room phase "${input.phase}" selects seats without its escape card "${escapeCardId}"`,
      );
    }
  }
  return {
    face,
    label:
      face.kind === 'main'
        ? '行动手牌'
        : face.kind === 'host'
          ? HOST_MANAGEMENT_LABEL
          : face.kind === 'menu'
            ? '菜单'
            : face.kind === 'group' && group?.key === face.key
              ? group.label
              : '手册',
    cards: resolvedCards.toSorted(
      (left, right) =>
        CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category] ||
        Number(left.state.kind !== 'ready') - Number(right.state.kind !== 'ready'),
    ),
  };
}
