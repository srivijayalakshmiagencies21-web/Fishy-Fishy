"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MasterPanel } from "@/components/master-panel";
import { cachedMaster, cachedNotice, prefetchMasters, subscribeMasters } from "@/components/master-cache";
import { useNavIntent } from "@/components/nav-intent";

export function MastersHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { previewMaster } = useNavIntent();
  const [stick, setStick] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => { subscribeMasters(() => setTick((value) => value + 1)); }, []);

  useEffect(() => {
    void prefetchMasters();
  }, []);

  useEffect(() => {
    if (previewMaster) setStick(true);
  }, [previewMaster]);

  const slug = previewMaster ?? pathname.split("/").filter(Boolean).at(-1) ?? "";
  const data = cachedMaster(slug);
  const showCache = Boolean(previewMaster) || stick;

  if (!showCache || !data) return children;

  return (
    <>
      <div hidden>{children}</div>
      <MasterPanel key={slug} data={data} notice={cachedNotice(slug)} />
    </>
  );
}
