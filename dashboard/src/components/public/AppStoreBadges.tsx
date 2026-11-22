import type { ReactNode } from "react";

import "./AppStoreBadges.css";

export const APP_STORE_URL = "https://apps.apple.com/us/app/deals-more/id6819801995";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.dealplusapp";

function AppleMark() {
  return (
    <svg viewBox="0 0 384 512" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 512 512" width="22" height="22" aria-hidden="true" focusable="false">
      <path fill="#34A853" d="M48 59.5v393c0 9.7 5.5 18.2 13.6 22.3L289 256 61.6 37.2C53.5 41.3 48 49.8 48 59.5z" />
      <path fill="#FBBC04" d="M374.6 341.6 289 256l85.6-85.6 97.6 55.4c19.7 11.2 19.7 39.2 0 50.4l-97.6 55.4z" />
      <path fill="#4285F4" d="M61.6 474.8c7.6 3.9 16.9 4 25.2-.7l287.8-132.5L289 256 61.6 474.8z" />
      <path fill="#EA4335" d="M61.6 37.2 289 256l85.6-85.6L86.8 37.9c-8.3-4.7-17.6-4.6-25.2-.7z" />
    </svg>
  );
}

function StoreBadge({ href, label, kicker, store, children }: { href: string; label: string; kicker: string; store: string; children: ReactNode }) {
  return (
    <a className="store-badge" href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
      <span className="store-badge-text" aria-hidden="true">
        <span className="store-badge-kicker">{kicker}</span>
        <span className="store-badge-name">{store}</span>
      </span>
    </a>
  );
}

export function AppStoreBadges() {
  return (
    <div className="store-badges">
      <StoreBadge href={APP_STORE_URL} label="Download DealsMore on the App Store (opens in a new tab)" kicker="Download on the" store="App Store">
        <AppleMark />
      </StoreBadge>
      <StoreBadge href={PLAY_STORE_URL} label="Get DealsMore on Google Play (opens in a new tab)" kicker="Get it on" store="Google Play">
        <PlayMark />
      </StoreBadge>
    </div>
  );
}
