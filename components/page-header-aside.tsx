"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type PageHeaderAsideStore = {
  asideRef: React.MutableRefObject<ReactNode>;
  subscribe: (onStoreChange: () => void) => () => void;
  bump: () => void;
};

const PageHeaderAsideContext = createContext<PageHeaderAsideStore | null>(null);

function getAsideSnapshot(store: PageHeaderAsideStore | null) {
  return store?.asideRef.current ?? null;
}

export function PageHeaderAsideProvider({ children }: { children: ReactNode }) {
  const asideRef = useRef<ReactNode>(null);
  const listenersRef = useRef(new Set<() => void>());
  const pathname = usePathname();
  const pathRef = useRef(pathname);

  if (pathRef.current !== pathname) {
    pathRef.current = pathname;
    asideRef.current = null;
  }

  const store = useMemo<PageHeaderAsideStore>(
    () => ({
      asideRef,
      subscribe: (onStoreChange) => {
        listenersRef.current.add(onStoreChange);
        return () => {
          listenersRef.current.delete(onStoreChange);
        };
      },
      bump: () => {
        for (const listener of listenersRef.current) {
          listener();
        }
      },
    }),
    [],
  );

  return <PageHeaderAsideContext.Provider value={store}>{children}</PageHeaderAsideContext.Provider>;
}

export function PageHeaderAsideSlot() {
  const store = useContext(PageHeaderAsideContext);
  const aside = useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => getAsideSnapshot(store),
    () => getAsideSnapshot(store),
  );
  if (!aside) return null;
  return <div className="page-header-aside page-header-aside--active">{aside}</div>;
}

/** Registers `children` in the canvas page header beside the title (same render pass as page content). */
export function PageHeaderAside({ children }: { children: ReactNode }) {
  const store = useContext(PageHeaderAsideContext);

  if (store) {
    store.asideRef.current = children;
  }

  useLayoutEffect(() => {
    if (!store) return;
    store.bump();
    return () => {
      store.asideRef.current = null;
      store.bump();
    };
  }, [children, store]);

  return null;
}
