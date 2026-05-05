/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { Modal, ModalStackProvider } from '@/components/AppModal';

describe('ModalStack inert behavior', () => {
  let rootEl: HTMLElement | null = null;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
    if (rootEl) document.body.removeChild(rootEl);
    rootEl = null;
  });

  it('applies inert on #root when a modal becomes visible, removes when hidden', () => {
    expect(rootEl!.hasAttribute('inert')).toBe(false);

    const { rerender } = render(
      <ModalStackProvider>
        <Modal visible={false}>
          <Text>x</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(false);

    rerender(
      <ModalStackProvider>
        <Modal visible={true}>
          <Text>x</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(true);

    rerender(
      <ModalStackProvider>
        <Modal visible={false}>
          <Text>x</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(false);
  });

  it('keeps inert applied while at least one modal is visible (refcount)', () => {
    const { rerender } = render(
      <ModalStackProvider>
        <Modal visible={true}>
          <Text>a</Text>
        </Modal>
        <Modal visible={true}>
          <Text>b</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(true);

    rerender(
      <ModalStackProvider>
        <Modal visible={false}>
          <Text>a</Text>
        </Modal>
        <Modal visible={true}>
          <Text>b</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(true);

    rerender(
      <ModalStackProvider>
        <Modal visible={false}>
          <Text>a</Text>
        </Modal>
        <Modal visible={false}>
          <Text>b</Text>
        </Modal>
      </ModalStackProvider>,
    );

    expect(rootEl!.hasAttribute('inert')).toBe(false);
  });

  it('without provider, renders Modal as no-op (no throw)', () => {
    expect(() => {
      render(
        <Modal visible={true}>
          <Text>x</Text>
        </Modal>,
      );
    }).not.toThrow();
  });
});
