import Clarity from "@microsoft/clarity";

// Only in production builds with a project ID configured — keeps local dev
// traffic (and PR preview noise) out of session recordings.
export function initClarity() {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID;
  if (import.meta.env.PROD && projectId) {
    Clarity.init(projectId);
  }
}
