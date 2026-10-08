import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  action?: "create" | "delete" | "deactivate" | "activate" | "reset_password";
  email?: string;
  password?: string;
  role_id?: string;
  user_id?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Not authenticated" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const [{ data: pages, error: pageError }, { data: actorRole, error: roleError }, { data: userData, error: userError }] =
    await Promise.all([
      caller.rpc("get_my_pages"),
      caller.rpc("get_my_role"),
      caller.auth.getUser(),
    ]);

  if (userError || !userData.user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const actor = typeof actorRole === "string" ? actorRole : "";
  const allowedPages = Array.isArray(pages) ? pages : [];
  if (pageError || roleError) {
    return json({ error: "Not allowed" }, 403);
  }

  const admin = createClient(url, serviceKey);
  const body = (await request.json()) as Body;

  if (body.action === "deactivate" || body.action === "activate" || body.action === "reset_password") {
    if (!body.user_id) return json({ error: "Account is required." }, 400);
    const targetRole = await roleName(admin, body.user_id);
    const self = body.user_id === userData.user.id;
    const managesDirectory = allowedPages.includes("users");
    const permitted = body.action === "reset_password"
      ? canResetPassword(actor, targetRole, managesDirectory)
      : canDeactivate(actor, targetRole, self, managesDirectory);
    if (!permitted) return json({ error: "Not allowed" }, 403);

    if (body.action === "reset_password") {
      if (!body.password || body.password.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ data: { user_id: body.user_id } });
    }

    const { error } = await admin.auth.admin.updateUserById(body.user_id, {
      ban_duration: body.action === "deactivate" ? "876000h" : "none",
    });
    if (error) return json({ error: error.message }, 400);
    return json({ data: { user_id: body.user_id } });
  }

  if (!allowedPages.includes("users")) {
    return json({ error: "Not allowed" }, 403);
  }

  if (body.action === "create") {
    if (!body.email || !body.password || !body.role_id) {
      return json({ error: "Name, password, and role are required." }, 400);
    }
    if (body.password.length < 8) {
      return json({ error: "Password must be at least 8 characters." }, 400);
    }

    const assignedRole = await roleNameById(admin, body.role_id);
    if (assignedRole === "Admin" && actor !== "Admin") {
      return json({ error: "Not allowed" }, 403);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (error || !data.user) {
      return json({ error: error?.message ?? "Could not create the account." }, 400);
    }

    const { error: linkError } = await admin.from("user_roles").insert({
      user_id: data.user.id,
      role_id: body.role_id,
    });

    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: linkError.message }, 400);
    }

    return json({ data: { user_id: data.user.id } });
  }

  if (body.action === "delete") {
    if (!body.user_id) {
      return json({ error: "Account is required." }, 400);
    }
    if (body.user_id === userData.user.id) {
      return json({ error: "You cannot remove your own account." }, 400);
    }
    const targetRole = await roleName(admin, body.user_id);
    if (targetRole === "Admin" && actor !== "Admin") {
      return json({ error: "Not allowed" }, 403);
    }

    const { error } = await admin.auth.admin.deleteUser(body.user_id);
    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ data: { user_id: body.user_id } });
  }

  return json({ error: "Unknown action" }, 400);
});

function canResetPassword(actor: string, targetRole: string | null, managesDirectory: boolean) {
  if (actor === "Employee") return false;
  if (targetRole === "Admin") return actor === "Admin";
  if (actor === "Admin" || managesDirectory) return true;
  if (actor === "Manager") return targetRole === "Manager" || targetRole === "Employee";
  return false;
}

function canDeactivate(actor: string, targetRole: string | null, self: boolean, managesDirectory: boolean) {
  if (self) return false;
  return canResetPassword(actor, targetRole, managesDirectory);
}

async function roleNameById(
  admin: ReturnType<typeof createClient>,
  roleId: string,
) {
  const { data } = await admin.from("roles").select("name").eq("id", roleId).maybeSingle();
  return data?.name ?? null;
}

async function roleName(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data } = await admin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId)
    .maybeSingle();
  const roles = data?.roles as { name?: string } | { name?: string }[] | null;
  if (Array.isArray(roles)) return roles[0]?.name ?? null;
  return roles?.name ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
