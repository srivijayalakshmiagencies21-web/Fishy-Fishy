"use client";

import { useLayoutEffect } from "react";
import { rememberMaster } from "@/components/master-cache";
import type { MasterData } from "@/lib/masters";

export function RememberMaster({
  slug,
  data,
  notice,
}: {
  slug: string;
  data: MasterData;
  notice: string | null;
}) {
  useLayoutEffect(() => {
    rememberMaster(slug, data, notice);
  }, [slug, data, notice]);

  return null;
}
