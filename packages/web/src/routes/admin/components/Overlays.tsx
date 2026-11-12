/** Ark UI owns overlay focus, keyboard navigation and dismissal. */
import { Dialog } from '@ark-ui/react/dialog';
import type { ReactNode } from 'react';

import IconCloseOutline from '~icons/ion/close-outline';

/** A recipient/detail drawer kept inside the scoped theme instead of a body-level portal. */
export function DetailDrawer({
  title,
  onClose,
  children,
  preventClose = false,
  variant = 'drawer',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  preventClose?: boolean;
  variant?: 'drawer' | 'sheet';
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open && !preventClose) onClose();
      }}
      closeOnInteractOutside={!preventClose}
      closeOnEscape={!preventClose}
    >
      <Dialog.Backdrop className="admin-drawer-backdrop" />
      <Dialog.Positioner className={`admin-drawer-positioner admin-overlay-${variant}`}>
        <Dialog.Content className={`admin-drawer admin-overlay-${variant}`}>
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <button
              type="button"
              className="admin-icon-button"
              disabled={preventClose}
              aria-label={variant === 'sheet' ? '关闭面板' : '关闭详情'}
              onClick={onClose}
            >
              <IconCloseOutline aria-hidden />
            </button>
          </header>
          <div className="admin-drawer-body">{children}</div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
