"use client";

/**
 * Last-resort error page, used only when the root layout itself fails, so it brings its own <html>
 * and plain styles (no fonts, providers or translations are available here). Bilingual on purpose.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f5f3", color: "#111a15" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px" }}>
          <h1 style={{ fontSize: 32 }}>Something went wrong</h1>
          <p lang="bn">কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।</p>
          <p>Please try again. If it keeps happening, come back in a few minutes.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px", background: "#0b7a4b", color: "#fff", border: 0, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
          {error.digest ? <p style={{ color: "#55625b", fontSize: 14 }}>Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
