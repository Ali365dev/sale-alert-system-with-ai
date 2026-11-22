import type { KeyboardEvent, ReactNode } from "react";

import "./Tabs.css";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const idx = tabs.findIndex((t) => t.id === active);
    const next = tabs[(idx + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`tabs-tab${isActive ? " tabs-tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && <span aria-hidden="true" className="tabs-icon">{tab.icon}</span>}
            {tab.label}
            {tab.count != null && <span className="tabs-count">{tab.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
}
