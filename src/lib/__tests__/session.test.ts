import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthFetch, getAccessToken, hasSessionHint, refresh, setAccessToken } from "../auth/session";
import { readCookie } from "../cookies";
import { publicEnv, serverPublicEnv } from "../env";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  window.__ENV = { API_URL: "http://api.test/api/v1", COOKIE_PREFIX: "kg" };
  document.cookie = "kg_si=1; path=/";
  document.cookie = "kg_csrf=nonce.mac; path=/";
  setAccessToken(null, "api");
  setAccessToken(null, "admin");
});
afterEach(() => vi.restoreAllMocks());

describe("runtime env (ADR-003)", () => {
  it("reads window.__ENV in the browser, with defaults", () => {
    expect(publicEnv().API_URL).toBe("http://api.test/api/v1");
    expect(publicEnv().COOKIE_PREFIX).toBe("kg");
    expect(publicEnv().APP_ENV).toBe("local");
  });

  it("exposes only allow-listed keys from the server environment", () => {
    const env = serverPublicEnv({ API_URL: "https://api.kriraghor.com/api/v1", JWT_ACCESS_SECRET: "secret", DB_PASSWORD: "x" });
    expect(env.API_URL).toBe("https://api.kriraghor.com/api/v1");
    expect(JSON.stringify(env)).not.toMatch(/secret|DB_PASSWORD/);
  });
});

describe("cookies", () => {
  it("parses a cookie string", () => {
    expect(readCookie("b", "a=1; b=x%3Dy; c=3")).toBe("x=y");
    expect(readCookie("z", "a=1")).toBeUndefined();
  });
  it("detects the session hint", () => {
    expect(hasSessionHint("api")).toBe(true);
    expect(hasSessionHint("admin")).toBe(false);
  });
});

describe("refresh (ADR-004)", () => {
  it("posts with credentials and the CSRF header, and stores the token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { accessToken: "new-token" }));
    expect(await refresh("api", fetchMock)).toBe("new-token");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/auth/refresh");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-CSRF-Token"]).toBe("nonce.mac");
    expect(getAccessToken("api")).toBe("new-token");
  });

  it("uses the admin endpoint and cookie for the admin audience", async () => {
    document.cookie = "kg_acsrf=admin.mac; path=/";
    const fetchMock = vi.fn().mockResolvedValue(json(200, { accessToken: "admin-token" }));
    await refresh("admin", fetchMock);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/v1/auth/admin/refresh");
    expect(fetchMock.mock.calls[0][1].headers["X-CSRF-Token"]).toBe("admin.mac");
    expect(getAccessToken("admin")).toBe("admin-token");
    expect(getAccessToken("api")).toBeNull();
  });

  it("shares one request between concurrent callers (no double rotation)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { accessToken: "t" }));
    await Promise.all([refresh("api", fetchMock), refresh("api", fetchMock), refresh("api", fetchMock)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the token when refresh fails", async () => {
    setAccessToken("old", "api");
    expect(await refresh("api", vi.fn().mockResolvedValue(json(401, { code: "SESSION_REVOKED" })))).toBeNull();
    expect(getAccessToken("api")).toBeNull();
  });
});

describe("authFetch", () => {
  it("adds the bearer token", async () => {
    setAccessToken("abc", "api");
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    await createAuthFetch("api", fetchMock)(new Request("http://api.test/api/v1/me"));
    expect((fetchMock.mock.calls[0][0] as Request).headers.get("Authorization")).toBe("Bearer abc");
  });

  it("refreshes once on TOKEN_EXPIRED and retries", async () => {
    setAccessToken("expired", "api");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { code: "TOKEN_EXPIRED" }))
      .mockResolvedValueOnce(json(200, { accessToken: "fresh" }))
      .mockResolvedValueOnce(json(200, { id: "u1" }));
    const res = await createAuthFetch("api", fetchMock)(new Request("http://api.test/api/v1/me"));
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[2][0] as Request).headers.get("Authorization")).toBe("Bearer fresh");
  });

  it("refreshes before the first request when a fresh page has a session but no token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { accessToken: "fresh" }))
      .mockResolvedValueOnce(json(200, { id: "u1" }));
    const res = await createAuthFetch("api", fetchMock)(new Request("http://api.test/api/v1/shop/profile"));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/api/v1/auth/refresh");
    expect((fetchMock.mock.calls[1][0] as Request).headers.get("Authorization")).toBe("Bearer fresh");
  });

  it("sends without a token when there is no session hint", async () => {
    document.cookie = "kg_si=; path=/; max-age=0";
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    await createAuthFetch("api", fetchMock)(new Request("http://api.test/api/v1/market/items"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][0] as Request).headers.get("Authorization")).toBeNull();
  });

  it("does not refresh on other 401 codes", async () => {
    setAccessToken("abc", "api");
    const fetchMock = vi.fn().mockResolvedValue(json(401, { code: "TOKEN_AUDIENCE_INVALID" }));
    const res = await createAuthFetch("api", fetchMock)(new Request("http://api.test/api/v1/me"));
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
