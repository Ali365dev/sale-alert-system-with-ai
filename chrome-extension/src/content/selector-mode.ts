/**
 * Visual selector mode — injected by the extension popup.
 * Highlights hovered elements, generates CSS selectors on click,
 * and sends them back to the popup via chrome.runtime.sendMessage.
 */
import { generateSelector, countMatches, previewValue, findSimilarSelector } from "./css-gen";

const OVERLAY_ID = "__dm_selector_overlay__";
const TOOLTIP_ID = "__dm_selector_tooltip__";

let hovered: Element | null = null;
let active = false;

function getOverlay(): HTMLDivElement {
  let el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    Object.assign(el.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #E7000B",
      background: "rgba(231,0,11,0.08)",
      zIndex: "2147483647",
      borderRadius: "3px",
      boxSizing: "border-box",
      transition: "all 0.05s",
    });
    document.body.appendChild(el);
  }
  return el;
}

function getTooltip(): HTMLDivElement {
  let el = document.getElementById(TOOLTIP_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = TOOLTIP_ID;
    Object.assign(el.style, {
      position: "fixed",
      pointerEvents: "none",
      background: "#171717",
      color: "#fff",
      fontSize: "11px",
      fontFamily: "monospace",
      padding: "4px 8px",
      borderRadius: "4px",
      zIndex: "2147483647",
      maxWidth: "320px",
      wordBreak: "break-all",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    });
    document.body.appendChild(el);
  }
  return el;
}

function positionOverlay(el: Element) {
  const rect = el.getBoundingClientRect();
  const overlay = getOverlay();
  Object.assign(overlay.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: "block",
  });
}

function positionTooltip(e: MouseEvent, selector: string, matches: number) {
  const tooltip = getTooltip();
  tooltip.textContent = `${selector} (${matches} match${matches !== 1 ? "es" : ""})`;
  const x = Math.min(e.clientX + 12, window.innerWidth - 340);
  const y = Math.min(e.clientY + 16, window.innerHeight - 40);
  Object.assign(tooltip.style, { top: `${y}px`, left: `${x}px`, display: "block" });
}

function hideUI() {
  const overlay = document.getElementById(OVERLAY_ID);
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (overlay) overlay.style.display = "none";
  if (tooltip) tooltip.style.display = "none";
}

function onMouseMove(e: MouseEvent) {
  if (!active) return;
  const target = e.target as Element;
  if (
    target === document.getElementById(OVERLAY_ID) ||
    target === document.getElementById(TOOLTIP_ID)
  ) return;

  hovered = target;
  const selector = generateSelector(target);
  // Check for similar sibling elements (product cards pattern)
  const similar = findSimilarSelector(target);
  const displaySel = similar && similar.containerCount > 1
    ? similar.containerSelector
    : selector;
  const matches = similar ? similar.containerCount : countMatches(selector);
  positionOverlay(target);
  positionTooltip(e, displaySel, matches);
}

function onClick(e: MouseEvent) {
  if (!active) return;
  e.preventDefault();
  e.stopPropagation();

  const target = hovered || (e.target as Element);
  const selector = generateSelector(target);
  const similar = findSimilarSelector(target);
  const matches = similar ? similar.containerCount : countMatches(selector);
  const preview = previewValue(selector, "text");
  const tag = target.tagName.toLowerCase();

  chrome.runtime.sendMessage({
    type: "SELECTOR_PICKED",
    selector,
    matches,
    preview,
    tag,
    outerHtml: target.outerHTML.slice(0, 300),
    // Extra data for listing config
    similar: similar ?? null,
  });
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && active) {
    stopSelectorMode();
    chrome.runtime.sendMessage({ type: "SELECTOR_MODE_CANCELLED" });
  }
}

export function startSelectorMode() {
  if (active) return;
  active = true;
  document.body.style.cursor = "crosshair";
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
}

export function stopSelectorMode() {
  if (!active) return;
  active = false;
  document.body.style.cursor = "";
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown, true);
  hideUI();

  // Clean up DOM nodes
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(TOOLTIP_ID)?.remove();
}
