import type { Dashboard as Data, Trends } from "@/lib/garmin";
import { DashboardFrame } from "./frame";
import { FitnessView, RunsView, TodayView } from "./views";

export function Dashboard({ data, trends }: { data: Data; trends: Trends }) {
  const synced = new Date(data.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <DashboardFrame
      name={data.athleteName}
      live={data.source === "garmin"}
      range={trends.range}
      views={{
        today: <TodayView data={data} trends={trends} />,
        fitness: <FitnessView data={data} trends={trends} />,
        runs: <RunsView data={data} trends={trends} />,
      }}
      footer={
        <div className="flex flex-col gap-2">
          <p>{data.source === "demo" ? "Sample data, not from a real watch." : `Synced from Garmin Connect at ${synced}.`}</p>
          {data.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs">
              {data.warnings.map((w) => (
                <li key={w}>Couldn&apos;t load {w}</li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-24 sm:px-8">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-full max-w-lg animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-[28rem] animate-pulse rounded-[2rem] bg-muted" />
      <p className="text-sm text-muted-foreground">Loading your data from Garmin Connect…</p>
    </div>
  );
}
