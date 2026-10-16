import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Loaders call this when they fell back after a query error, so the fallback isn't cached. */
export type SkipCache = () => void;

export const noSkipCache: SkipCache = () => {};

export const WORKSPACE_DATA_TAG = "workspace-data";

/** Safety net for writes that bypass server actions (SQL scripts, client-side RPCs). */
const WORKSPACE_DATA_REVALIDATE_SEC = 60;

/** Per-deploy so a schema change never serves rows cached by the previous build. */
const BUILD_KEY =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NODE_ENV ?? "local";

class UncachedResult {
  constructor(readonly value: unknown) {}
}

/**
 * Server data cache for workspace reads. Keyed per user because results depend on RLS.
 * `key` must encode every input the loader reads (e.g. the selected financial year).
 * Every server action that writes calls `invalidateWorkspaceData()`.
 */
export async function workspaceCache<T>(
  key: string,
  userId: string,
  load: (supabase: ServerSupabase, skipCache: SkipCache) => Promise<T>,
): Promise<T> {
  const supabase = await createClient();
  const cached = unstable_cache(
    async () => {
      let skip = false;
      const value = await load(supabase, () => {
        skip = true;
      });
      if (skip) throw new UncachedResult(value);
      return value;
    },
    ["workspace", BUILD_KEY, key, userId],
    { revalidate: WORKSPACE_DATA_REVALIDATE_SEC, tags: [WORKSPACE_DATA_TAG] },
  );

  try {
    return await cached();
  } catch (err) {
    if (err instanceof UncachedResult) return err.value as T;
    throw err;
  }
}
