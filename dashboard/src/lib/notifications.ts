import { useEffect, useRef } from "react";

import { apiClient } from "../api/client";
import type { Job } from "../api/jobs";
import { isJobActive, useAllActiveJobs } from "../api/jobs";
import { toast } from "../store/toastStore";
import { getJobTypeConfig } from "../config/jobTypes";

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

async function notifyFinished(jobId: number) {
  try {
    const { data: job } = await apiClient.get<Job>(`/jobs/${jobId}`);
    if (isJobActive(job.status)) return;
    if (job.status === "completed") notifyJobEvent("completed", job);
    else if (job.status === "failed") notifyJobEvent("failed", job);
    else if (job.status === "cancelled") notifyJobEvent("cancelled", job);
  } catch {
    // ignore — toast is best-effort
  }
}

/** Watches active jobs app-wide via one `/jobs/active-all` poll (not one
 * request per job type). Mount once in AppShell. */
export function useJobLifecycleNotifications() {
  useEffect(() => {
    ensurePermission();
  }, []);

  const allActive = useAllActiveJobs();
  /** jobType → active job id last seen */
  const prevIds = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const jobs = allActive.data ?? {};
    const nextIds = new Map<string, number>();

    for (const [jobType, job] of Object.entries(jobs)) {
      if (!job || !isJobActive(job.status)) continue;
      nextIds.set(jobType, job.id);
      if (prevIds.current.get(jobType) !== job.id) {
        notifyJobEvent(job.payload?.retry_of ? "retried" : "started", job);
      }
    }

    for (const [jobType, prevId] of prevIds.current) {
      if (nextIds.get(jobType) !== prevId) {
        void notifyFinished(prevId);
      }
    }

    prevIds.current = nextIds;
  }, [allActive.data]);
}
