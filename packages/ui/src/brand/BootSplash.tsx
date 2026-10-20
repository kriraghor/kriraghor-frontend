import Script from "next/script";
import { LogoMark } from "./LogoMark";

/**
 * The first-load splash (kriraghor-docs 09 §8): the logo's three pieces join, the wordmark rises,
 * then it fades. Pure CSS, so it plays before any JavaScript; this inline script, which runs
 * before the splash is painted, decides:
 * - already shown in this browser session, or the visitor asks for reduced motion → never shown;
 * - otherwise it fades once the wordmark has finished rising (the animation really played, however
 *   late the stylesheet arrived) and the page has loaded, and after 2.5 s at the latest, so it
 *   never holds a slow page hostage.
 * It only sets data-splash on <html> ("on", then "out"; or "off"); the layout marks <html>
 * suppressHydrationWarning. Without JavaScript the splash never shows (CSS hides it by default).
 */
export const SPLASH_KEY = "kg.splash";
export const SPLASH_MAX_MS = 2500;

export const splashScript = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("${SPLASH_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){d.dataset.splash="off";return}sessionStorage.setItem("${SPLASH_KEY}","1")}catch(e){d.dataset.splash="off";return}d.dataset.splash="on";var played=false,loaded=false,gone=false;function out(){if(gone)return;gone=true;d.dataset.splash="out"}function check(){if(played&&loaded)out()}addEventListener("animationend",function(e){if(e.animationName==="kg-rise")setTimeout(function(){played=true;check()},350)});if(document.readyState==="complete")loaded=true;else addEventListener("load",function(){loaded=true;check()},{once:true});setTimeout(out,${SPLASH_MAX_MS})})();`;

export function BootSplash({ word }: { word: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- App Router root layout (a Pages Router rule) */}
      <Script id="kg-splash" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: splashScript }} />
      <div className="kg-splash" aria-hidden data-testid="boot-splash">
        <LogoMark size={112} motion="join" />
        <p className="kg-splash-word">{word}</p>
      </div>
    </>
  );
}
