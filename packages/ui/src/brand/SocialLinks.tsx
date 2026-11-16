import { FacebookLogo, InstagramLogo, LinkedinLogo, TiktokLogo, XLogo, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { cn } from "../cn";

/** Kriraghor's official profiles (product owner, 5 Nov 2026). The one list: footers and the search-engine profile read it. */
export const SOCIAL_PROFILES = [
  { key: "facebook", name: "Facebook", href: "https://www.facebook.com/Kriraghor", Icon: FacebookLogo },
  { key: "instagram", name: "Instagram", href: "https://www.instagram.com/kriraghor", Icon: InstagramLogo },
  { key: "youtube", name: "YouTube", href: "https://www.youtube.com/@kriraghor", Icon: YoutubeLogo },
  { key: "tiktok", name: "TikTok", href: "https://www.tiktok.com/@kriraghor", Icon: TiktokLogo },
  { key: "linkedin", name: "LinkedIn", href: "https://www.linkedin.com/company/kriraghor", Icon: LinkedinLogo },
  { key: "x", name: "X", href: "https://x.com/kriraghor", Icon: XLogo },
] as const;

/** A row of icon links for the footers. `label` names the row for screen readers, in the page's language. */
export function SocialLinks({ label, className }: { label: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-1", className)} data-testid="social-links">
      {SOCIAL_PROFILES.map(({ key, name, href, Icon }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            data-testid={`social-${key}`}
            className="inline-flex size-11 items-center justify-center rounded-control transition-[transform,background-color,color] duration-200 ease-out hover:bg-white/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95"
          >
            <Icon size={22} aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
