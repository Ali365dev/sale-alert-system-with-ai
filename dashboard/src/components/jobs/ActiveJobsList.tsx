import { useActiveJobsList } from "../../api/jobs";
import { Card } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { ProcessingPanel } from "./ProcessingPanel";

/** Live log, progress and Cancel for every queued/running job of any type —
 * email automation, push fan-outs and parallel scrapes included. */
export function ActiveJobsList() {
  const { data, isLoading, isError } = useActiveJobsList();
  const jobs = data?.jobs ?? [];

  if (isLoading) {
    return (
      <Card>
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Spinner />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--danger)" }}>Couldn't load running jobs.</p>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted)" }}>
          No jobs are running right now. Start one from Pipeline actions above.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(data?.total ?? 0) > jobs.length && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Showing the oldest {jobs.length} of {data?.total} unfinished jobs.
        </p>
      )}
      {jobs.map((job) => (
        <ProcessingPanel key={job.id} jobId={job.id} />
      ))}
    </div>
  );
}
