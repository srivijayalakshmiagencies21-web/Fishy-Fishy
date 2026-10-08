"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { accountEmail } from "@/lib/account-email";
import { appPages, pageLabel } from "@/lib/access";
import type { DirectoryRole, DirectoryUser } from "@/lib/directory";
import { createClient } from "@/lib/supabase/client";
import { useNavIntent } from "@/components/nav-intent";
import { SelectField } from "@/components/select-field";

type RoleRow = {
  id: string;
  name: string;
  allowed_pages: string[];
  is_system: boolean;
};

type UserRow = {
  user_id: string;
  email: string | null;
  role_id: string | null;
  role_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  active: boolean;
};

export function UserManagement({
  currentUserId,
  actorRole,
  canManageRoles,
  initialRoles,
  initialUsers,
  initialError,
}: {
  currentUserId: string;
  actorRole: string;
  canManageRoles: boolean;
  initialRoles: DirectoryRole[];
  initialUsers: DirectoryUser[];
  initialError: string | null;
}) {
  const pathname = usePathname();
  const { adminTab } = useNavIntent();
  const tab = canManageRoles
    ? (adminTab ?? (pathname.startsWith("/admin/roles") ? "roles" : "users"))
    : "users";
  const supabase = useMemo(() => createClient(), []);
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles);
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(() => defaultRoleId(initialRoles));
  const [roleName, setRoleName] = useState("");
  const [rolePages, setRolePages] = useState<string[]>(["masters"]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [nextPassword, setNextPassword] = useState("");

  async function load() {
    setError(null);
    const [roleResult, userResult] = await Promise.all([
      supabase.from("roles").select("id, name, allowed_pages, is_system").order("created_at"),
      supabase.rpc("list_app_users"),
    ]);

    if (roleResult.error) {
      setError(roleResult.error.message);
    } else {
      const nextRoles = roleResult.data ?? [];
      setRoles(nextRoles);
      setRoleId((current) => current || nextRoles.find((role) => role.name === "Manager")?.id || nextRoles[0]?.id || "");
    }

    if (userResult.error) {
      setError(userResult.error.message);
    } else {
      setUsers(userResult.data ?? []);
    }

    setLoading(false);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    const email = accountEmail(username);
    if (!email) {
      setError("Use a username made of letters, numbers, dots, or hyphens.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke("manage-users", {
      body: { action: "create", email, password, role_id: roleId },
    });
    setSaving(false);

    if (invokeError) {
      setError(await functionError(invokeError));
      return;
    }

    setUsername("");
    setPassword("");
    setShowUserForm(false);
    await load();
  }

  async function assignRole(userId: string, nextRoleId: string) {
    setError(null);
    const { error: assignError } = await supabase.rpc("assign_user_role", {
      p_user_id: userId,
      p_role_id: nextRoleId,
    });
    if (assignError) {
      setError(assignError.message);
      return;
    }
    await load();
  }

  async function resetPassword(event: React.FormEvent, userId: string) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_password", user_id: userId, password: nextPassword },
    });
    setSaving(false);
    if (invokeError) {
      setError(await functionError(invokeError));
      return;
    }
    setResetUserId(null);
    setNextPassword("");
  }

  async function setActive(userId: string, active: boolean) {
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke("manage-users", {
      body: { action: active ? "deactivate" : "activate", user_id: userId },
    });
    if (invokeError) {
      setError(await functionError(invokeError));
      return;
    }
    await load();
  }

  async function removeUser(userId: string) {
    setSaving(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: userId },
    });
    setSaving(false);
    if (invokeError) {
      setError(await functionError(invokeError));
      return;
    }
    setConfirmUserId(null);
    await load();
  }

  async function saveRole(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = editingRoleId
      ? await supabase.rpc("update_role", {
          p_role_id: editingRoleId,
          p_name: roleName,
          p_allowed_pages: rolePages,
        })
      : await supabase.rpc("create_role", {
          p_name: roleName,
          p_allowed_pages: rolePages,
        });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setShowRoleForm(false);
    setEditingRoleId(null);
    setRoleName("");
    setRolePages(["masters"]);
    await load();
  }

  async function removeRole(id: string) {
    setError(null);
    const { error: deleteError } = await supabase.rpc("delete_role", { p_role_id: id });
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  const visibleUsers = actorRole === "Admin"
    ? users
    : users.filter((user) => user.role_name === "Manager" || user.role_name === "Employee");
  const visibleRoles = actorRole === "Admin" ? roles : roles.filter((role) => role.name !== "Admin");

  function openRoleForm(role?: RoleRow) {
    if (role) {
      setEditingRoleId(role.id);
      setRoleName(role.name);
      setRolePages(role.allowed_pages);
    } else {
      setEditingRoleId(null);
      setRoleName("");
      setRolePages(["masters"]);
    }
    setShowRoleForm(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {tab === "users" ? (
          canManageRoles ? (
            <button type="button" className="btn-primary" onClick={() => setShowUserForm((open) => !open)}>
              Add user
            </button>
          ) : null
        ) : (
          <button type="button" className="btn-primary" onClick={() => openRoleForm()}>
            Create role
          </button>
        )}
      </div>

      {error ? <p className="rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm font-medium text-[var(--brand-dark)]">{error}</p> : null}

      {tab === "users" ? (
        <div key="users" className="tab-panel space-y-5">
          {showUserForm ? (
            <form onSubmit={createUser} className="surface space-y-4 p-5">
              <h2 className="text-base font-semibold">New user</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="label">Username</span>
                  <input className="input-field" required value={username} onChange={(event) => setUsername(event.target.value.split("@")[0].replace(/\s/g, ""))} placeholder="rahul" />
                </label>
                <label>
                  <span className="label">Password</span>
                  <input className="input-field" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Min 8 characters" />
                </label>
                <label>
                  <span className="label">Role</span>
                  {visibleRoles.length > 0 ? (
                    <SelectField
                      key={visibleRoles.map((role) => role.id).join()}
                      name="role_id"
                      required
                      defaultValue={roleId}
                      onChange={setRoleId}
                      options={visibleRoles.map((role) => ({ value: role.id, label: role.name }))}
                    />
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">Loading roles…</p>
                  )}
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving || !roleId}>
                  {saving ? "Saving…" : "Create user"}
                </button>
              </div>
            </form>
          ) : null}

          <section className="surface data-card">
            {loading ? (
              <div className="skeleton-block skeleton-block--table" />
            ) : visibleUsers.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">No users yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th className="col-role">Role</th>
                    <th className="col-joined">Joined</th>
                    <th className="col-login">Last logged in</th>
                    <th className="col-action" />
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td className="font-medium">{displayName(user.email)}</td>
                      <td>
                        {canManageRoles ? (
                          <SelectField
                            compact
                            name={`role-${user.user_id}`}
                            defaultValue={user.role_id ?? roles[0]?.id ?? ""}
                            onChange={(nextRoleId) => assignRole(user.user_id, nextRoleId)}
                            options={visibleRoles.map((role) => ({ value: role.id, label: role.name }))}
                          />
                        ) : (
                          <span>{user.role_name ?? "No role"}</span>
                        )}
                      </td>
                      <td className="text-[var(--text-secondary)]" suppressHydrationWarning>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="text-[var(--text-secondary)]" suppressHydrationWarning>{formatLoggedIn(user.last_sign_in_at)}</td>
                      <td className="col-action">
                        {resetUserId === user.user_id ? (
                          <form onSubmit={(event) => resetPassword(event, user.user_id)} className="flex items-center gap-2">
                            <input
                              className="input-field input-inline"
                              type="password"
                              required
                              minLength={8}
                              value={nextPassword}
                              onChange={(event) => setNextPassword(event.target.value)}
                              placeholder="New password"
                            />
                            <button type="submit" className="btn-primary shrink-0" disabled={saving}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn-quiet shrink-0"
                              onClick={() => {
                                setResetUserId(null);
                                setNextPassword("");
                              }}
                            >
                              Cancel
                            </button>
                          </form>
                        ) : confirmUserId === user.user_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--text-secondary)]">Remove {displayName(user.email)}?</span>
                            <button type="button" className="pill pill-red" disabled={saving} onClick={() => removeUser(user.user_id)}>
                              {saving ? "Removing…" : "Remove"}
                            </button>
                            <button type="button" className="btn-quiet shrink-0" disabled={saving} onClick={() => setConfirmUserId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-start gap-2">
                            {user.active ? null : <span className="text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Inactive</span>}
                            {canResetPassword(actorRole, user.role_name, canManageRoles) ? (
                              <button
                                type="button"
                                className="pill pill-blue"
                                onClick={() => {
                                  setResetUserId(user.user_id);
                                  setConfirmUserId(null);
                                  setNextPassword("");
                                }}
                              >
                                Reset password
                              </button>
                            ) : null}
                            {canDeactivateUser(actorRole, user.role_name, user.user_id === currentUserId, canManageRoles) ? (
                              <button
                                type="button"
                                className={user.active ? "pill pill-red" : "pill pill-green"}
                                onClick={() => setActive(user.user_id, user.active)}
                              >
                                {user.active ? "Deactivate" : "Activate"}
                              </button>
                            ) : null}
                            {canManageRoles && user.user_id !== currentUserId && (actorRole === "Admin" || user.role_name !== "Admin") ? (
                              <button type="button" className="pill pill-blue" onClick={() => {
                                setResetUserId(null);
                                setNextPassword("");
                                setConfirmUserId(user.user_id);
                              }}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      ) : (
        <div key="roles" className="tab-panel space-y-5">
          {showRoleForm ? (
            <form onSubmit={saveRole} className="surface space-y-4 p-5">
              <h2 className="text-base font-semibold">{editingRoleId ? "Edit role" : "New role"}</h2>
              <label className="block max-w-sm">
                <span className="label">Role name</span>
                <input className="input-field" required value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Supervisor" />
              </label>
              <fieldset>
                <legend className="label">Allowed pages</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {appPages.map((page) => (
                    <label key={page.key} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${rolePages.includes(page.key) ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--brand)]"
                        checked={rolePages.includes(page.key)}
                        onChange={() =>
                          setRolePages((current) =>
                            current.includes(page.key) ? current.filter((key) => key !== page.key) : [...current, page.key],
                          )
                        }
                      />
                      <span className="text-sm font-medium">{page.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving || rolePages.length === 0}>
                  {saving ? "Saving…" : "Save role"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleRoles.map((role) => (
              <article key={role.id} className="surface flex flex-col p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{role.name}</h3>
                    {role.is_system ? (
                      <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-[var(--brand-dark)]">
                        SYSTEM
                      </span>
                    ) : null}
                  </div>
                  {role.is_system ? null : (
                    <div className="flex gap-3 text-sm font-semibold text-[var(--brand)]">
                      <button type="button" onClick={() => openRoleForm(role)}>Edit</button>
                      <button type="button" onClick={() => removeRole(role.id)}>Remove</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.allowed_pages.length > 0 ? (
                    role.allowed_pages.map((page) => (
                      <span key={page} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-dark)]">
                        {pageLabel(page)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">No pages</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function canResetPassword(actorRole: string, targetRole: string | null, managesDirectory: boolean) {
  if (actorRole === "Employee") return false;
  if (targetRole === "Admin") return actorRole === "Admin";
  if (actorRole === "Admin" || managesDirectory) return true;
  if (actorRole === "Manager") return targetRole === "Manager" || targetRole === "Employee";
  return false;
}

function canDeactivateUser(actorRole: string, targetRole: string | null, self: boolean, managesDirectory: boolean) {
  if (self) return false;
  return canResetPassword(actorRole, targetRole, managesDirectory);
}

function defaultRoleId(roles: { id: string; name: string }[]) {
  return roles.find((role) => role.name === "Manager")?.id ?? roles[0]?.id ?? "";
}

function displayName(email: string | null) {
  if (!email) return "Unknown";
  return email.split("@")[0];
}

function formatLoggedIn(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function functionError(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const body = await context.json().catch(() => null);
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return body.error;
      }
    }
  }

  return error instanceof Error ? error.message : "Request failed";
}
