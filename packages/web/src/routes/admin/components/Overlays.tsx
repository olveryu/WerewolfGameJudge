/** Ark UI owns overlay focus, keyboard navigation and dismissal. */
import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';
import IconCloseOutline from '~icons/ion/close-outline';

/** A recipient/detail drawer kept inside the scoped theme instead of a body-level portal. */
export function DetailDrawer({
  title,
  onClose,
  children,
  preventClose = false,
  variant = 'drawer',
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  preventClose?: boolean;
  variant?: 'drawer' | 'sheet';
  footer?: ReactNode;
}) {
  return (
    <AppDialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open && !preventClose) onClose();
      }}
      closeOnInteractOutside={!preventClose}
      closeOnEscape={!preventClose}
    >
      <AppDialog.Backdrop className="admin-drawer-backdrop" />
      <AppDialog.Positioner className={`admin-drawer-positioner admin-overlay-${variant}`}>
        <AppDialog.Content className={`admin-drawer admin-overlay-${variant}`}>
          <header>
            <AppDialog.Title>{title}</AppDialog.Title>
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
          {footer !== undefined && <footer className="admin-drawer-footer">{footer}</footer>}
        </AppDialog.Content>
      </AppDialog.Positioner>
    </AppDialog.Root>
  );
}
