import "server-only";

import { revalidateTag } from "next/cache";

export function invalidateJourneyCaches() {
  (revalidateTag as (tag: string, profile?: string) => void)("journeys");
}

export function invalidateMasterCache(slug: string) {
  (revalidateTag as (tag: string, profile?: string) => void)(`master:${slug}`);
}
