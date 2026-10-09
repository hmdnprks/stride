"use client";

import { useActionState, useState, type ReactNode } from "react";
import { authAction, type SignInState } from "@/app/actions";
import { StatusButton } from "./uselayouts/save-button";

// Sits on the blue watch panel, so it uses the panel's colours.
const input =
  "h-12 w-full rounded-xl border-2 border-transparent bg-background px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground disabled:opacity-70";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-panel-muted">{label}</span>
      {children}
    </label>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-white/15 px-4 py-3 text-sm">
      {children}
    </p>
  );
}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(authAction, { step: "credentials" });
  const [showPassword, setShowPassword] = useState(false);
  const error = state.error ?? (state.step === "credentials" && !state.email ? notice : undefined);

  if (state.step === "mfa") {
    return (
      <form action={action} className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="wide text-xl leading-tight font-bold">Enter your verification code</h1>
          <p className="text-panel-muted">
            Garmin sent a code to the email or authenticator app for <span className="text-panel-foreground">{state.email}</span>.
          </p>
        </header>

        <Field label="Verification code">
          <input
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{4,10}"
            placeholder="123456"
            disabled={pending}
            className={`${input} num h-16 text-[2.25rem] font-semibold tracking-[0.2em]`}
          />
        </Field>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col gap-2">
          <StatusButton
            type="submit"
            name="intent"
            value="verify"
            variant="ink"
            status={pending ? "loading" : "idle"}
            labels={{ idle: "Verify and connect", loading: "Verifying", success: "Connected" }}
          />
          <button
            type="submit"
            name="intent"
            value="back"
            formNoValidate
            disabled={pending}
            className="h-10 text-sm text-panel-muted underline-offset-4 hover:text-panel-foreground hover:underline"
          >
            Use a different account
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="wide text-xl leading-tight font-bold">Connect your Garmin account</h1>
        <p className="text-panel-muted">Use the email and password you sign in to Garmin Connect with.</p>
      </header>

      <div className="flex flex-col gap-4">
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            defaultValue={state.email}
            placeholder="you@example.com"
            disabled={pending}
            className={input}
          />
        </Field>
        <Field label="Password">
          <span className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              disabled={pending}
              className={`${input} pr-20`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </Field>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-3">
        <StatusButton
          type="submit"
          name="intent"
          value="signin"
          variant="ink"
          status={pending ? "loading" : "idle"}
          labels={{ idle: "Sign in", loading: "Signing in", success: "Connected" }}
        />
        <p className="text-sm leading-relaxed text-panel-muted">
          Your password goes only to Garmin and isn&apos;t saved. With two-step verification on, you&apos;ll enter the
          code next.
        </p>
      </div>
    </form>
  );
}
