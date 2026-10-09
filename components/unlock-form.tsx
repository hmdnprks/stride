"use client";

import { useActionState } from "react";
import { unlockAction, type UnlockState } from "@/app/unlock/actions";
import { StatusButton } from "./uselayouts/save-button";

export function UnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-panel-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          disabled={pending}
          className="h-12 w-full rounded-xl border-2 border-transparent bg-background px-4 text-base text-foreground outline-none focus:border-foreground disabled:opacity-70"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-white/15 px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
      <StatusButton
        type="submit"
        variant="ink"
        status={pending ? "loading" : "idle"}
        labels={{ idle: "Unlock", loading: "Checking", success: "Unlocked" }}
      />
    </form>
  );
}
