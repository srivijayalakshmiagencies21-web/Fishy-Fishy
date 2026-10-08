import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  pages: string[];
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return null;
  }

  const [{ data: pages }, { data: role }] = await Promise.all([
    supabase.rpc("get_my_pages"),
    supabase.rpc("get_my_role"),
  ]);

  return {
    id: typeof claims.sub === "string" ? claims.sub : "",
    email: typeof claims.email === "string" ? claims.email : "",
    role: role ?? "",
    pages: pages ?? [],
  };
});
