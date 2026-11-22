import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "../../store/toastStore";
import { scraperClient } from "../../api/client";
import type { ProcessingStatus } from "../../api/emails";

// Each Process runs OCR + an LLM call on the scraper's single CPU, and a burst
// of parallel requests also trips Cloudflare's rate limit — so a few at a time.
const BULK_CONCURRENCY = 2;

async function runLimited<T>(ids: number[], task: (id: number) => Promise<T>): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(ids.length);
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await task(ids[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, ids.length) }, worker));
  return results;
}

export function useBulkEmailActions(onDone: () => void) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  async function bulkDelete(ids: number[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected email(s) and their extracted offers?`)) return;
    setRunning(true);
    const results = await runLimited(ids, (id) => scraperClient.delete(`/emails/${id}`));
    setRunning(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
    if (failed === 0) toast.success(`${ids.length} email(s) deleted.`);
    else toast.error(`Deleted ${ids.length - failed} email(s), ${failed} failed.`);
    onDone();
  }

  async function bulkReprocess(ids: number[]) {
    if (ids.length === 0) return;
    setRunning(true);
    const results = await runLimited(ids, async (id) => {
      const { data } = await scraperClient.post<{ processing_status: ProcessingStatus }>(`/emails/${id}/process`);
      return data.processing_status;
    });
    setRunning(false);
    // A 200 can still be a failed analysis (no matching brand, AI gave up).
    const failed = results.filter((r) => r.status === "rejected" || r.value !== "processed").length;
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
    if (failed === 0) toast.success(`${ids.length} email(s) processed.`);
    else toast.error(`Processed ${ids.length - failed} email(s), ${failed} failed — see the Failed tab.`);
    onDone();
  }

  return { running, bulkDelete, bulkReprocess };
}
