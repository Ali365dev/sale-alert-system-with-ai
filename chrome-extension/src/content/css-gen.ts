/**
 * Generate a unique-enough CSS selector for a given DOM element.
 * Prefers ID > stable data attrs > class combos > nth-of-type path.
 */
export function generateSelector(el: Element): string {
  // 1. ID — best and most specific
  if (el.id && /^[a-z_-][\w-]*$/i.test(el.id)) {
    return `#${el.id}`;
  }

  // 2. Stable data attributes
  for (const attr of ["data-testid", "data-cy", "data-qa", "data-id", "name"]) {
    const val = el.getAttribute(attr);
    if (val) return `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
  }

  // 3. Build path up to body/root with nth-of-type
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.tagName !== "HTML" && node.tagName !== "BODY") {
    let selector = node.tagName.toLowerCase();

    // Add most specific stable classes (not dynamic ones with digits in them)
    const stable = Array.from(node.classList)
      .filter((c) => !/^\d|is-|has-|active|hover|focus|selected/.test(c))
      .slice(0, 2);
    if (stable.length) selector += "." + stable.map(CSS.escape).join(".");

    // Add nth-of-type to disambiguate siblings
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(selector);
    node = node.parentElement;

    // Stop once we've built a unique selector
    if (parts.length >= 4) break;
  }

  return parts.join(" > ");
}

/** Count how many elements a selector matches on the current page */
export function countMatches(selector: string): number {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/** Extract the text/src/href value for a selector + type combo */
export function previewValue(selector: string, type: string): string {
  try {
    const el = document.querySelector(selector);
    if (!el) return "(no match)";
    switch (type) {
      case "image": return (el as HTMLImageElement).src || el.getAttribute("data-src") || "(no src)";
      case "link": return (el as HTMLAnchorElement).href || "(no href)";
      case "attribute": return el.getAttribute("data-price") || el.getAttribute("content") || "(no attr)";
      default: return (el.textContent || "").trim().slice(0, 120);
    }
  } catch {
    return "(error)";
  }
}
