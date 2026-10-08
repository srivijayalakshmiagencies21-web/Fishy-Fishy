"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountEmail } from "@/lib/account-email";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = accountEmail(String(formData.get("username") ?? ""));
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Enter your name and password.");
      return;
    }

    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setPending(false);
      setError(signInError.message);
      return;
    }

    router.push("/masters/accounts");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label>
        <span className="label">Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="admin"
          className="input-field"
          onChange={(event) => {
            event.currentTarget.value = event.currentTarget.value.split("@")[0].replace(/\s/g, "");
          }}
        />
      </label>
      <label>
        <span className="label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input-field" placeholder="••••••••" />
      </label>
      {error ? <p className="login-error">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
