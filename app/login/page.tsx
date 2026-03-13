/**
 * Login page for PMS.
 *
 * Uses Supabase magic-link auth (email OTP). Submits to `/api/login`, which:
 * - enforces single-user mode, and
 * - triggers a magic-link email.
 *
 * The actual session is set when the user returns via `/auth/callback`.
 */

"use client";

import { useState } from "react";

type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "sent" }
  | { status: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [state, setState] = useState<LoginState>({ status: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

      setState({ status: "sent" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Login failed",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-foreground/80">
          Enter your email to receive a magic link.
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
            className="h-10 rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15 dark:bg-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state.status === "submitting" || state.status === "sent"}
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          disabled={state.status === "submitting" || state.status === "sent"}
        >
          {state.status === "submitting" ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {state.status === "sent" ? (
        <p className="text-sm text-foreground/80">
          Check your inbox for the magic link.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      ) : null}
    </main>
  );
}

