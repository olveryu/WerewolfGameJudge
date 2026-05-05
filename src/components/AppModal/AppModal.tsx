/**
 * AppModal — drop-in replacement for react-native's <Modal>.
 *
 * Wraps RN-web Modal and registers with ModalStackContext while visible.
 * The provider applies `inert` to #root on web when the stack is non-empty,
 * blocking pointer/keyboard/screen-reader access to background while a modal
 * is open. On native, registration is a no-op (RN <Modal> blocks natively).
 *
 * All non-AppModal imports of `Modal` from 'react-native' are forbidden via
 * the `no-restricted-imports` ESLint rule (see eslint.config.mjs).
 */

import { useEffect, useId } from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';

import { useModalStack } from './ModalStackContext';

export function AppModal(props: ModalProps) {
  const id = useId();
  const { register, unregister } = useModalStack();

  useEffect(() => {
    if (!props.visible) return;
    register(id);
    return () => unregister(id);
  }, [props.visible, register, unregister, id]);

  return <RNModal {...props} />;
}
