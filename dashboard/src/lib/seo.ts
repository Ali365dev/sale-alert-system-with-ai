import { useEffect } from "react";

// Client-side only: this SPA has no SSR, so these tags update after the JS
// bundle runs. Fine for the browser tab/title and for any crawler that
// executes JS (Googlebot does); crawlers that don't render JS (some social
// link-preview bots) will still see the tags from index.html.
interface SeoOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "product";
  structuredData?: Record<string, unknown>;
}

function setMeta(attr: "name" | "property", key: string, content: string | undefined) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setStructuredData(data: Record<string, unknown> | undefined) {
  const id = "seo-structured-data";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSeo({ title, description, image, url, type = "website", structuredData }: SeoOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url ?? window.location.href);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    setStructuredData(structuredData);

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, image, url, type, structuredData]);
}
