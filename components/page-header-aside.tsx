"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageHeaderAsideContextValue = {
  aside: ReactNode;
  setAside: (node: ReactNode) => void;
};

const PageHeaderAsideContext = createContext<PageHeaderAsideContextValue | null>(null);

export function PageHeaderAsideProvider({ children }: { children: ReactNode }) {
  const [aside, setAside] = useState<ReactNode>(null);
  const value = useMemo(() => ({ aside, setAside }), [aside]);
  return (
    <PageHeaderAsideContext.Provider value={value}>{children}</PageHeaderAsideContext.Provider>
  );
}

export function PageHeaderAsideSlot() {
  const ctx = useContext(PageHeaderAsideContext);
  if (!ctx?.aside) return null;
  return <div className="page-header-aside page-header-aside--active">{ctx.aside}</div>;
}

/** Registers `children` in the canvas page header beside the title. */
export function PageHeaderAside({ children }: { children: ReactNode }) {
  const setAside = useContext(PageHeaderAsideContext)?.setAside;

  useLayoutEffect(() => {
    if (!setAside) return;
    setAside(children);
    return () => setAside(null);
  }, [children, setAside]);

  return null;
}
