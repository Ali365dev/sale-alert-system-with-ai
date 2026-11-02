import axios from "axios";
import type { Job } from "../types";
import { getSettings } from "./storage";

const ACTIVE_JOB_KEY = "dm_active_job_id";

async function scraperClient() {
  const { scraperServerUrl, sessionToken } = await getSettings();
  return axios.create({
    baseURL: `${scraperServerUrl}/api`,
    timeout: 10000,
    headers: sessionToken ? { "X-Session-Token": sessionToken } : {},
  });
}

export async function getJob(jobId: number): Promise<Job | null> {
  try {
    const client = await scraperClient();
    const res = await client.get(`/jobs/${jobId}`);
    return res.data as Job;
  } catch {
    return null;
  }
}

export async function listJobs(opts?: {
  jobType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: Job[]; total: number }> {
  const client = await scraperClient();
  const res = await client.get("/jobs", {
    params: {
      job_type: opts?.jobType,
      status: opts?.status,
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
      sort: "id",
      sort_dir: "desc",
    },
  });
  return res.data as { jobs: Job[]; total: number };
}

export async function cancelJob(jobId: number): Promise<void> {
  const client = await scraperClient();
  await client.post(`/jobs/${jobId}/cancel`);
}

// ── Persistent active-job storage (survives popup close) ─────────────────────

export function storeActiveJobId(jobId: number): void {
  chrome.storage.local.set({ [ACTIVE_JOB_KEY]: jobId });
}

export function clearActiveJobId(): void {
  chrome.storage.local.remove(ACTIVE_JOB_KEY);
}

export function loadActiveJobId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(ACTIVE_JOB_KEY, (result) => {
      resolve((result[ACTIVE_JOB_KEY] as number | undefined) ?? null);
    });
  });
}

/** Returns true when a job is in a terminal state. */
export function isJobTerminal(status: string): boolean {
  return status === "done" || status === "failed" || status === "cancelled";
}
