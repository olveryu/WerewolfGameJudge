import { expect, type Page } from '@playwright/test';

import { TESTIDS } from '../../packages/web/src/testids';
import { pressAlertButton } from '../helpers/alerts';
import { RoomPage } from './RoomPage';

type Policy = 'liberal' | 'fascist';
type PolicyAction = 'discard' | 'enact';

/** Secret Hitler room interactions for a single player's browser. */
export class SecrethitlerRoomPage extends RoomPage {
  constructor(page: Page) {
    super(page);
  }

  async waitForPhase(phase: string, timeout = 60_000): Promise<void> {
    await expect(this.page.getByTestId(TESTIDS.roomHeader)).toHaveAttribute('data-phase', phase, {
      timeout,
    });
  }

  async openGameAction(label: string): Promise<void> {
    const action = this.page.getByTestId(TESTIDS.secrethitlerGameAction);
    await expect(action).toBeVisible({ timeout: 30_000 });
    await expect(action).toHaveAccessibleName(label);
    await action.click();
  }

  async nominate(presidentSeat: number, preferredSeats: readonly number[]): Promise<void> {
    await this.openGameAction('预选总理');
    const modal = this.page.getByTestId(TESTIDS.secrethitlerNominationModal);
    await expect(modal).toBeVisible();
    await expect(this.page.getByTestId(TESTIDS.secrethitlerNominationCount)).toHaveText('已选 0/1');
    let targetSeat: number | undefined;
    for (const seat of preferredSeats) {
      if (await this.page.getByTestId(TESTIDS.secrethitlerNominationRow(seat)).isEnabled()) {
        targetSeat = seat;
        break;
      }
    }
    if (targetSeat === undefined)
      throw new Error(
        `No eligible Secret Hitler nominee among seats: ${preferredSeats.join(', ')}`,
      );
    expect(targetSeat).not.toBe(presidentSeat);
    await this.page.getByTestId(TESTIDS.secrethitlerNominationRow(targetSeat)).click();
    await expect(this.page.getByTestId(TESTIDS.secrethitlerNominationCount)).toHaveText('已选 1/1');
    await this.page.getByTestId(TESTIDS.secrethitlerNominationConfirm).click();
    await expect(modal).toBeHidden();

    await this.openGameAction('最终提名');
    await expect(modal).toBeVisible();
    await expect(
      this.page.getByTestId(TESTIDS.secrethitlerNominationRow(targetSeat)),
    ).toHaveAttribute('aria-checked', 'true');
    await this.page.getByTestId(TESTIDS.secrethitlerNominationConfirm).click();
    await expect(modal).toBeHidden();
    await this.waitForPhase('voting');
  }

  private async choosePolicy(
    action: PolicyAction,
    preferredPolicies: readonly Policy[],
    handSize: number,
  ): Promise<Policy> {
    const cards = preferredPolicies.flatMap((policy) =>
      Array.from({ length: handSize }, (_, index) => ({
        policy,
        locator: this.page.getByTestId(TESTIDS.secrethitlerPolicyCard(action, policy, index)),
      })),
    );
    await expect
      .poll(
        async () => {
          const counts = await Promise.all(cards.map(({ locator }) => locator.count()));
          return counts.reduce((total, count) => total + count, 0);
        },
        { message: `Expected ${handSize} visible ${action} policy cards` },
      )
      .toBe(handSize);
    for (const { policy, locator } of cards) {
      if ((await locator.count()) === 0) continue;
      await expect(locator).toBeVisible();
      await locator.click();
      await pressAlertButton(this.page, {
        title: `${action === 'discard' ? '弃置' : '施行'}${policy === 'fascist' ? '法西斯' : '自由派'}政策？`,
        buttonIndex: 1,
        buttonLabel: '确定',
      });
      return policy;
    }
    throw new Error(`Secret Hitler ${action} hand has no selectable policy`);
  }

  async discardPolicy(): Promise<void> {
    await this.waitForPhase('legislativePresident');
    await expect(this.page.getByTestId(TESTIDS.secrethitlerActionModal)).toHaveAttribute(
      'role',
      'dialog',
    );
    await this.choosePolicy('discard', ['liberal', 'fascist'], 3);
  }

  async enactOrRequestVeto(
    requestVeto: boolean,
  ): Promise<{ kind: 'policy'; policy: Policy } | { kind: 'veto' }> {
    await this.waitForPhase('legislativeChancellor');
    await expect(this.page.getByTestId(TESTIDS.secrethitlerActionModal)).toHaveAttribute(
      'role',
      'dialog',
    );
    if (requestVeto) {
      const vetoButton = this.page.getByTestId(TESTIDS.secrethitlerVetoRequest);
      await expect(vetoButton).toBeVisible();
      await vetoButton.click();
      await pressAlertButton(this.page, {
        title: '请求否决？',
        buttonIndex: 1,
        buttonLabel: '确定',
      });
      return { kind: 'veto' };
    }
    return { kind: 'policy', policy: await this.choosePolicy('enact', ['fascist', 'liberal'], 2) };
  }
}
