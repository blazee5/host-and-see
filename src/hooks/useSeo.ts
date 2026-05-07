import { useEffect } from "react";

type Seo = { title: string; description?: string; image?: string | null; url?: string };

function setMeta(selector: string, attr: string, value: string) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!el) {
    el = document.createElement(selector.startsWith("link") ? "link" : "meta") as any;
    const m = selector.match(/\[(name|property|rel)="([^"]+)"\]/);
    if (m) el!.setAttribute(m[1], m[2]);
    document.head.appendChild(el!);
  }
  el.setAttribute(attr, value);
}

export function useSeo({ title, description, image, url }: Seo) {
  useEffect(() => {
    if (title) document.title = title.length > 60 ? title.slice(0, 57) + "…" : title;
    if (description) {
      const d = description.length > 160 ? description.slice(0, 157) + "…" : description;
      setMeta('meta[name="description"]', "content", d);
      setMeta('meta[property="og:description"]', "content", d);
      setMeta('meta[name="twitter:description"]', "content", d);
    }
    if (title) {
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[name="twitter:title"]', "content", title);
    }
    if (image) {
      setMeta('meta[property="og:image"]', "content", image);
      setMeta('meta[name="twitter:image"]', "content", image);
    }
    const href = url || window.location.href;
    setMeta('link[rel="canonical"]', "href", href);
    setMeta('meta[property="og:url"]', "content", href);
  }, [title, description, image, url]);
}