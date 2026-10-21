"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type PageHeaderSlotName = "aside" | "tabs";
type PageHeaderSlots = Record<PageHeaderSlotName, ReactNode>;

const EMPTY_SLOTS: PageHeaderSlots = { aside: null, tabs: null };

type PageHeaderSlotStore = {
  get: (name: PageHeaderSlotName) => ReactNode;
  set: (name: PageHeaderSlotName, node: ReactNode) => void;
  subscribe: (onStoreChange: () => void) => () => void;
};

const PageHeaderSlotContext = createContext<PageHeaderSlotStore | null>(null);

export function PageHeaderAsideProvider({ children }: { children: ReactNode }) {
  const slotsRef = useRef<PageHeaderSlots>(EMPTY_SLOTS);
  const listenersRef = useRef(new Set<() => void>());

  const store = useMemo<PageHeaderSlotStore>(
    () => ({
      get: (name) => slotsRef.current[name],
      set: (name, node) => {
        slotsRef.current = { ...slotsRef.current, [name]: node };
        for (const listener of listenersRef.current) {
          listener();
        }
      },
      subscribe: (onStoreChange) => {
        listenersRef.current.add(onStoreChange);
        return () => {
          listenersRef.current.delete(onStoreChange);
        };
      },
    }),
    [],
  );

  return <PageHeaderSlotContext.Provider value={store}>{children}</PageHeaderSlotContext.Provider>;
}

/**
 * The page body sits in a loading boundary that hydrates after the header, so slots render empty on
 * the server and during hydration and fill in once the page has registered its content.
 */
function usePageHeaderSlot(name: PageHeaderSlotName) {
  const store = useContext(PageHeaderSlotContext);
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => {}),
    () => store?.get(name) ?? null,
    () => null,
  );
}

/** Registers `children` in a canvas page header slot. */
function useRegisterPageHeaderSlot(name: PageHeaderSlotName, children: ReactNode) {
  const store = useContext(PageHeaderSlotContext);

  useLayoutEffect(() => {
    if (!store) return;
    store.set(name, children);
    return () => store.set(name, null);
  }, [children, name, store]);
}

export function PageHeaderAsideSlot() {
  const aside = usePageHeaderSlot("aside");
  if (!aside) return null;
  return <div className="page-header-aside page-header-aside--active">{aside}</div>;
}

/** Renders `children` in the canvas page header beside the title. */
export function PageHeaderAside({ children }: { children: ReactNode }) {
  useRegisterPageHeaderSlot("aside", children);
  return null;
}

export function PageHeaderTabsSlot() {
  const tabs = usePageHeaderSlot("tabs");
  if (!tabs) return null;
  return <div className="mt-3">{tabs}</div>;
}

/** Renders `children` (a tab strip) in the canvas page header below the title, like Masters. */
export function PageHeaderTabs({ children }: { children: ReactNode }) {
  useRegisterPageHeaderSlot("tabs", children);
  return null;
}
