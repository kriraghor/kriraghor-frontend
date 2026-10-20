import Script from "next/script";

/**
 * Applies the visitor's theme before the first paint (no flash of the wrong theme): "light" or
 * "dark" from localStorage goes on <html data-theme>; none means follow the system. The layout
 * marks <html> suppressHydrationWarning because this attribute is set before React hydrates.
 */
export const THEME_KEY = "kg.theme";
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;

export function ThemeScript() {
  // beforeInteractive: in the document head, before the body paints and before React loads.
  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- App Router root layout (a Pages Router rule)
  return <Script id="kg-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
