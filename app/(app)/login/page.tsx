/**
 * Login page for PMS.
 *
 * Uses Supabase email/password authentication. Submits to `/api/login`, which:
 * - validates credentials using supabase.auth.signInWithPassword()
 * - creates the session if credentials are valid
 */

"use client";

import { useState } from "react";

type LoginStatus = "idle" | "submitting" | "success" | "error";

type LoginState = {
  status: LoginStatus;
  message?: string;
};

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [state, setState] = useState<LoginState>({ status: "idle" });

  const isDisabled = state.status === "submitting" || state.status === "success";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setState({
          status: "error",
          message: body?.error ?? `Login failed (${response.status})`,
        });
        return;
      }

      setState({ status: "success" });
      // Redirect to tasks page after successful login
      window.location.href = "/tasks";
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Login failed",
      });
    }
  }

  if (state.status === "success") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Signing in...</h1>
          <p className="text-sm text-foreground/80">
            Redirecting to your dashboard.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-foreground/80">
          Enter your email and password to access your account.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-hidden focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:bg-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDisabled}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-hidden focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:bg-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDisabled}
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          disabled={isDisabled}
        >
          {state.status === "submitting" ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
    </main>
  );
}

