"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";

type PageHeaderAsideContextValue = {
  asideRef: React.MutableRefObject<ReactNode>;
};

const PageHeaderAsideContext = createContext<PageHeaderAsideContextValue | null>(null);

export function PageHeaderAsideProvider({ children }: { children: ReactNode }) {
  const asideRef = useRef<ReactNode>(null);
  const value = useMemo(() => ({ asideRef }), [asideRef]);
  return (
    <PageHeaderAsideContext.Provider value={value}>{children}</PageHeaderAsideContext.Provider>
  );
}

export function PageHeaderAsideSlot() {
  const ctx = useContext(PageHeaderAsideContext);
  return <div className="page-header-aside">{ctx?.asideRef.current ?? null}</div>;
}

/** Registers `children` for the canvas page header (rendered beside the title). */
export function PageHeaderAside({ children }: { children: ReactNode }) {
  const ctx = useContext(PageHeaderAsideContext);

  if (ctx) {
    ctx.asideRef.current = children;
  }

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.asideRef.current = children;
    return () => {
      ctx.asideRef.current = null;
    };
  }, [children, ctx]);

  return null;
}
