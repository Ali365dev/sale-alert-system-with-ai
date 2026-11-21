import { isJobActive, useActiveJob, useStartJob } from "../../api/jobs";
import { Button } from "../ui/Button";

const JOB_TYPE = "process_pending";

/** Runs the process_pending job scoped to emails still marked "unprocessed"
 * (only_unprocessed) — not failed ones, and not processed emails whose offer
 * the retention cleanup already removed. */
export function ProcessUnprocessedButton({ unprocessed }: { unprocessed: number }) {
  const startJob = useStartJob(JOB_TYPE);
  const active = useActiveJob(JOB_TYPE);
  const running = startJob.isPending || isJobActive(active.data?.status);

  const run = () => {
    const ok = window.confirm(
      `Analyse ${unprocessed} unprocessed email${unprocessed === 1 ? "" : "s"} now?\n\n` +
        "New offers notify matching users, except offers that already expired " +
        "or come from emails older than 7 days.",
    );
    if (ok) startJob.mutate({ only_unprocessed: true });
  };

  return (
    <Button size="sm" loading={running} disabled={running || unprocessed === 0} onClick={run}>
      {running ? "Processing unprocessed…" : `Process all unprocessed (${unprocessed})`}
    </Button>
  );
}
