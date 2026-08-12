import type { ReactNode } from "react";

import { Icon } from "../components/icons";

export interface JobTypeConfig {
  jobType: string;
  title: string;
  icon: ReactNode;
  itemNoun: string;
  description: string;
}

/** Single source of truth for every pipeline action — the Pipeline Center's
 * action cards and every "start job" trigger button read from this. Adding a
 * new pipeline action on the frontend is one entry here (plus a matching
 * BackgroundJob subclass + registry line on the backend). */
export const JOB_TYPES: JobTypeConfig[] = [
  {
    jobType: "email_sync",
    title: "Fetch & Analyse Emails",
    icon: <Icon.mail size={17} />,
    itemNoun: "emails",
    description: "Fetch new emails from Gmail, analyse them with AI, and save extracted offers.",
  },
  {
    jobType: "process_pending",
    title: "Process Pending Emails",
    icon: <Icon.offer size={17} />,
    itemNoun: "emails",
    description: "Analyse any already-fetched emails that don't have an offer yet.",
  },
  {
    jobType: "verify_offers",
    title: "Verify Offers",
    icon: <Icon.check size={17} />,
    itemNoun: "offers",
    description: "Run every unverified offer through the AI verifier.",
  },
  {
    jobType: "fetch_sales_web",
    title: "Fetch Sales From Web",
    icon: <Icon.search size={17} />,
    itemNoun: "brands",
    description: "Search the web for each active brand's current sales and offers.",
  },
  {
    jobType: "research_brands",
    title: "Research Brands",
    icon: <Icon.sparkle size={17} />,
    itemNoun: "brands",
    description: "Research each active brand via Tavily + Llama and save/update its offers.",
  },
  {
    jobType: "label_brand_emails",
    title: "Label Brand Emails",
    icon: <Icon.mail size={17} />,
    itemNoun: "messages",
    description: "Scan the Gmail inbox and label messages sent by a known brand address.",
  },
  {
    jobType: "discover_brand_candidates",
    title: "Analyze Unknown Emails",
    icon: <Icon.inbox size={17} />,
    itemNoun: "emails",
    description: "Run AI brand identification on unmatched sender emails in the Unknown Emails queue.",
  },
];

export const JOB_TYPE_BY_ID: Record<string, JobTypeConfig> = Object.fromEntries(
  JOB_TYPES.map((t) => [t.jobType, t]),
);

export function getJobTypeConfig(jobType: string): JobTypeConfig {
  return (
    JOB_TYPE_BY_ID[jobType] ?? {
      jobType,
      title: jobType,
      icon: <Icon.activity size={17} />,
      itemNoun: "items",
      description: "",
    }
  );
}
