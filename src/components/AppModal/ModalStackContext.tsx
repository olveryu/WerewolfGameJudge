import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

interface ModalStackContextValue {
  register: (id: string) => void;
  unregister: (id: string) => void;
}

const NOOP_VALUE: ModalStackContextValue = {
  register: () => {},
  unregister: () => {},
};

const ModalStackContext = createContext<ModalStackContextValue>(NOOP_VALUE);

const ROOT_ID = 'root';

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<Set<string>>(new Set());
  const [size, setSize] = useState(0);

  const register = useCallback((id: string) => {
    stackRef.current.add(id);
    setSize(stackRef.current.size);
  }, []);

  const unregister = useCallback((id: string) => {
    stackRef.current.delete(id);
    setSize(stackRef.current.size);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.getElementById(ROOT_ID);
    if (!root) {
      throw new Error(
        `[ModalStack] document#${ROOT_ID} not found — required for background inert blocking`,
      );
    }
    if (size > 0) {
      root.setAttribute('inert', '');
    } else {
      root.removeAttribute('inert');
    }
  }, [size]);

  return (
    <ModalStackContext.Provider value={{ register, unregister }}>
      {children}
    </ModalStackContext.Provider>
  );
}

/**
 * Without a <ModalStackProvider> ancestor, returns a no-op (register/unregister
 * do nothing). Lets test renders + non-web hosts skip provider setup; in those
 * environments inert background blocking isn't applicable anyway.
 */
export function useModalStack(): ModalStackContextValue {
  return useContext(ModalStackContext);
}
