/**
 * Generate a CSS selector for a given DOM element.
 * For repeating items (product cards) this returns a general selector
 * that matches ALL siblings of the same type — not just the clicked one.
 * Falls back to a specific nth-of-type path only when needed.
 */
export function generateSelector(el: Element): string {
  // 1. ID
  if (el.id && /^[a-z_-][\w-]*$/i.test(el.id)) {
    return `#${el.id}`;
  }

  // 2. Stable data attributes
  for (const attr of ["data-testid", "data-cy", "data-qa", "data-id", "name"]) {
    const val = el.getAttribute(attr);
    if (val) return `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
  }

  // 3. Class-based selector — NO positional pseudo-classes.
  //    If the element has stable classes, build `parent > tag.cls1.cls2`
  //    so picking one product card selects ALL cards of the same type.
  const stableClasses = Array.from(el.classList).filter(
    (c) => !/^\d|is-|has-|active|hover|focus|selected|loading/.test(c),
  );

  if (stableClasses.length) {
    const tagCls =
      el.tagName.toLowerCase() + "." + stableClasses.map(CSS.escape).join(".");

    // Try narrowing with the direct parent (keeps it precise without positional index)
    const parent = el.parentElement;
    if (parent && parent.tagName !== "BODY" && parent.tagName !== "HTML") {
      const pStable = Array.from(parent.classList)
        .filter((c) => !/^\d|is-|has-|active|hover|focus|selected|loading/.test(c))
        .slice(0, 2);
      if (pStable.length) {
        const parentSel =
          parent.tagName.toLowerCase() + "." + pStable.map(CSS.escape).join(".");
        const combined = `${parentSel} > ${tagCls}`;
        if (document.querySelectorAll(combined).length >= 1) return combined;
      }
    }

    // Simple class selector as fallback
    if (document.querySelectorAll(tagCls).length >= 1) return tagCls;
  }

  // 4. Last resort: nth-of-type path (preserves uniqueness for single elements)
  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.tagName !== "HTML" && node.tagName !== "BODY") {
    let selector = node.tagName.toLowerCase();
    const stable = Array.from(node.classList)
      .filter((c) => !/^\d|is-|has-|active|hover|focus|selected|loading/.test(c))
      .slice(0, 2);
    if (stable.length) selector += "." + stable.map(CSS.escape).join(".");

    const p = node.parentElement;
    if (p) {
      const siblings = Array.from(p.children).filter((c) => c.tagName === node!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(selector);
    node = node.parentElement;
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
