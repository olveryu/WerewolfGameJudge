/** Ark UI owns overlay focus, keyboard navigation and dismissal. */
import { Dialog } from '@ark-ui/react/dialog';
import { Menu } from '@ark-ui/react/menu';
import type { ReactNode } from 'react';

import IconCloseOutline from '~icons/ion/close-outline';

/** A recipient/detail drawer kept inside the scoped theme instead of a body-level portal. */
export function DetailDrawer({
  title,
  onClose,
  children,
  preventClose = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  preventClose?: boolean;
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
      <Dialog.Positioner className="admin-drawer-positioner">
        <Dialog.Content className="admin-drawer">
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <button
              type="button"
              className="admin-icon-button"
              disabled={preventClose}
              aria-label="关闭详情"
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

/** One primary trigger with explicit normal and quota-breaking menu items. */
export function ActionMenu({
  label,
  disabled,
  items,
  onSelect,
}: {
  label: string;
  disabled?: boolean;
  items: readonly { value: string; label: string; danger?: boolean }[];
  onSelect: (value: string) => void;
}) {
  return (
    <Menu.Root onSelect={(details) => onSelect(details.value)}>
      <Menu.Trigger className="admin-primary" disabled={disabled}>
        {label} <span aria-hidden>⌄</span>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content className="admin-action-menu">
          {items.map((item) => (
            <Menu.Item key={item.value} value={item.value} data-danger={item.danger || undefined}>
              {item.label}
              {item.danger && <small>突破配额</small>}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
