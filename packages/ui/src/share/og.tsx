import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Link-preview images (Round B1 part 5): the 1200×630 card that `opengraph-image.tsx` routes render
 * with next/og's ImageResponse. Server only (reads the logo from the app's public folder).
 *
 * Satori draws it: every element with more than one child needs `display: flex`, and only inline
 * styles work. Latin text uses next/og's built-in font; Bangla glyphs are fetched by next/og on
 * demand and, when that fails, the card still renders (the Bangla text is just left out).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_BRAND = { green: "#0B7A4B", amber: "#EE9A2E", dark: "#0A1A12" } as const;

export type OgStat = { label: string; value: string; star?: boolean };

let logo: Promise<string | null> | null = null;

/** The app's public/logo.png as a data URL (read once per process), or null when it is not there. */
export function loadLogo(file = join(process.cwd(), "public", "logo.png")): Promise<string | null> {
  logo ??= readFile(file)
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => null);
  return logo;
}

/** Cuts long text at a word so it fits the card (names, headlines). */
export function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:·-]+$/, "")}…`;
}

/** Bangla text: letter-spacing pulls its vowel signs apart, so it is only used for Latin labels. */
const bangla = (s: string | null | undefined) => /[ঀ-৿]/.test(s ?? "");
const tracked = (s: string | null | undefined, px: number) => (bangla(s) ? {} : { letterSpacing: px, textTransform: "uppercase" as const });

function Star() {
  return (
    <svg width="40" height="40" viewBox="0 0 256 256" style={{ marginRight: 10 }}>
      <path
        fill={OG_BRAND.amber}
        d="M234.29 114.85l-45 38.83L203 211.75a16.4 16.4 0 0 1-24.5 17.82L128 198.49l-50.53 31.08A16.4 16.4 0 0 1 53 211.75l13.76-58.07-45-38.83A16.46 16.46 0 0 1 31.08 86l59-4.76 22.76-55.08a16.36 16.36 0 0 1 30.27 0l22.75 55.08 59 4.76a16.46 16.46 0 0 1 9.37 28.86z"
      />
    </svg>
  );
}

type CardProps = {
  /** The product line under the logo ("Kriraghor Hiring", "Kriraghor Esports"). */
  brand: string;
  /** A short line above the title (role, game), in amber. */
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  stats?: OgStat[];
  /** The page address shown in the green bar ("kriraghor.com/hiring/rafi"). */
  footer: string;
  /** From loadLogo(). */
  logo?: string | null;
};

/** The share card: dark field, amber eyebrow, big name, stat tiles, green brand bar. */
export function ShareCard({ brand, eyebrow, title, subtitle, stats = [], footer, logo: logoSrc }: CardProps) {
  const name = clip(title, 44) || "Kriraghor";
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG_BRAND.dark, color: "#FFFFFF" }}>
      <div style={{ display: "flex", height: 10, width: "100%" }}>
        <div style={{ display: "flex", flex: 3, background: OG_BRAND.green }} />
        <div style={{ display: "flex", flex: 1, background: OG_BRAND.amber }} />
      </div>
      <div style={{ display: "flex", flex: 1, flexDirection: "column", padding: "48px 72px 0" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {logoSrc ? (
            <div style={{ display: "flex", width: 84, height: 84, borderRadius: 42, background: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 22 }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={logoSrc} width={72} height={72} />
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 1 }}>{brand}</div>
        </div>
        {eyebrow ? <div style={{ display: "flex", marginTop: 44, fontSize: 28, ...tracked(eyebrow, 4), color: OG_BRAND.amber }}>{clip(eyebrow, 56)}</div> : null}
        <div style={{ display: "flex", marginTop: eyebrow ? 10 : 52, fontSize: name.length > 26 ? 62 : 84, lineHeight: 1.05, maxWidth: 1056 }}>{name}</div>
        {subtitle ? <div style={{ display: "flex", marginTop: 16, fontSize: 32, color: "rgba(255,255,255,0.74)", maxWidth: 1056 }}>{clip(subtitle, 76)}</div> : null}
        {stats.length ? (
          <div style={{ display: "flex", marginTop: 34 }}>
            {stats.slice(0, 4).map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", padding: "12px 26px", marginRight: 18, borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "2px solid rgba(255,255,255,0.14)" }}>
                <div style={{ display: "flex", fontSize: 20, ...tracked(s.label, 2), color: "rgba(255,255,255,0.6)" }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "center", marginTop: 4, fontSize: 42 }}>
                  {s.star ? <Star /> : null}
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", height: 92, alignItems: "center", justifyContent: "space-between", padding: "0 72px", background: OG_BRAND.green }}>
        <div style={{ display: "flex", fontSize: 30 }}>{clip(footer, 60)}</div>
        <div style={{ display: "flex", width: 150, height: 12, borderRadius: 6, background: OG_BRAND.amber }} />
      </div>
    </div>
  );
}

/** The bare host and path for the footer ("https://www.kriraghor.com/x" becomes "kriraghor.com/x"). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}
