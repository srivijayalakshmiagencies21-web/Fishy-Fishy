import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type DirectoryRole = {
  id: string;
  name: string;
  allowed_pages: string[];
  is_system: boolean;
};

export type DirectoryUser = {
  user_id: string;
  email: string | null;
  role_id: string | null;
  role_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  active: boolean;
};

export const loadDirectory = cache(async function loadDirectory() {
  const supabase = await createClient();
  const [roles, users] = await Promise.all([
    supabase.from("roles").select("id, name, allowed_pages, is_system").order("created_at"),
    supabase.rpc("list_app_users"),
  ]);

  return {
    roles: (roles.data ?? []) as DirectoryRole[],
    users: (users.data ?? []) as DirectoryUser[],
    error: roles.error?.message ?? users.error?.message ?? null,
  };
});
