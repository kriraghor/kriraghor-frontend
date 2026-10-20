import { Suspense, act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../auth";
import { setAccessToken } from "@kriraghor/session/auth";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Status() {
  const { status } = useAuth();
  return status === "signed_out" ? <button type="button">Sign in</button> : <span>{status}</span>;
}

/** Same shape as the layout: the auth consumer sits in a Suspense boundary under the provider. */
const tree = () => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider audience="api">
      <Suspense fallback={<i>…</i>}>
        <Status />
      </Suspense>
    </AuthProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  window.__ENV = { API_URL: "http://api.test/api/v1", COOKIE_PREFIX: "kg" };
  document.cookie = "kg_si=; path=/; max-age=0";
  setAccessToken(null, "api");
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("useAuth hydration (React #418)", () => {
  it("renders the same markup on the server and the first client render, then shows the real status", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree());
    document.body.appendChild(container);
    expect(container.textContent).toBe("loading");

    const errors: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, tree(), { onRecoverableError: (e) => errors.push(e), onUncaughtError: (e) => errors.push(e) });
    });

    expect(errors).toEqual([]);
    expect(container.querySelector("button")?.textContent).toBe("Sign in");
  });

  it("reports the real status straight away on a client-only render", async () => {
    setAccessToken("token", "api");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { createRoot } = await import("react-dom/client");
    await act(async () => {
      createRoot(container).render(tree());
    });
    expect(container.textContent).toBe("signed_in");
  });
});
