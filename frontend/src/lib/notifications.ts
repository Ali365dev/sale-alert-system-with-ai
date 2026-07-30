import { useEffect, useRef, useState } from "react";

import type { Job } from "../api/jobs";
import { isJobActive, useActiveJob, useJob } from "../api/jobs";
import { toast } from "../store/toastStore";
import { getJobTypeConfig, JOB_TYPES } from "../config/jobTypes";

export type JobLifecycleEvent = "started" | "completed" | "failed" | "cancelled" | "retried";

function desktopNotificationsAvailable() {
  return typeof window !== "undefined" && "Notification" in window;
}

let permissionRequested = false;

function ensurePermission() {
  if (!desktopNotificationsAvailable() || permissionRequested) return;
  permissionRequested = true;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

const EVENT_TEXT: Record<JobLifecycleEvent, (title: string) => string> = {
  started: (title) => `${title} started`,
  completed: (title) => `${title} completed`,
  failed: (title) => `${title} failed`,
  cancelled: (title) => `${title} cancelled`,
  retried: (title) => `${title} retry started`,
};

export function notifyJobEvent(event: JobLifecycleEvent, job: Job) {
  const config = getJobTypeConfig(job.job_type);
  const message = EVENT_TEXT[event](config.title);

  if (event === "failed") toast.error(message);
  else if (event === "completed") toast.success(message);
  else toast.info(message);

  if (desktopNotificationsAvailable() && Notification.permission === "granted") {
    try {
      new Notification(message, { body: job.current_item_label ?? undefined, tag: `job-${job.id}` });
    } catch {
      // best-effort only — desktop notifications can fail silently (e.g. denied mid-session)
    }
  }
}

/** Watches every registered job type's "active job" slot and fires a
 * lifecycle notification whenever a job starts or leaves the active state.
 * Mount once, app-wide (in AppShell), so notifications fire regardless of
 * which page the user is on. */
export function useJobLifecycleNotifications() {
  useEffect(() => {
    ensurePermission();
  }, []);

  for (const { jobType } of JOB_TYPES) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- JOB_TYPES is a static, module-level constant
    useJobTypeNotifications(jobType);
  }
}

function useJobTypeNotifications(jobType: string) {
  // useActiveJob only ever returns a job while it's pending/running/cancelling
  // — it goes back to null the instant a job finishes, so it can't be used to
  // observe a *completion* transition. Instead: use it only to notice a job
  // starting, then track that job's id locally and watch it via useJob (which
  // keeps returning the last-known data even after the job finishes).
  const active = useActiveJob(jobType);
  const [watchedId, setWatchedId] = useState<number | null>(null);
  const watched = useJob(watchedId);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active.data && active.data.id !== watchedId) {
      setWatchedId(active.data.id);
      notifyJobEvent(active.data.payload?.retry_of ? "retried" : "started", active.data);
    }
  }, [active.data, watchedId]);

  useEffect(() => {
    const job = watched.data;
    const nowActive = isJobActive(job?.status);

    if (wasActive.current && !nowActive && job) {
      if (job.status === "completed") notifyJobEvent("completed", job);
      else if (job.status === "failed") notifyJobEvent("failed", job);
      else if (job.status === "cancelled") notifyJobEvent("cancelled", job);
    }

    wasActive.current = nowActive;
  }, [watched.data]);
}
