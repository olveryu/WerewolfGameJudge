/**
 * Static identity card in a dialog: faction badge, portrait (or faction-colored initial), name,
 * and the role description — one centered single-clause text, or structured fields with icons
 * and bullets.
 * Game-neutral: games hand in `RevealRoleData`. Reveal animations (P3) wrap this card.
 */
import '@/components/CenterDialog.css';
import './RoleCard.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import type { DescriptionField, RevealRoleData } from '@/features/room/model/RevealRoleData';
import { TESTIDS } from '@/testids';

/** Chinese-semicolon separated text reads as bullets. */
function splitBullets(text: string): readonly string[] {
  return text.split('；').filter((part) => part.length > 0);
}

/** Structured description fields; the accent follows the surrounding `--faction-color`. */
function DescriptionFields({ fields }: { readonly fields: readonly DescriptionField[] }) {
  return (
    <div className="role-card-fields">
      {fields.map((field) => {
        const bullets = splitBullets(field.content);
        return (
          <section
            key={field.label}
            className="role-card-field"
            data-tone={field.tone ?? 'default'}
            data-testid={field.testID}
          >
            <h3 className="role-card-field-label">
              <IonIcon name={field.icon ?? 'information-circle-outline'} />
              {field.label}
            </h3>
            <div data-testid={field.contentTestID}>
              {bullets.length > 1 ? (
                <ul className="role-card-field-bullets">
                  {bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="role-card-field-text">{field.content}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * One single-clause field (or none) reads as a centered titled text. Two or more fields, or one
 * field holding several clauses, read as structured fields so every clause gets its bullet.
 */
export function RoleDescription({
  fields,
  fallbackText,
  title,
}: {
  readonly fields: readonly DescriptionField[];
  readonly fallbackText: string;
  readonly title: string;
}) {
  const filledFields = fields.filter((field) => field.content.length > 0);
  const [onlyField] = filledFields;
  const hasSeveralClauses = onlyField !== undefined && splitBullets(onlyField.content).length > 1;
  if (filledFields.length > 1 || hasSeveralClauses) {
    return <DescriptionFields fields={filledFields} />;
  }
  return (
    <div className="role-description-single">
      <h3 className="role-description-title">{title}</h3>
      <p className="role-description-text" data-testid={onlyField?.testID}>
        {onlyField?.content ?? fallbackText}
      </p>
    </div>
  );
}

function RoleCardContent({
  role,
  nameTestId,
  descriptionTitle,
}: {
  readonly role: RevealRoleData;
  readonly nameTestId: string;
  readonly descriptionTitle: string;
}) {
  const description = role.description;
  return (
    <div className="role-card" data-alignment={role.alignment}>
      {role.factionName !== undefined && role.factionName.length > 0 && (
        <span className="role-card-faction">{role.factionName}</span>
      )}
      {role.imageUrl !== undefined ? (
        <img
          className="role-card-portrait"
          src={role.imageUrl}
          alt=""
          data-testid={TESTIDS.roleBadge}
        />
      ) : (
        <span className="role-card-portrait role-card-placeholder" data-testid={TESTIDS.roleBadge}>
          {role.placeholderText ?? role.name.charAt(0)}
        </span>
      )}
      <h2 className="role-card-name" data-testid={nameTestId}>
        {role.name}
      </h2>
      <hr className="role-card-divider" />
      <div className="role-card-description">
        <RoleDescription
          fields={description === undefined || typeof description === 'string' ? [] : description}
          fallbackText={typeof description === 'string' ? description : '无技能描述'}
          title={descriptionTitle}
        />
      </div>
    </div>
  );
}

/** Mounted means open. The confirm button wears the faction color. */
export function RoleCardDialog({
  role,
  onClose,
  confirmText = '知道了',
  footer,
  testId = TESTIDS.roleCardModal,
  nameTestId = TESTIDS.roleCardName,
  descriptionTitle = '技能介绍',
}: {
  readonly role: RevealRoleData;
  readonly onClose: () => void;
  readonly confirmText?: string;
  /** Extra content under the card (variant switch, AI button), owned by the game. */
  readonly footer?: ReactNode;
  readonly testId?: string;
  readonly nameTestId?: string;
  /** Section title of a single-text description. */
  readonly descriptionTitle?: string;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="role-card-dialog" data-testid={testId} aria-label={role.name}>
            <div className="role-card-scroll">
              <RoleCardContent
                role={role}
                descriptionTitle={descriptionTitle}
                nameTestId={nameTestId}
              />
            </div>
            {footer}
            <Button
              className="role-card-confirm"
              data-alignment={role.alignment}
              onClick={onClose}
              data-testid={TESTIDS.roleCardConfirmButton}
            >
              {confirmText}
            </Button>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
