import "server-only";

import { revalidateTag } from "next/cache";
import { WORKSPACE_DATA_TAG } from "@/lib/workspace-cache.server";

const EXPIRE_NOW = { expire: 0 };

export function invalidateWorkspaceData() {
  revalidateTag(WORKSPACE_DATA_TAG, EXPIRE_NOW);
}

export function invalidateJourneyCaches() {
  revalidateTag("journeys", EXPIRE_NOW);
  invalidateWorkspaceData();
}

export function invalidateMasterCache(slug: string) {
  revalidateTag(`master:${slug}`, EXPIRE_NOW);
  invalidateWorkspaceData();
}
