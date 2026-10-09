"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDeferredValue, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HeartCheckIcon, Link01Icon, Logout03Icon, RunningShoesIcon, Sun03Icon, Target01Icon } from "@hugeicons/core-free-icons";
import { signOutAction, syncAction } from "@/app/actions";
import type { Range } from "@/lib/garmin/types";
import { TrendsPending } from "../charts/pending";
import { RangePicker } from "../charts/range-picker";
import { DiscreteTabs, type DiscreteTab } from "../uselayouts/discrete-tabs";
import { SmoothDropdown, type DropdownItem } from "../uselayouts/smooth-dropdown";
import { StatusButton, type ButtonStatus } from "../uselayouts/save-button";
import { ThemeToggle } from "../uselayouts/theme-toggle";

type View = "today" | "fitness" | "runs" | "goals";

const TABS: DiscreteTab<View>[] = [
  { id: "today", title: "Today", icon: Sun03Icon },
  { id: "fitness", title: "Fitness", icon: HeartCheckIcon },
  { id: "runs", title: "Runs", icon: RunningShoesIcon },
  { id: "goals", title: "Goals", icon: Target01Icon },
];

// The open tab lives in the URL hash so reloads and shared links keep it.
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function readView(): View {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? (h as View) : "today";
}
function setView(v: View) {
  history.replaceState(null, "", v === "today" ? window.location.pathname : `#${v}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  window.scrollTo({ top: 0 });
}

function SyncButton() {
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [, startTransition] = useTransition();
  return (
    <StatusButton
      variant="quiet"
      status={status}
      labels={{ idle: "Sync", loading: "Syncing", success: "Synced" }}
      onClick={() => {
        setStatus("loading");
        startTransition(async () => {
          await syncAction();
          setStatus("success");
          setTimeout(() => setStatus("idle"), 1600);
        });
      }}
    />
  );
}

function AccountMenu({ name, live }: { name: string; live: boolean }) {
  const router = useRouter();
  const items: DropdownItem[] = live
    ? [{ id: "signout", label: "Sign out of Garmin", icon: Logout03Icon, onSelect: () => void signOutAction() }]
    : [{ id: "connect", label: "Connect Garmin", icon: Link01Icon, onSelect: () => router.push("/login") }];

  return (
    <SmoothDropdown
      triggerLabel="Account"
      trigger={
        <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
          {name.charAt(0).toUpperCase()}
        </span>
      }
      header={
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{live ? "Connected to Garmin" : "Viewing demo data"}</span>
        </div>
      }
      items={items}
    />
  );
}

export function DashboardFrame({
  name,
  live,
  range,
  views,
  footer,
}: {
  name: string;
  live: boolean;
  range: Range;
  views: Record<View, ReactNode>;
  footer: ReactNode;
}) {
  const view = useSyncExternalStore(subscribeHash, readView, () => "today" as View);
  // Each view's chart code loads on first use. Rendering the panel from a
  // deferred value keeps the current panel up while the next one loads,
  // instead of suspending the whole dashboard back to its skeleton.
  const shownView = useDeferredValue(view);
  // Animate panel changes only when the reader picks a tab, not when a #hash
  // link is applied after hydration.
  const [animatePanels, setAnimatePanels] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // Show the new selection immediately; charts dim until the data arrives.
  const [shownRange, setShownRange] = useState(range);
  if (!pending && shownRange !== range) setShownRange(range);

  const changeRange = (r: Range) => {
    setShownRange(r);
    startTransition(() => {
      router.replace(`${pathname}${r === "4w" ? "" : `?range=${r}`}${window.location.hash}`, { scroll: false });
    });
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-8">
          <Link href={live ? "/" : "/demo"} className="wide mr-auto text-lg font-extrabold sm:mr-0">
            Stride
          </Link>
          <nav className="order-last w-full sm:order-none sm:flex sm:w-auto sm:flex-1 sm:justify-center">
            <DiscreteTabs
              label="Dashboard views"
              tabs={TABS}
              value={view}
              onChange={(v) => {
                setAnimatePanels(true);
                setView(v);
              }}
            />
          </nav>
          <div className="flex items-center gap-3">
            {live ? (
              <SyncButton />
            ) : (
              <Link
                href="/login"
                className="hidden h-11 items-center rounded-full bg-primary px-5 sm:flex text-sm font-semibold text-primary-foreground hover:bg-deep hover:text-background"
              >
                Connect Garmin
              </Link>
            )}
            <ThemeToggle />
            <AccountMenu name={name} live={live} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        {/* Goals don't follow the trend range, so the picker steps aside there. */}
        {shownView !== "goals" && (
          <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm text-muted-foreground">Trends over</span>
            <RangePicker value={shownRange} onChange={changeRange} />
          </div>
        )}
        <TrendsPending value={pending}>
          {animatePanels ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={shownView}
                role="tabpanel"
                id={`panel-${shownView}`}
                aria-labelledby={`tab-${shownView}`}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {views[shownView]}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div role="tabpanel" id={`panel-${shownView}`} aria-labelledby={`tab-${shownView}`}>
              {views[shownView]}
            </div>
          )}
        </TrendsPending>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-8">{footer}</footer>
    </>
  );
}
