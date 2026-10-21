/**
 * Share links for public pages (Round B1 part 5). Pure functions, so they are unit-tested without a
 * browser; ShareButton puts them in a menu when the device has no native share sheet.
 */

export type ShareTarget = "whatsapp" | "facebook" | "messenger" | "x";
export type ShareLink = { key: ShareTarget; href: string };

/**
 * The URL with `ref=share` added (an existing `ref` is replaced; the rest of the query and the hash
 * are kept), so visits from shared links can be counted. A relative or unparsable URL gets the
 * parameter appended by hand.
 */
export function withRef(url: string, ref = "share"): string {
  try {
    const u = new URL(url);
    u.searchParams.set("ref", ref);
    return u.toString();
  } catch {
    const [beforeHash, ...hash] = url.split("#");
    const [path, query = ""] = beforeHash.split("?");
    const kept = query.split("&").filter((p) => p && !p.startsWith("ref="));
    const q = [...kept, `ref=${encodeURIComponent(ref)}`].join("&");
    return `${path}?${q}${hash.length ? `#${hash.join("#")}` : ""}`;
  }
}

/** A WhatsApp share of a ready-made message (the message carries its own link). */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Phones and tablets, from the user agent (Messenger's app link only opens there). */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua ?? "");
}

/**
 * The share menu, in order: WhatsApp ("text url"), Facebook, Messenger (phones only: it is an app
 * link) and X. `url` is used as given: pass it through withRef first.
 */
export function shareLinks(url: string, text?: string | null, opts: { mobile?: boolean } = {}): ShareLink[] {
  const message = text && text.trim() ? `${text.trim()} ${url}` : url;
  const links: ShareLink[] = [
    { key: "whatsapp", href: whatsappUrl(message) },
    { key: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ];
  if (opts.mobile) links.push({ key: "messenger", href: `fb-messenger://share/?link=${encodeURIComponent(url)}` });
  const x = new URLSearchParams({ url });
  if (text && text.trim()) x.set("text", text.trim());
  links.push({ key: "x", href: `https://x.com/intent/tweet?${x.toString()}` });
  return links;
}

/**
 * Copies text to the clipboard: the async Clipboard API first, then a hidden textarea and
 * execCommand("copy") for older browsers and non-secure origins. Resolves to whether it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied or not allowed here: try the old way.
  }
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
